"""
Configuration for Notification Service
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration"""
    
    # RabbitMQ Configuration
    RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'rabbitmq')
    RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', 5672))
    RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'bloomflow')
    RABBITMQ_PASSWORD = os.getenv('RABBITMQ_PASSWORD', 'bloomflow_pass')
    
    # Queue names for different notification types
    NOTIFICATION_QUEUE_NAME = os.getenv('NOTIFICATION_QUEUE_NAME', 'notifications')
    
    # Email Configuration
    MAIL_SERVER = os.getenv('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
    MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'True').lower() in ['true', '1', 'yes']
    MAIL_USERNAME = os.getenv('MAIL_USERNAME', 'your-email@gmail.com')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD', 'your-app-password')
    MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@bloomflow.com')
    
    # Service URLs for fetching additional data
    USER_SERVICE_URL = os.getenv('USER_SERVICE_URL', 'http://user-service:5000')
    ORDER_SERVICE_URL = os.getenv('ORDER_SERVICE_URL', 'http://order-service:5000')
    INVENTORY_SERVICE_URL = os.getenv('INVENTORY_SERVICE_URL', 'http://inventory-service:5000')
    
    # Flask Configuration
    DEBUG = os.getenv('FLASK_ENV', 'production') == 'development'
