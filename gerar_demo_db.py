import os
from datetime import datetime, timedelta
import random

# Forçar uso do banco na pasta demo
os.environ['DATABASE_URL'] = 'sqlite:///kb_data.db'

from kb_database import init_db, get_db, User, Category, Article, SearchLog, ChatHistory, InteractionLog, Tag
from werkzeug.security import generate_password_hash

def populate_fake_data():
    print("🚀 Iniciando criação do banco de dados de demonstração (kb_data.db)...")
    
    # Inicializa o banco (cria as tabelas)
    init_db()
    db = get_db()
    
    try:
        # 1. Limpar banco se já existir algo
        db.query(InteractionLog).delete()
        db.query(ChatHistory).delete()
        db.query(SearchLog).delete()
        db.query(Article).delete()
        db.query(Category).delete()
        db.query(User).delete()
        db.query(Tag).delete()
        
        # 2. Criar Usuário Admin Padrão
        admin = User(
            username='admin',
            password_hash=generate_password_hash('admin123'),
            role='super_admin'
        )
        db.add(admin)
        print("✅ Usuário 'admin' (senha: admin123) criado.")

        # 3. Criar Categorias
        cat_rh = Category(name='Recursos Humanos', description='Políticas e Procedimentos de RH')
        cat_ti = Category(name='Tecnologia da Informação', description='Guias técnicos e tutoriais')
        cat_vendas = Category(name='Vendas', description='Materiais e scripts de vendas')
        db.add_all([cat_rh, cat_ti, cat_vendas])
        db.commit() # Commit para pegar IDs
        print("✅ Categorias 'RH', 'TI' e 'Vendas' criadas.")

        # 4. Criar Tags
        tag_ferias = Tag(name='ferias')
        tag_vpn = Tag(name='vpn')
        tag_rede = Tag(name='rede')
        tag_prospeccao = Tag(name='prospeccao')
        db.add_all([tag_ferias, tag_vpn, tag_rede, tag_prospeccao])
        db.commit()

        # 5. Criar Artigos Fictícios
        now = datetime.utcnow()
        artigos = [
            Article(
                title='Política de Férias 2026',
                content='Para solicitar férias, o colaborador deve preencher o formulário no portal interno com 30 dias de antecedência. É permitido vender até 10 dias das férias.',
                category_id=cat_rh.id,
                status='approved',
                created_at=now - timedelta(days=20),
                updated_at=now - timedelta(days=20),
                tags='ferias,rh'
            ),
            Article(
                title='Como configurar a VPN',
                content='Para acessar a rede interna de casa, baixe o cliente OpenVPN, use a credencial do Windows, e conecte-se ao servidor vpn.empresa.com.br porta 1194.',
                category_id=cat_ti.id,
                status='approved',
                created_at=now - timedelta(days=15),
                updated_at=now - timedelta(days=15),
                tags='vpn,rede,ti'
            ),
            Article(
                title='Script de Abordagem Média Empresa',
                content='Olá, [Nome]. Notei que sua empresa atua no setor X. Nós ajudamos empresas como a sua a reduzir custos em 20%. Você teria 10 minutos amanhã para conversarmos?',
                category_id=cat_vendas.id,
                status='approved',
                created_at=now - timedelta(days=10),
                updated_at=now - timedelta(days=10),
                tags='prospeccao,script'
            )
        ]
        
        # Associa tags via relacionamento (SQLAlchemy Many-to-Many)
        artigos[0].tags_rel.append(tag_ferias)
        artigos[1].tags_rel.append(tag_vpn)
        artigos[1].tags_rel.append(tag_rede)
        artigos[2].tags_rel.append(tag_prospeccao)
        
        db.add_all(artigos)
        db.commit()
        print("✅ Artigos Fictícios inseridos.")

        # 6. Gerar histórico falso pro Analytics (Pesquisas)
        print("✅ Gerando tráfego falso pro Analytics...")
        termos = ['vpn', 'senha', 'férias', 'vpn', 'wifi', 'férias', 'vpn', 'vendas', 'email']
        for i in range(50): # 50 pesquisas simuladas
            log = SearchLog(
                term=random.choice(termos),
                source='search_bar',
                results_count=random.randint(0, 3),
                created_at=now - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23))
            )
            db.add(log)
            
        # 7. Gerar interações falsas (Views e Likes)
        for artigo in artigos:
            # Views
            for _ in range(random.randint(5, 20)):
                db.add(InteractionLog(event_type='view', article_id=artigo.id, created_at=now - timedelta(days=random.randint(0, 7))))
            # Likes
            for _ in range(random.randint(0, 10)):
                db.add(InteractionLog(event_type='like', article_id=artigo.id, created_at=now - timedelta(days=random.randint(0, 7))))
                
        db.commit()
        print("🎉 Banco de dados Fake populado com sucesso em 'kb_data.db'!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Erro ao popular banco: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    populate_fake_data()
