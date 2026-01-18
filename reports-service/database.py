"""
Database connections for Reports Service
Connects to PostgreSQL read replica
"""
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import create_engine, text
from config import Config

# SQLAlchemy instance for main database
db = SQLAlchemy()

def init_db(app):
    """Initialize database connection"""
    app.config['SQLALCHEMY_DATABASE_URI'] = Config.DATABASE_URL
    db.init_app(app)
    return db

def get_orders_connection():
    """Get direct connection to orders database (read replica)"""
    engine = create_engine(Config.DATABASE_ORDERS_URL)
    return engine.connect()

def get_inventory_connection():
    """Get direct connection to inventory database (read replica)"""
    engine = create_engine(Config.DATABASE_INVENTORY_URL)
    return engine.connect()

def get_main_connection():
    """Get direct connection to main database (read replica)"""
    engine = create_engine(Config.DATABASE_URL)
    return engine.connect()

def execute_query(connection_func, query, params=None):
    """Execute a read-only query on the specified database"""
    try:
        with connection_func() as conn:
            result = conn.execute(text(query), params or {})
            columns = result.keys()
            rows = result.fetchall()
            return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        print(f"Query error: {e}")
        return []
