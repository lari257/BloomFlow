import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration for Bouquet Service"""
    
    # Service URLs
    AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:5000')
    INVENTORY_SERVICE_URL = os.getenv('INVENTORY_SERVICE_URL', 'http://inventory-service:5000')
    
    # Flask Configuration
    FLASK_ENV = os.getenv('FLASK_ENV', 'production')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    # Bouquet Configuration
    MIN_FLOWERS_PER_BOUQUET = 3
    MAX_FLOWERS_PER_BOUQUET = 20
    MIN_FLOWER_TYPES = 2
    MAX_FLOWER_TYPES = 8

