from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()

class Category(Base):
    """Modelo para categorias de artigos"""
    __tablename__ = 'categories'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    articles = relationship('Article', back_populates='category')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'article_count': len(self.articles),
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Tabela de associação para relacionamento Muitos-para-Muitos entre Artigos e Tags
article_tags = Table(
    'article_tags',
    Base.metadata,
    Column('article_id', Integer, ForeignKey('articles.id'), primary_key=True),
    Column('tag_id', Integer, ForeignKey('tags.id'), primary_key=True)
)

class Tag(Base):
    """Modelo para tags de artigos"""
    __tablename__ = 'tags'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    articles = relationship('Article', secondary=article_tags, back_populates='tags_rel')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Article(Base):
    """Modelo para artigos da base de conhecimento"""
    __tablename__ = 'articles'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id'))
    tags = Column(String(500))  # Tags separadas por vírgula
    status = Column(String(20), default='pending') # pending, approved, rejected
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    
    category = relationship('Category', back_populates='articles')
    tags_rel = relationship('Tag', secondary=article_tags, back_populates='articles')
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'category_id': self.category_id,
            'category_name': self.category.name if self.category else None,
            'tags': [t.name for t in self.tags_rel] if self.tags_rel else (self.tags.split(',') if self.tags else []),
            'legacy_tags': self.tags,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class User(Base):
    """Modelo para usuários do sistema"""
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    role = Column(String(20), default='user')
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class ChatHistory(Base):
    """Modelo para histórico de conversas"""
    __tablename__ = 'chat_history'
    
    id = Column(Integer, primary_key=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    relevant_articles = Column(Text)  # IDs dos artigos relevantes, separados por vírgula
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'question': self.question,
            'answer': self.answer,
            'relevant_articles': self.relevant_articles.split(',') if self.relevant_articles else [],
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class SearchLog(Base):
    """Modelo para log de buscas (Analytics)"""
    __tablename__ = 'search_logs'
    
    id = Column(Integer, primary_key=True)
    term = Column(Text, nullable=False)
    source = Column(String(50))  # 'chat' ou 'search_bar'
    results_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'term': self.term,
            'source': self.source,
            'results_count': self.results_count,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# Configuração do banco de dados
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///knowledge_base.db')

# Fix for Docker: When running in a container, localhost refers to the container itself.
# We need to point to the host machine.
if os.path.exists('/.dockerenv') and 'localhost' in DATABASE_URL:
    print("🐳 Detectado ambiente Docker: Ajustando conexão para host.docker.internal")
    DATABASE_URL = DATABASE_URL.replace('localhost', 'host.docker.internal')

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

def init_db():
    """Inicializa o banco de dados e cria as tabelas"""
    print(f"Connecting to DB: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'SQLite Local'}")
    Base.metadata.create_all(engine)
    print("Database initialized successfully!")
    
    # Criar categorias padrão se não existirem
    session = SessionLocal()
    try:
        if session.query(Category).count() == 0:
            default_categories = [
                Category(name='Geral', description='Artigos gerais'),
                Category(name='Técnico', description='Documentação técnica'),
                Category(name='FAQ', description='Perguntas frequentes'),
                Category(name='Tutoriais', description='Guias passo a passo'),
            ]
            session.add_all(default_categories)
            session.commit()
            print("Default categories created!")
            
            # Criar usuário admin padrão se não existir (LEGADO)
            if session.query(User).filter_by(username='admin').count() == 0:
                print("Creating default admin user...")
                admin_pass = os.getenv('ADMIN_PASSWORD')
                if admin_pass:
                    from werkzeug.security import generate_password_hash
                    default_user = User(
                        username='admin',
                        password_hash=generate_password_hash(admin_pass),
                        role='admin'
                    )
                    session.add(default_user)
                    session.commit()
                    print("Admin user created successfully")
                else:
                    print("WARNING: ADMIN_PASSWORD not defined. Admin user NOT created.")

            # Criar usuário SUPER ADMIN solicitado
            target_email = 'jose.augusto.n.borges@gmail.com'
            if session.query(User).filter_by(username=target_email).count() == 0:
                print(f"Creating Super Admin: {target_email}...")
                super_admin_pass = os.getenv('SUPER_ADMIN_PASSWORD')
                if super_admin_pass:
                    from werkzeug.security import generate_password_hash
                    super_admin = User(
                        username=target_email,
                        password_hash=generate_password_hash(super_admin_pass),
                        role='super_admin' # Acesso Total e Irrestrito
                    )
                    session.add(super_admin)
                    session.commit()
                    print(f"Super Admin '{target_email}' created successfully with role 'super_admin'!")
                else:
                     print(f"WARNING: SUPER_ADMIN_PASSWORD not defined. Super Admin NOT created.")
            
    except Exception as e:
        print(f"Error initializing data: {e}")
        session.rollback()
    finally:
        session.close()

class InteractionLog(Base):
    """Modelo para log de interações (Cliques, Likes, Dislikes)"""
    __tablename__ = 'interaction_logs'
    
    id = Column(Integer, primary_key=True)
    article_id = Column(Integer, ForeignKey('articles.id'), nullable=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    event_type = Column(String(50), nullable=False) # 'view', 'like', 'dislike'
    metadata_json = Column(String, nullable=True) # JSON extra info
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'article_id': self.article_id,
            'user_id': self.user_id,
            'event_type': self.event_type,
            'created_at': self.created_at.isoformat()
        }

def get_db():
    """Retorna uma sessão do banco de dados"""
    db = SessionLocal()
    try:
        return db
    finally:
        pass

if __name__ == '__main__':
    init_db()
