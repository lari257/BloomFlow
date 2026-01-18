"""
Configuration for Reports Service
Uses PostgreSQL read replica for all queries
"""
import os


class Config:
    """Configuration class for reports service"""
    
    # Database URLs - connect to READ REPLICA
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://bloomflow:password@postgres-replica:5432/bloomflow')
    DATABASE_ORDERS_URL = os.getenv('DATABASE_ORDERS_URL', 'postgresql://bloomflow:password@postgres-replica:5432/bloomflow_orders')
    DATABASE_INVENTORY_URL = os.getenv('DATABASE_INVENTORY_URL', 'postgresql://bloomflow:password@postgres-replica:5432/bloomflow_inventory')
    
    # Auth service
    AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:5000')
    
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'reports-secret-key')
    FLASK_ENV = os.getenv('FLASK_ENV', 'production')
    
    # SQLAlchemy
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
