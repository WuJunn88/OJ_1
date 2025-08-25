#配置 SQLAlchemy 连接，使用和主服务相同的数据库，创建会话供判题服务操作数据库。
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
import os
from urllib.parse import quote_plus

# 使用与主服务相同的数据库配置逻辑
db_uri = os.getenv('DATABASE_URL')
if not db_uri:
    # 如果设置了MySQL相关环境变量，使用MySQL
    if os.getenv('DB_USER') and os.getenv('DB_PASSWORD'):
        db_user = os.getenv('DB_USER')
        db_pass = os.getenv('DB_PASSWORD')
        db_host = os.getenv('DB_HOST', '127.0.0.1')
        db_port = os.getenv('DB_PORT', '3306')
        db_name = os.getenv('DB_NAME', 'oj_system')
        db_uri = f"mysql+pymysql://{quote_plus(db_user)}:{quote_plus(db_pass)}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"
    else:
        # 否则使用SQLite数据库（与main-service共享同一个文件）
        import os
        current_dir = os.path.dirname(os.path.abspath(__file__))
        backend_root = os.path.dirname(current_dir)
        project_root = os.path.dirname(backend_root)
        db_path = os.path.join(project_root, 'judger.db')
        db_uri = f"sqlite:///{db_path}"
        print(f"Judge服务使用SQLite数据库: {db_path}")
engine = create_engine(db_uri)
Session = scoped_session(sessionmaker(bind=engine))