"""
RabbitMQ Publisher for Notifications
Publishes order notification events to the notifications queue
"""
import pika
import json
import logging
import sys
from config import Config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)
config = Config()

class NotificationPublisher:
    """Publisher for sending notification events to RabbitMQ"""
    
    def __init__(self):
        self.connection = None
        self.channel = None
        self.config = config
        self.connect()
        if not self.connection:
            logger.warning("Notification publisher initialized but connection failed. Will retry on first publish.")
    
    def connect(self):
        """Connect to RabbitMQ"""
        try:
            logger.info(f"Attempting to connect to RabbitMQ at {config.RABBITMQ_HOST}:{config.RABBITMQ_PORT}")
            
            credentials = pika.PlainCredentials(
                config.RABBITMQ_USER,
                config.RABBITMQ_PASSWORD
            )
            parameters = pika.ConnectionParameters(
                host=config.RABBITMQ_HOST,
                port=config.RABBITMQ_PORT,
                credentials=credentials,
                heartbeat=600,
                blocked_connection_timeout=300,
                connection_attempts=3,
                retry_delay=2
            )
            
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            
            # Declare notification queue (durable to survive broker restarts)
            self.channel.queue_declare(
                queue=config.NOTIFICATION_QUEUE_NAME,
                durable=True
            )
            
            logger.info(f"Successfully connected to RabbitMQ at {config.RABBITMQ_HOST}:{config.RABBITMQ_PORT}")
            
        except pika.exceptions.AMQPConnectionError as e:
            logger.error(f"Failed to connect to RabbitMQ (connection error): {e}")
            logger.error(f"Check if RabbitMQ is running at {config.RABBITMQ_HOST}:{config.RABBITMQ_PORT}")
            self.connection = None
            self.channel = None
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {type(e).__name__}: {e}")
            self.connection = None
            self.channel = None
    
    def publish_notification(self, notification_type, order_id, user_id):
        """
        Publish a notification event to RabbitMQ
        
        Args:
            notification_type (str): Type of notification ('order_confirmed', 'order_paid', 'order_completed')
            order_id (int): ID of the order
            user_id (int): ID of the user to notify
        
        Returns:
            bool: True if successful, False otherwise
        """
        # Check if connection is needed or broken
        if not self.connection or self.connection.is_closed or not self.channel or self.channel.is_closed:
            logger.warning("RabbitMQ connection not available, attempting to reconnect...")
            self.connect()
            if not self.channel:
                logger.error("Failed to reconnect to RabbitMQ. Check if RabbitMQ is running and accessible.")
                return False
        
        try:
            message = {
                'type': notification_type,
                'order_id': order_id,
                'user_id': user_id
            }
            
            # Publish message with persistence
            self.channel.basic_publish(
                exchange='',
                routing_key=config.NOTIFICATION_QUEUE_NAME,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                )
            )
            
            logger.info(f"Published notification event '{notification_type}' for order {order_id} to RabbitMQ")
            return True
            
        except Exception as e:
            logger.error(f"Error publishing notification event '{notification_type}' for order {order_id}: {e}")
            return False
    
    def close(self):
        """Close connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()

# Global notification publisher instance
_notification_publisher = None

def get_notification_publisher():
    """Get or create global notification publisher instance"""
    global _notification_publisher
    if _notification_publisher is None:
        _notification_publisher = NotificationPublisher()
    return _notification_publisher
