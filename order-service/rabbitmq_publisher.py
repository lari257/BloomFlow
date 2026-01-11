"""
RabbitMQ Publisher for Order Service
Publishes bouquet assembly tasks to RabbitMQ queue
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

class RabbitMQPublisher:
    """Publisher for sending messages to RabbitMQ"""
    
    def __init__(self):
        self.connection = None
        self.channel = None
        self.config = config
        self.connect()
        if not self.connection:
            logger.warning("RabbitMQ publisher initialized but connection failed. Will retry on first publish.")
    
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
            
            # Declare queue (durable to survive broker restarts)
            self.channel.queue_declare(
                queue=config.BOUQUET_QUEUE_NAME,
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
            # Set to None so we can retry later
            self.connection = None
            self.channel = None
    
    def publish_assembly_task(self, order_id, items):
        """
        Publish a bouquet assembly task to RabbitMQ
        
        Args:
            order_id: ID of the order
            items: List of order items with flower_type_id and quantity
        
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
                'order_id': order_id,
                'items': items
            }
            
            # Publish message with persistence
            self.channel.basic_publish(
                exchange='',
                routing_key=config.BOUQUET_QUEUE_NAME,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                )
            )
            
            logger.info(f"Published assembly task for order {order_id} to RabbitMQ")
            return True
            
        except Exception as e:
            logger.error(f"Error publishing assembly task for order {order_id}: {e}")
            return False
    
    def close(self):
        """Close connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()

# Global publisher instance
_publisher = None

def get_publisher():
    """Get or create global publisher instance"""
    global _publisher
    if _publisher is None:
        _publisher = RabbitMQPublisher()
    return _publisher

