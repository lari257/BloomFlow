"""
Configuration for Bouquet Worker
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration for Bouquet Worker"""
    
    # RabbitMQ Configuration
    RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
    RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', '5672'))
    RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'bloomflow')
    RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD', 'rabbitmq123')
    BOUQUET_QUEUE_NAME = os.getenv('BOUQUET_QUEUE_NAME', 'bouquet_assembly')
    NOTIFICATION_QUEUE_NAME = os.getenv('NOTIFICATION_QUEUE_NAME', 'notifications')
    
    # Service URLs
    ORDER_SERVICE_URL = os.getenv('ORDER_SERVICE_URL', 'http://order-service:5000')
    INVENTORY_SERVICE_URL = os.getenv('INVENTORY_SERVICE_URL', 'http://inventory-service:5000')
    
    # Database Configuration (for direct status updates)
    DATABASE_URL = os.getenv('DATABASE_URL')
    
    # If DATABASE_URL is not set, construct it from components
    if not DATABASE_URL:
        POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', '')
        POSTGRES_USER = os.getenv('POSTGRES_USER', 'bloomflow')
        POSTGRES_DB = os.getenv('POSTGRES_DB', 'bloomflow') + '_orders'
        POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'postgres')
        POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')
        
        DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"

