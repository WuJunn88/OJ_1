#初始化 Flask-SQLAlchemy 的 db 对象，提供 init_db 函数在 app 上下文里创建表。
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_db(app):
    with app.app_context():
        db.create_all()