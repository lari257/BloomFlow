import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration for User Service"""
    
    # Database Configuration
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    # If DATABASE_URL is not set, construct it from components
    if not DATABASE_URL:
        POSTGRES_PASSWORD_FILE = os.getenv('POSTGRES_PASSWORD_FILE', '/run/secrets/postgres_password')
        
        # Read password from file if available (Docker Swarm secret)
        if os.path.exists(POSTGRES_PASSWORD_FILE):
            with open(POSTGRES_PASSWORD_FILE, 'r') as f:
                POSTGRES_PASSWORD = f.read().strip()
        else:
            POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', '')
        
        POSTGRES_USER = os.getenv('POSTGRES_USER', 'bloomflow')
        POSTGRES_DB = os.getenv('POSTGRES_DB', 'bloomflow')
        POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'postgres')
        POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
        
        DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
    
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Auth Service Configuration
    AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:5000')
    
    # Flask Configuration
    FLASK_ENV = os.getenv('FLASK_ENV', 'production')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

