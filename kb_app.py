import os
from functools import wraps
from datetime import datetime, timedelta

from dotenv import load_dotenv

from flask import Flask, request, jsonify, send_from_directory, session, redirect, render_template
from flask_cors import CORS
from werkzeug.security import check_password_hash
from sqlalchemy import text, func
import logging
import json

# Configuração de Logs
# Configuração de Logs
# Usar StreamHandler para garantir que logs funcionem no Docker (stdout) sem erros de permissão
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Load environment variables FIRST to ensure they are available for all imports
basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
print(f"DEBUG: Loading .env from {env_path}")
if os.path.exists(env_path):
    load_dotenv(env_path, override=True)
    print("DEBUG: .env loaded.")
else:
    print("DEBUG: .env file NOT FOUND.")

print(f"DEBUG: SECRET_KEY status: {'Set' if os.getenv('SECRET_KEY') else 'MISSING'}")

from kb_database import init_db, get_db, Article, Category, ChatHistory, User, Tag
from kb_ai_service import get_ai_service



# Decorador para exigir privilégios de administrador
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Autenticação necessária'}), 401
        if session.get('role') not in ['admin', 'super_admin']:
            return jsonify({'error': 'Acesso negado: Requer privilégios de administrador'}), 403
        return f(*args, **kwargs)
    return decorated_function

# Store failed login attempts for rate limiting
login_attempts = {}
MAX_ATTEMPTS = 5
LOCKOUT_TIME = timedelta(minutes=15)

app = Flask(__name__, static_folder='static', template_folder='templates')
# Versão da Aplicação (Atualize isso para forçar o reload no frontend)
APP_VERSION = "2026.02.18-v1"

# Habilitar CORS para todas as rotas /api/* (Permite que outros projetos internos acessem)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Garante que a chave nunca seja vazia (mesmo que a env var exista mas esteja vazia)
# Garante que a chave nunca seja vazia (mesmo que a env var exista mas esteja vazia)
if not os.getenv('SECRET_KEY'):
    print("⚠️  CRITICAL: SECRET_KEY not found in environment. Using temporary key (sessions will die on restart).")
    app.secret_key = os.urandom(24)
else:
    app.secret_key = os.getenv('SECRET_KEY')
CORS(app)  # Permitir requisições do frontend

# Configuração de Uploads
UPLOAD_FOLDER = os.path.join(basedir, 'static', 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Inicializar banco de dados (Movido para if __name__ == '__main__')
# init_db()

# ==================== ROTAS DE ARQUIVOS ESTÁTICOS ====================

@app.route('/')
def index():
    """Serve o arquivo HTML principal (Protegido)"""
    if 'user' not in session:
        return redirect('/login')
    return render_template('kb_index.html')

@app.route('/login')
def login_page():
    """Serve a página de login"""
    if 'user' in session:
        return redirect('/')
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def api_login():
    """Autenticação segura com banco de dados e rate limiting"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    ip = request.remote_addr

    # Verificação de Rate Limit
    now = datetime.now()
    if ip in login_attempts:
        attempts, last_time = login_attempts[ip]
        if attempts >= MAX_ATTEMPTS and (now - last_time) < LOCKOUT_TIME:
            wait_time = int((LOCKOUT_TIME - (now - last_time)).total_seconds() / 60)
            return jsonify({'error': f'Muitas tentativas. Tente novamente em {wait_time} minutos.'}), 429

    db = get_db()
    try:
        if not username:
            return jsonify({'error': 'Usuário é obrigatório'}), 400

        user = db.query(User).filter(func.lower(User.username) == username.lower()).first()
        
        if user and check_password_hash(user.password_hash, password):
            # Login bem-sucedido: Limpar tentativas
            if ip in login_attempts:
                del login_attempts[ip]
                
            # Configuração de Sessão: Expira ao fechar navegador
            session.permanent = False
            # app.permanent_session_lifetime = timedelta(minutes=30) # Desativado para exigir login ao reabrir
            session['user'] = user.username
            session['role'] = user.role
            
            return jsonify({
                'message': 'Login realizado com sucesso',
                'user': user.to_dict()
            }), 200
        
        # Login falhou: Incrementar tentativas
        attempts, _ = login_attempts.get(ip, (0, now))
        login_attempts[ip] = (attempts + 1, now)
        
        return jsonify({'error': 'Credenciais inválidas'}), 401
    finally:
        db.close()

@app.route('/api/logout', methods=['POST'])
def api_logout():
    """Realiza logout"""
    session.clear()
    return jsonify({'message': 'Logout realizado com sucesso'})

@app.route('/api/me', methods=['GET'])
def get_current_user():
    """Retorna informações do usuário logado"""
    if 'user' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    username = session.get('user')
    
    # Refresh role from DB to handle updates
    db = get_db()
    try:
        user = db.query(User).filter_by(username=username).first()
        if user:
            # Update session if role changed
            if session.get('role') != user.role:
                session['role'] = user.role
                
            return jsonify({
                'username': user.username,
                'role': user.role
            })
    except:
        pass
    finally:
        db.close()

    return jsonify({
        'username': username,
        'role': session.get('role')
    })

# ==================== ROTAS DE USUÁRIOS ====================

@app.route('/api/users', methods=['GET'])
@admin_required
def list_users():
    """Lista todos os usuários (Apenas Admin)"""
    db = get_db()
    try:
        users = db.query(User).all()
        return jsonify([u.to_dict() for u in users])
    finally:
        db.close()

@app.route('/api/users', methods=['POST'])
@admin_required
def create_user():
    """Cria um novo usuário (Apenas Admin)"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role', 'user') # Default para 'user'

    if not username or not password:
        return jsonify({'error': 'Usuário e senha são obrigatórios'}), 400

    db = get_db()
    try:
        if db.query(User).filter_by(username=username).first():
            return jsonify({'error': 'Usuário já existe'}), 400

        from werkzeug.security import generate_password_hash
        new_user = User(
            username=username,
            password_hash=generate_password_hash(password),
            role=role
        )
        db.add(new_user)
        db.commit()
        return jsonify({
            'message': 'Usuário criado com sucesso',
            'user': new_user.to_dict()
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Remove um usuário (Apenas Admin)"""
    db = get_db()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return jsonify({'error': 'Usuário não encontrado'}), 404
        
        # Proteção contra auto-deleção ou deleção de admins cruciais (opcional, mas recomendado)
        if user.username == session.get('user'):
             return jsonify({'error': 'Não é possível deletar o próprio usuário logado'}), 400
             
        db.delete(user)
        db.commit()
        return jsonify({'message': 'Usuário removido com sucesso'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/css/<path:path>')
def send_css(path):
    """Serve arquivos CSS (Compatibilidade)"""
    return send_from_directory('static/css', path)

@app.route('/js/<path:path>')
def send_js(path):
    """Serve arquivos JS (Compatibilidade)"""
    return send_from_directory('static/js', path)

@app.route('/img/<path:path>')
def send_img(path):
    """Serve arquivos de imagem (Compatibilidade)"""
    return send_from_directory('static/img', path)

@app.route('/video/<path:path>')
def send_video(path):
    """Serve arquivos de vídeo (Compatibilidade)"""
    # Videos might be in static/img based on previous move commands which moved img/* to static/img
    # Checking file structure, user had 'video' folder? 
    # 'move img\* static\img\' was run. 
    # 'kb_index.html' references 'static/img/logo1.mp4'.
    # So video is likely in static/img.
    return send_from_directory('static/img', path)

@app.route('/static/uploads/<path:filename>')
def serve_uploads(filename):
    """Serve arquivos de upload"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload de imagens para artigos"""
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Arquivo sem nome'}), 400
        
    if file and allowed_file(file.filename):
        from werkzeug.utils import secure_filename
        import time
        
        filename = secure_filename(file.filename)
        # Adicionar timestamp para evitar duplicatas
        name, ext = os.path.splitext(filename)
        filename = f"{name}_{int(time.time())}{ext}"
        
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        
        # Retorna a URL relativa
        url = f"/static/uploads/{filename}"
        return jsonify({'url': url})
        
    return jsonify({'error': 'Tipo de arquivo não permitido'}), 400

# ==================== ROTAS DE CATEGORIAS ====================

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Retorna todas as categorias"""
    db = get_db()
    try:
        categories = db.query(Category).all()
        return jsonify([cat.to_dict() for cat in categories])
    finally:
        db.close()

@app.route('/api/categories', methods=['POST'])
def create_category():
    """Cria uma nova categoria"""
    data = request.json
    db = get_db()
    try:
        category = Category(
            name=data['name'],
            description=data.get('description', '')
        )
        db.add(category)
        db.commit()
        return jsonify(category.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

@app.route('/api/categories/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    """Atualiza uma categoria existente"""
    data = request.json
    db = get_db()
    try:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            return jsonify({'error': 'Categoria não encontrada'}), 404
        
        category.name = data.get('name', category.name)
        category.description = data.get('description', category.description)
        
        db.commit()
        return jsonify(category.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

@app.route('/api/change-password', methods=['POST'])
def change_password():
    """Altera a senha do usuário logado"""
    if 'user' not in session:
        return jsonify({'error': 'Não autenticado'}), 401
    
    data = request.json
    old_password = data.get('old_password')
    new_password = data.get('new_password')
    
    if not old_password or not new_password:
        return jsonify({'error': 'Senha antiga e nova são obrigatórias'}), 400
        
    db = get_db()
    try:
        user = db.query(User).filter_by(username=session['user']).first()
        if not user or not check_password_hash(user.password_hash, old_password):
            return jsonify({'error': 'Senha antiga incorreta'}), 401
            
        from werkzeug.security import generate_password_hash
        user.password_hash = generate_password_hash(new_password)
        db.commit()
        return jsonify({'message': 'Senha alterada com sucesso'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/categories/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    """Deleta uma categoria"""
    db = get_db()
    try:
        category = db.query(Category).filter(Category.id == category_id).first()
        if not category:
            return jsonify({'error': 'Categoria não encontrada'}), 404
        
        # Verificar se existem artigos associados
        if category.articles:
             return jsonify({'error': 'Não é possível excluir categorias com artigos associados. Remova ou mova os artigos primeiro.'}), 400
            
        db.delete(category)
        db.commit()
        return jsonify({'message': 'Categoria deletada com sucesso'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

# ==================== ROTAS DE ARTIGOS ====================

@app.route('/api/articles', methods=['GET'])
def get_articles():
    """Retorna todos os artigos ou filtra por categoria"""
    category_id = request.args.get('category_id')
    search = request.args.get('search', '')
    
    db = get_db()
    try:
        query = db.query(Article)
        
        if category_id:
            query = query.filter(Article.category_id == category_id)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Article.title.ilike(search_term)) | 
                (Article.content.ilike(search_term)) |
                (Article.tags.ilike(search_term))
            )
        
        # Filtro de Status (Padrão: Apenas aprovados, a menos que especificado)
        # Filtro de Status (Padrão: Apenas aprovados, a menos que especificado)
        status = request.args.get('status', 'approved')
        if status != 'all':
            query = query.filter(Article.status == status)

        articles = query.order_by(Article.updated_at.desc()).all()
        
        # Analytics: Log search terms from KB bar
        if search:
            get_ai_service().analytics.log_search(search, source='search_bar', results_count=len(articles))

        return jsonify([article.to_dict() for article in articles])
    except Exception as e:
        print(f"❌ Erro em get_articles: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/articles/<int:article_id>', methods=['GET'])
def get_article(article_id):
    """Retorna um artigo específico"""
    db = get_db()
    try:
        article = db.query(Article).filter(Article.id == article_id).first()
        if article:
            return jsonify(article.to_dict())
        return jsonify({'error': 'Artigo não encontrado'}), 404
    finally:
        db.close()

# Caching global simples para evitar query pesada no chat a cada request
ARTICLES_CACHE = {
    'data': None,
    'last_update': None
}

def invalidate_article_cache():
    """Invalida o cache de artigos para forçar recarregamento."""
    ARTICLES_CACHE['data'] = None
    print("🧹 Cache de artigos invalidado.")

def get_cached_articles(db):
    """Retorna artigos do cache ou carrega do banco se expirado/vazio."""
    if ARTICLES_CACHE['data'] is not None:
        return ARTICLES_CACHE['data']
    
    # Carregar do banco
    print("📦 Carregando artigos do banco para cache...")
    articles = db.query(Article).filter(Article.status == 'approved').all()
    articles_dict = [article.to_dict() for article in articles]
    ARTICLES_CACHE['data'] = articles_dict
    ARTICLES_CACHE['last_update'] = datetime.now()
    return articles_dict

@app.route('/api/articles', methods=['POST'])
def create_article():
    """Cria um novo artigo"""
    data = request.json
    logging.info(f"Recebido payload create_article: {data}")
    print(f"DEBUG PAYLOAD: {data}") # Console também
    if not data:
        return jsonify({'error': 'Payload JSON inválido ou ausente'}), 400

    title = data.get('title')
    content = data.get('content')
    category_id = data.get('category_id')

    # Validação Explícita
    if not title:
        return jsonify({'error': 'Campo obrigatório ausente: title'}), 400
    if not content:
        return jsonify({'error': 'Campo obrigatório ausente: content'}), 400
    
    
    # Resolução de Categoria (ID ou Nome)
    db = get_db()
    try:
        if category_id:
             # Validate if exists
             if not db.query(Category).filter(Category.id == category_id).first():
                 return jsonify({'error': 'Categoria invalida'}), 400
        else:
            cat_name = data.get('category')
            if cat_name:
                # Try to find by name
                category = db.query(Category).filter(Category.name == cat_name).first()
                if category:
                    category_id = category.id
                else:
                    # Create if not exists (Auto-create for Hybrid Intelligence)
                    new_cat = Category(name=cat_name, description="Criada automaticamente via API")
                    db.add(new_cat)
                    db.commit() # Commit to get ID
                    category_id = new_cat.id
            
            # Fallback final se ainda não tiver ID
            if not category_id:
                general_cat = db.query(Category).filter(Category.name == 'Geral').first()
                if general_cat:
                    category_id = general_cat.id
                else:
                    # Se nem 'Geral' existe, cria ela ou usa 1 (mas 1 pode não existir em DB vazio)
                    # Melhor criar Geral
                    general_cat = Category(name='Geral', description='Categoria Padrão')
                    db.add(general_cat)
                    db.commit()
                    category_id = general_cat.id
                
        article = Article(
            title=title,
            content=content,
            category_id=category_id,
            status='pending' # Novos artigos sempre pendentes
        )
        db.add(article)
        db.flush() # Para pegar o id
        
        if 'tags' in data:
            try:
                tag_names = data['tags'] if isinstance(data['tags'], list) else [t.strip() for t in data['tags'].split(',') if t.strip()]
                for name in tag_names:
                    # Limitar tamanho da tag para evitar erros
                    name = name[:50]
                    tag = db.query(Tag).filter(Tag.name == name).first()
                    if not tag:
                        tag = Tag(name=name)
                        db.add(tag)
                        db.flush()
                    if tag not in article.tags_rel:
                        article.tags_rel.append(tag)
            except Exception as e:
                print(f"⚠️ Erro ao processar tags: {e}")
                # Não falhar a criação do artigo por erro em tags, apenas logar
        
        db.commit()
        # Se o artigo for criado já como aprovado (futuro), invalidar cache
        if article.status == 'approved':
             invalidate_article_cache()

        # Atualizar embedding imediatamente
        try:
            get_ai_service().update_article_embedding(article.to_dict())
        except Exception as e:
            print(f"⚠️ Erro ao atualizar embedding: {e}")
            
        return jsonify(article.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

@app.route('/api/articles/<int:article_id>', methods=['PUT'])
def update_article(article_id):
    """Atualiza um artigo existente"""
    data = request.json
    db = get_db()
    try:
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            return jsonify({'error': 'Artigo não encontrado'}), 404
        
        article.title = data.get('title', article.title)
        article.content = data.get('content', article.content)
        article.category_id = data.get('category_id', article.category_id)
        
        if 'tags' in data:
            tag_names = data['tags'] if isinstance(data['tags'], list) else [t.strip() for t in data['tags'].split(',') if t.strip()]
            # Limpar associações antigas
            article.tags_rel = []
            for name in tag_names:
                tag = db.query(Tag).filter(Tag.name == name).first()
                if not tag:
                    tag = Tag(name=name)
                    db.add(tag)
                    db.flush()
                article.tags_rel.append(tag)
            # Também atualizar a coluna legada por segurança
            article.tags = ','.join(tag_names)
            
        if 'status' in data:
            article.status = data['status']
        
        article.updated_at = datetime.utcnow()
        db.commit()
        
        # Invalidar cache de artigos
        invalidate_article_cache()
        
        # Atualizar embedding
        try:
            get_ai_service().update_article_embedding(article.to_dict())
        except Exception as e:
            print(f"⚠️ Erro ao atualizar embedding: {e}")

        return jsonify(article.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

@app.route('/api/articles/<int:article_id>', methods=['DELETE'])
def delete_article(article_id):
    """Deleta um artigo"""
    db = get_db()
    try:
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            return jsonify({'error': 'Artigo não encontrado'}), 404
        
        # --- FIX: Cascade Delete (Manual) ---
        # 1. Remove interaction logs (likes, dislikes, views)
        from kb_database import InteractionLog
        db.query(InteractionLog).filter(InteractionLog.article_id == article_id).delete()
        
        # 2. Clear tags (Many-to-Many)
        article.tags_rel = []
        
        db.delete(article)
        db.commit()
        invalidate_article_cache()
        return jsonify({'message': 'Artigo e histórico deletados com sucesso'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

@app.route('/api/articles/<int:article_id>/duplicate', methods=['POST'])
@admin_required
def duplicate_article(article_id):
    """Duplica um artigo existente"""
    db = get_db()
    try:
        original = db.query(Article).filter(Article.id == article_id).first()
        if not original:
            return jsonify({'error': 'Artigo não encontrado'}), 404
        
        new_article = Article(
            title=f"{original.title} (Cópia)",
            content=original.content,
            category_id=original.category_id,
            tags=original.tags # Mantém legacy
        )
        # Copiar relacionamentos de tags
        new_article.tags_rel = list(original.tags_rel)
        
        db.add(new_article)
        db.commit()
        
        try:
            get_ai_service().update_article_embedding(new_article.to_dict())
        except: pass
        
        return jsonify(new_article.to_dict()), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

@app.route('/api/articles/<int:article_id>/approve', methods=['PUT'])
@admin_required
def approve_article(article_id):
    """Aprova um artigo pendente"""
    db = get_db()
    try:
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            return jsonify({'error': 'Artigo não encontrado'}), 404
        
        article.status = 'approved'
        db.commit()
        invalidate_article_cache()
        
        try:
            get_ai_service().update_article_embedding(article.to_dict())
        except: pass
            
        return jsonify(article.to_dict())
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

@app.route('/api/articles/delete-all', methods=['DELETE'])
@admin_required
def delete_all_articles():
    """Deleta todos os artigos do banco de dados"""
    db = get_db()
    try:
        db.query(Article).delete()
        db.commit()
        invalidate_article_cache()
        return jsonify({'message': 'Todos os artigos foram deletados com sucesso'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

@app.route('/api/articles/reject-all-pending', methods=['DELETE'])
@admin_required
def reject_all_pending_articles():
    """Rejeita (deleta) todos os artigos pendentes"""
    db = get_db()
    try:
        deleted_count = db.query(Article).filter(Article.status == 'pending').delete()
        db.commit()
        # Se rejeita pendentes, teoricamente não afeta a lista de APPROVED usada pelo chat,
        # mas por segurança invalidamos se status mudar
        return jsonify({'message': f'{deleted_count} artigos pendentes foram rejeitados/excluídos.'})
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 400
    finally:
        db.close()

# ==================== NOVA ROTA: TAGS ====================

@app.route('/api/tags', methods=['GET'])
def list_tags():
    """Lista todas as tags e contagem de artigos"""
    db = get_db()
    try:
        tags = db.query(Tag).all()
        result = []
        for tag in tags:
            # Conta artigos onde esta tag está associada
            # count = db.query(article_tags).filter(article_tags.c.tag_id == tag.id).count() # SQLAlchemy 1.x style
            count = len(tag.articles)
            result.append({
                'id': tag.id,
                'name': tag.name,
                'count': count
            })
        # Ordenar por mais usadas
        result.sort(key=lambda x: x['count'], reverse=True)
        return jsonify(result)
    finally:
        db.close()

@app.route('/api/articles/<int:article_id>/suggest-tags', methods=['POST'])
def suggest_tags_for_article(article_id):
    """Sugere tags para um artigo específico"""
    db = get_db()
    try:
        article = db.query(Article).filter(Article.id == article_id).first()
        if not article:
            return jsonify({'error': 'Artigo não encontrado'}), 404
        
        existing = [t.name for t in article.tags_rel]
        suggested = get_ai_service().suggest_tags(article.title, article.content, existing_tags=existing)
        
        return jsonify({'suggested': suggested})
    finally:
        db.close()

@app.route('/api/tags/suggest', methods=['POST'])
def suggest_tags_generic():
    """Sugere tags para conteúdo avulso (usado na criação de novo artigo)"""
    data = request.json
    if not data:
        return jsonify({'error': 'Payload inválido'}), 400
        
    title = data.get('title', '')
    content = data.get('content', '')
    
    if not title and not content:
        return jsonify({'error': 'É necessário fornecer pelo menos um título ou conteúdo para sugestão de tags'}), 400
        
    suggested = get_ai_service().suggest_tags(title, content)
    return jsonify({'suggested': suggested})

# ==================== ROTAS DE CHAT/IA ====================

@app.route('/api/version', methods=['GET'])
def get_version():
    """Retorna a versão atual da aplicação para verificação de atualizações"""
    print(f"DEBUG: Version check requested. Current: {APP_VERSION}")
    return jsonify({'version': APP_VERSION})

@app.route('/api/status')
def get_status():
    """Retorna status do sistema e da IA"""
    ai_status = get_ai_service().get_active_model_name()
    db_status = "Online"
    db = get_db()
    try:
        # Test DB connection
        db.execute(text("SELECT 1"))
        
        # Obter categorias e contagens
        categories = db.query(Category).all()
        category_stats = []
        for cat in categories:
            # Conta apenas artigos aprovados ou todos? 
            # ComoArticles tem status 'pending', 'approved', 'rejected'
            # No status geral mostramos o total, então aqui mostramos o total por categoria também
            count = db.query(Article).filter_by(category_id=cat.id).count()
            category_stats.append({
                'name': cat.name,
                'count': count
            })
        
        # Ordenar por contagem decrescente
        category_stats.sort(key=lambda x: x['count'], reverse=True)
        
        # Refresh user role from DB if logged in
        user_info = None
        if 'user' in session:
            username = session['user']
            user = db.query(User).filter_by(username=username).first()
            if user:
                if session.get('role') != user.role:
                    session['role'] = user.role
                user_info = user.to_dict()
        
        db.close()
    except Exception as e:
        print(f"Erro em get_status: {e}")
        db_status = "Erro"
        category_stats = []
        user_info = None
        
    return jsonify({
        'ai_model': ai_status,
        'database': db_status,
        'version': '1.0.0',
        'ai_configured': ai_status != "Offline (Busca Manual)",
        'articles_count': db.query(Article).count() if db_status == "Online" else 0,
        'categories_count': len(category_stats) if category_stats else 0,
        'category_stats': category_stats,
        'learned_words': get_ai_service().get_learned_words() if hasattr(get_ai_service(), 'get_learned_words') else [],
        'ai_usage': get_ai_service().generator.get_usage_stats() if hasattr(get_ai_service().generator, 'get_usage_stats') else {},
        'user': user_info
    })

@app.route('/api/chat', methods=['POST'])
def chat():
    """Processa uma pergunta e retorna resposta da IA"""
    data = request.json
    question = data.get('question', '')
    
    if not question:
        return jsonify({'error': 'Pergunta não fornecida'}), 400
    
    db = get_db()
    try:
        # Buscar lista de artigos (Cacheada para performance)
        articles_dict = get_cached_articles(db)

        # Preferência de modelo (opcional)
        preferred_model = data.get('model')

        # Recuperar histórico recente para contexto (últimas 2 interações)
        # Histórico é individual, não cacheado
        recent_history = db.query(ChatHistory).order_by(ChatHistory.created_at.desc()).limit(2).all()
        history_list = [{'question': h.question, 'answer': h.answer} for h in reversed(recent_history)]
        
        # Gerar resposta usando IA com memória
        result = get_ai_service().chat(question, articles_dict, history=history_list, preferred_model=preferred_model)
        
        # VERIFICAR SE HÁ NOVO CONHECIMENTO PARA SALVAR
        if 'new_knowledge' in result:
            nk = result['new_knowledge']
            # Verificar/Criar Categoria
            category = db.query(Category).filter(Category.name == nk['category']).first()
            if not category:
                category = Category(name=nk['category'], description='Termos aprendidos automaticamente via chat')
                db.add(category)
                db.commit()
            
            # Verificar se artigo já existe
            exists = db.query(Article).filter(Article.title == nk['title']).first()
            if not exists:
                new_article = Article(
                    title=nk['title'],
                    content=nk['content'],
                    category_id=category.id,
                    tags=nk['tags'],
                    status='approved' # Auto-approve learned definitions
                )
                db.add(new_article)
                db.commit()
                print(f"🧠 Novo conhecimento salvo no banco: {nk['title']}")
                invalidate_article_cache() # Importante: invalidar cache pois entrou coisa nova aprovada
        
        # Salvar no histórico
        relevant_article_ids = ','.join([str(source['id']) for source in result.get('sources', [])])
        history = ChatHistory(
            question=question,
            answer=result['answer'],
            relevant_articles=relevant_article_ids
        )
        db.add(history)
        db.commit()
        
        return jsonify(result)
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """Retorna histórico de conversas"""
    limit = request.args.get('limit', 50, type=int)
    
    db = get_db()
    try:
        history = db.query(ChatHistory).order_by(ChatHistory.created_at.desc()).limit(limit).all()
        return jsonify([h.to_dict() for h in history])
    finally:
        db.close()

@app.route('/api/learned-words', methods=['GET'])
def list_learned_words_route():
    """Retorna palavras aprendidas (Rota dedicada/Admin)"""
    words = get_ai_service().get_learned_words()
    return jsonify(words)

@app.route('/api/learned-words/<path:word>', methods=['DELETE'])
@admin_required
def delete_learned_word_route(word):
    """Deleta uma palavra aprendida"""
    success = get_ai_service().delete_learned_word(word)
    if success:
        return jsonify({'message': f'Palavra "{word}" removida com sucesso.'})
    else:
        return jsonify({'error': 'Falha ao remover palavra ou não encontrada.'}), 400

@app.route('/api/learned-words', methods=['POST'])
@admin_required
def add_learned_word_route():
    """Adiciona uma nova palavra aprendida"""
    data = request.json
    word = data.get('word')
    
    if not word:
        return jsonify({'error': 'Palavra é obrigatória'}), 400
        
    success = get_ai_service().add_learned_word(word)
    if success:
        return jsonify({'message': f'Palavra "{word}" adicionada com sucesso.'}), 201
    else:
        return jsonify({'error': 'Falha ao adicionar palavra (já existe ou erro interno).'}), 400

@app.route('/api/hybrid/classify', methods=['POST'])
def hybrid_classify_route():
    """Endpoint para motor de inteligência híbrida"""
    data = request.json
    text = data.get('text', '')
    title = data.get('title')
    tags = data.get('tags') or []
    
    if not text:
        return jsonify({'error': 'Texto é obrigatório'}), 400
        
    try:
        # Buscar categorias existentes para dar contexto à IA
        from kb_database import get_db, Category
        db = get_db()
        existing_categories = [c.name for c in db.query(Category).all()]
        db.close()
        
        result = get_ai_service().classify_content(text, title=title, tags=tags, existing_categories=existing_categories)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/hybrid/feedback', methods=['POST'])
def hybrid_feedback_route():
    """Salva feedback de classificação para treino futuro"""
    try:
        data = request.get_json(silent=True) or {}
        feedback_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'training_data.json')
        
        history = []
        if os.path.exists(feedback_file):
            try:
                if os.path.getsize(feedback_file) > 0:
                    with open(feedback_file, 'r', encoding='utf-8') as f:
                        history = json.load(f)
                else: history = []
            except Exception as e:
                print(f"⚠️ Erro ao ler feedback_file, resetando: {e}")
                history = []
            
        # Adicionar novo entry
        entry = {
            'timestamp': datetime.now().isoformat(),
            'text_snippet': data.get('text', '')[:200],
            'neural_output': data.get('neural_output', {}),
            'user_correction': data.get('user_correction', ''),
            'final_decision': data.get('final_decision', '')
        }
        history.append(entry)
        
        # Salvar
        with open(feedback_file, 'w', encoding='utf-8') as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
            
        return jsonify({'status': 'Feedback salvo'})
    except Exception as e:
        print(f"Erro ao salvar feedback: {e}")
        return jsonify({'error': 'Erro ao salvar feedback'}), 500


# ==================== ROTAS DE ANALYTICS (BI) ====================

@app.route('/api/monitor/stats')
@admin_required
def get_analytics_stats():
    """Retorna estatísticas completas para o dashboard de BI"""
    stats = get_ai_service().analytics.get_all_stats()
    return jsonify(stats)

@app.route('/api/monitor/export')
@admin_required
def export_analytics_csv():
    """Exporta logs de busca em CSV para Power BI"""
    from flask import Response
    csv_data = get_ai_service().analytics.export_to_csv()
    
    return Response(
        csv_data,
        mimetype="text/csv",
        headers={"Content-disposition": f"attachment; filename=kb_analytics_{datetime.now().strftime('%Y%m%d')}.csv"}
    )

@app.route('/api/monitor/powerbi')
@admin_required
def get_powerbi_feed():
    """Retorna feed JSON para conexão direta com Power BI"""
    data = get_ai_service().analytics.get_powerbi_data()
    return jsonify(data)

@app.route('/api/monitor/insights')
@admin_required
def get_analytics_insights():
    """Gera insights automáticos com IA sobre os dados"""
    insights = get_ai_service().generate_analytics_insights()
    return jsonify({'insights': insights})

@app.route('/api/monitor/action', methods=['POST'])
def log_analytics_event():
    """Registra eventos de interação (view, like, dislike)"""
    data = request.json
    event_type = data.get('event_type')
    article_id = data.get('article_id')
    
    if not event_type:
        return jsonify({'error': 'Event type required'}), 400
        
    db = get_db()
    try:
        from kb_database import InteractionLog, User
        
        user_id = None
        if 'user' in session:
            user = db.query(User).filter_by(username=session['user']).first()
            if user:
                user_id = user.id
        
        log = InteractionLog(
            event_type=event_type,
            article_id=article_id,
            user_id=user_id,
            metadata_json=json.dumps(data.get('metadata', {}))
        )
        db.add(log)
        db.commit()
        return jsonify({'message': 'Event logged'}), 201
    except Exception as e:
        db.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        db.close()


# ==================== INICIALIZAÇÃO ====================

@app.route('/api/articles/import/word', methods=['POST'])
@admin_required
def import_word():
    """Importa conteúdo de um arquivo Word como artigo"""
    if 'file' not in request.files:
        return jsonify({'error': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    category_id = request.form.get('category_id')
    
    if file.filename == '':
        return jsonify({'error': 'Arquivo sem nome'}), 400
    
    if not file.filename.endswith('.docx'):
        return jsonify({'error': 'Apenas arquivos .docx são suportados'}), 400

    try:
        # Ler o arquivo Word
        import docx
        from flask import current_app
        import hashlib
        import re
        
        doc = docx.Document(file)
        
        # O título base será o nome do arquivo
        base_title = os.path.splitext(file.filename)[0]
        
        # Cache de imagens salvas para evitar duplicatas (hash -> url)
        saved_images_cache = {}

        def save_count_image(image_part):
            """Salva o blob da imagem e retorna a URL"""
            if not image_part: return None
            
            try:
                image_data = image_part.blob
                content_type = image_part.content_type
                # Detecção básica de extensão
                ext = 'png'
                if content_type:
                    if 'jpeg' in content_type: ext = 'jpg'
                    elif 'png' in content_type: ext = 'png'
                    elif 'gif' in content_type: ext = 'gif'
                
                # Check cache
                img_hash = hashlib.md5(image_data).hexdigest()
                filename = f"import_{img_hash}.{ext}"
                
                # Se já processamos essa imagem neste request ou existe no disco
                filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
                
                if not os.path.exists(filepath):
                    with open(filepath, 'wb') as f:
                        f.write(image_data)
                
                return f"/static/uploads/{filename}"
            except Exception as e:
                print(f"Erro ao salvar imagem: {e}")
                return None

        full_content = []
        
        # Regex para encontrar r:embed no XML do run
        rel_pattern = re.compile(r'r:embed="([^"]+)"')
        
        for para in doc.paragraphs:
            para_content = ""
            
            # Iterar pelos Runs do parágrafo para manter a ordem Texto -> Imagem -> Texto
            for run in para.runs:
                # 1. Texto do run
                text = run.text
                if text:
                    para_content += text
                
                # 2. Imagens no run
                if 'w:drawing' in run._element.xml:
                    # Encontrar todos os embeds
                    rIds = rel_pattern.findall(run._element.xml)
                    for rId in rIds:
                        # Tenta encontrar a part da imagem
                        target_part = None
                        
                        # Tentar via part do parágrafo (padrão)
                        if rId in para.part.rels:
                            if "image" in para.part.rels[rId].target_ref:
                                target_part = para.part.rels[rId].target_part
                        
                        # Fallback: Tentar via part do documento principal
                        if not target_part and rId in doc.part.rels:
                             if "image" in doc.part.rels[rId].target_ref:
                                target_part = doc.part.rels[rId].target_part
                                
                        if target_part:
                            url = save_count_image(target_part)
                            if url:
                                # Quebra de linha antes e depois da imagem para block element no markdown
                                para_content += f"\n\n![Imagem Importada]({url})\n\n"
            
            if para_content.strip():
                full_content.append(para_content.strip())
    
        if not full_content:
             return jsonify({'error': 'Arquivo Word vazio ou sem conteúdo legível'}), 400

        # Agrupamento Inteligente
        chunks = []
        current_chunk = []
        current_length = 0
        
        for item in full_content:
            current_chunk.append(item)
            current_length += len(item)
            
            if current_length > 2000: 
                chunks.append('\n\n'.join(current_chunk))
                current_chunk = []
                current_length = 0
                
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))

        # Salvar artigo(s)
        db = get_db()
        try:
            imported_count = 0
            base_category_id = int(category_id) if category_id else 1
            
            for i, content in enumerate(chunks):
                title = f"{base_title} (Parte {i+1})" if len(chunks) > 1 else base_title
                
                new_article = Article(
                    title=title,
                    content=content,
                    category_id=base_category_id,
                    tags=f"importado, word, {base_title}",
                    status='approved'
                )
                db.add(new_article)
                imported_count += 1
            
            db.commit()
            invalidate_article_cache()
            
            return jsonify({
                'message': f'Documento importado com sucesso! Criados {imported_count} fragmentos com imagens.',
                'count': imported_count
            }), 201
            
        except Exception as e:
            db.rollback()
            raise e
        finally:
            db.close()
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Erro ao processar arquivo: {str(e)}'}), 500

@app.route('/debug-ollama')
def debug_ollama():
    import socket
    import urllib.request
    import json
    
    results = {
        "socket_module": str(socket),
        "socket_class": str(socket.socket),
        "test_127": "Not run",
        "test_localhost": "Not run",
        "error": None
    }
    
    # Test 127.0.0.1
    try:
        url = "http://127.0.0.1:11434/api/tags"
        with urllib.request.urlopen(url, timeout=2) as response:
            results["test_127"] = f"Success: {response.getcode()}"
    except Exception as e:
        results["test_127"] = f"Failed: {e}"

    # Test localhost
    try:
        url = "http://localhost:11434/api/tags"
        with urllib.request.urlopen(url, timeout=2) as response:
             results["test_localhost"] = f"Success: {response.getcode()}"
    except Exception as e:
        results["test_localhost"] = f"Failed: {e}"

    # Test External (Google)
    try:
        url = "http://www.google.com"
        with urllib.request.urlopen(url, timeout=2) as response:
             results["test_external"] = f"Success: {response.getcode()}"
    except Exception as e:
        results["test_external"] = f"Failed: {e}"

    return jsonify(results)

if __name__ == '__main__':
    print("\n" + "="*50)
    print("🚀 Base de Conhecimento com IA")
    print("="*50)
    print("📊 Servidor inicializando...")
    print("🤖 IA Status: Servidor pronto (IA carregará sob demanda)")
    print("="*50 + "\n")

    # Inicializar banco de dados na partida
    init_db()

    # Sincronizar embeddings na inicialização
    with app.app_context():
        try:
            db = get_db()
            all_articles = db.query(Article).all()
            articles_list = [a.to_dict() for a in all_articles]
            get_ai_service().sync_embeddings(articles_list)
            db.close()
        except Exception as e:
            print(f"⚠️ Erro ao sincronizar embeddings: {e}")
            
    # --- DIAGNÓSTICO DE INICIALIZAÇÃO KRAKEN (DESATIVADO) ---
    # O usuário optou por não usar Ollama Local.
    # print("\n🔍 Executando diagnóstico de rede (Kraken)...")
    print("------------------------------------------\n")
    # -------------------------------------------
    
    import socket
    # Port configuration - Use 3000 as requested 
    PORT = int(os.getenv('PORT', 3000))
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        print(f"🌍 ACESSO LOCAL (Você): http://localhost:{PORT}")
        
        if local_ip.startswith('172.'):
            print(f"🐳 RODANDO NO DOCKER: Acesse via http://localhost:{PORT}")
        else:
            print(f"📡 ACESSO PARA COLEGAS: http://{local_ip}:{PORT}")
    except:
        print(f"🌍 ACESSO LOCAL: http://localhost:{PORT}")
        
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() in ('true', '1', 't')
    app.run(debug=debug_mode, port=PORT, host='0.0.0.0')
