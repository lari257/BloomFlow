"""
Bouquet Assembly Worker
Processes bouquet assembly tasks from RabbitMQ queue
"""
import pika
import json
import time
import sys
import requests
from config import Config
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

config = Config()

class BouquetWorker:
    """Worker that processes bouquet assembly tasks from RabbitMQ"""
    
    def __init__(self):
        self.config = config
        self.connection = None
        self.channel = None
        self.notification_channel = None
        self.db_engine = None
        self.db_session = None
        self.init_database()
        self.connect()
    
    def init_database(self):
        """Initialize database connection for updating order status"""
        try:
            self.db_engine = create_engine(config.DATABASE_URL)
            Session = sessionmaker(bind=self.db_engine)
            self.db_session = Session()
            logger.info("Database connection initialized")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            # Continue anyway - we can still process tasks
    
    def connect(self):
        """Connect to RabbitMQ"""
        max_retries = 5
        retry_delay = 5
        
        for attempt in range(max_retries):
            try:
                credentials = pika.PlainCredentials(
                    config.RABBITMQ_USER,
                    config.RABBITMQ_PASSWORD
                )
                parameters = pika.ConnectionParameters(
                    host=config.RABBITMQ_HOST,
                    port=config.RABBITMQ_PORT,
                    credentials=credentials,
                    heartbeat=600,
                    blocked_connection_timeout=300
                )
                
                self.connection = pika.BlockingConnection(parameters)
                self.channel = self.connection.channel()
                
                # Declare queue (durable to survive broker restarts)
                self.channel.queue_declare(
                    queue=config.BOUQUET_QUEUE_NAME,
                    durable=True
                )
                
                logger.info(f"Connected to RabbitMQ at {config.RABBITMQ_HOST}:{config.RABBITMQ_PORT}")
                
                # Create a separate channel for publishing notifications
                try:
                    self.notification_channel = self.connection.channel()
                    self.notification_channel.queue_declare(
                        queue=config.NOTIFICATION_QUEUE_NAME,
                        durable=True
                    )
                    logger.info(f"Notification channel ready for queue '{config.NOTIFICATION_QUEUE_NAME}'")
                except Exception as e:
                    logger.warning(f"Could not setup notification channel: {e}")
                    self.notification_channel = None
                
                return
                
            except Exception as e:
                logger.error(f"Failed to connect to RabbitMQ (attempt {attempt + 1}/{max_retries}): {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                else:
                    logger.error("Max retries reached. Exiting.")
                    sys.exit(1)
    
    def process_assembly_task(self, order_id, items):
        """
        Process a bouquet assembly task
        
        Args:
            order_id: ID of the order to assemble
            items: List of order items (flower_type_id, quantity)
        
        Returns:
            bool: True if successful, False otherwise
        """
        logger.info(f"Processing assembly task for order {order_id}")
        
        try:
            # Simulate bouquet assembly process
            # In a real scenario, this would involve:
            # - Physical assembly of flowers
            # - Quality checks
            # - Packaging
            # - etc.
            
            # Calculate assembly time based on complexity (number of items)
            # Base time + additional time per item type
            base_time = 3  # Base assembly time in seconds
            time_per_item = 1  # Additional seconds per item type
            assembly_time = base_time + (len(items) * time_per_item)
            
            # Cap the assembly time for testing purposes
            assembly_time = min(assembly_time, 10)
            
            logger.info(f"Assembling bouquet for order {order_id} with {len(items)} item types (estimated time: {assembly_time}s)...")
            
            # Simulate the assembly work in stages
            stages = ['Selecting flowers', 'Arranging bouquet', 'Quality check', 'Packaging']
            time_per_stage = assembly_time / len(stages)
            
            for stage in stages:
                logger.info(f"Order {order_id}: {stage}...")
                time.sleep(time_per_stage)
            
            # Get user_id from database before updating status
            user_id = self.get_order_user_id(order_id)
            
            # Update order status to 'completed'
            self.update_order_status(order_id, 'completed')
            
            # Publish notification for completed order
            if user_id:
                self.publish_notification('order_completed', order_id, user_id)
            
            logger.info(f"Successfully assembled bouquet for order {order_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error processing assembly task for order {order_id}: {e}")
            # Update order status to indicate failure
            try:
                self.update_order_status(order_id, 'processing')
            except:
                pass
            return False
    
    def update_order_status(self, order_id, status):
        """Update order status directly in database"""
        try:
            if not self.db_session:
                logger.warning("Database session not available, skipping status update")
                return
            
            # Update order status
            query = text("""
                UPDATE orders 
                SET status = :status, updated_at = NOW()
                WHERE id = :order_id
            """)
            
            self.db_session.execute(query, {'status': status, 'order_id': order_id})
            self.db_session.commit()
            
            logger.info(f"Order {order_id} status updated to {status}")
                
        except Exception as e:
            logger.error(f"Error updating order status: {e}")
            if self.db_session:
                self.db_session.rollback()
    
    def get_order_user_id(self, order_id):
        """Get the user_id for an order from the database"""
        try:
            if not self.db_session:
                logger.warning("Database session not available")
                return None
            
            query = text("SELECT user_id FROM orders WHERE id = :order_id")
            result = self.db_session.execute(query, {'order_id': order_id}).fetchone()
            
            if result:
                return result[0]
            return None
            
        except Exception as e:
            logger.error(f"Error getting user_id for order {order_id}: {e}")
            return None
    
    def publish_notification(self, notification_type, order_id, user_id):
        """Publish a notification to the notifications queue"""
        try:
            if not self.notification_channel:
                logger.warning("Notification channel not available, skipping notification")
                return False
            
            message = {
                'type': notification_type,
                'order_id': order_id,
                'user_id': user_id
            }
            
            self.notification_channel.basic_publish(
                exchange='',
                routing_key=config.NOTIFICATION_QUEUE_NAME,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2  # Make message persistent
                )
            )
            
            logger.info(f"Published {notification_type} notification for order {order_id} to user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error publishing notification: {e}")
            return False
    
    def on_message(self, ch, method, properties, body):
        """Callback for processing messages from RabbitMQ"""
        try:
            # Parse message
            message = json.loads(body)
            order_id = message.get('order_id')
            items = message.get('items', [])
            
            if not order_id:
                logger.error("Invalid message: missing order_id")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                return
            
            logger.info(f"Received assembly task for order {order_id}")
            
            # Process the assembly task
            success = self.process_assembly_task(order_id, items)
            
            if success:
                # Acknowledge message
                ch.basic_ack(delivery_tag=method.delivery_tag)
                logger.info(f"Completed assembly task for order {order_id}")
            else:
                # Reject and requeue (or send to dead letter queue)
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
                logger.warning(f"Failed to process order {order_id}, requeuing...")
                
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)
    
    def start_consuming(self):
        """Start consuming messages from the queue"""
        # Set QoS to process one message at a time per worker
        self.channel.basic_qos(prefetch_count=1)
        
        # Start consuming
        self.channel.basic_consume(
            queue=config.BOUQUET_QUEUE_NAME,
            on_message_callback=self.on_message
        )
        
        logger.info(f"Worker started. Waiting for messages on queue '{config.BOUQUET_QUEUE_NAME}'...")
        logger.info("Press CTRL+C to exit")
        
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("Stopping worker...")
            self.channel.stop_consuming()
            self.connection.close()
            logger.info("Worker stopped")
    
    def close(self):
        """Close connections"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()
        if self.db_session:
            self.db_session.close()
        if self.db_engine:
            self.db_engine.dispose()

def main():
    """Main entry point"""
    worker = BouquetWorker()
    
    try:
        worker.start_consuming()
    except Exception as e:
        logger.error(f"Worker error: {e}")
        sys.exit(1)
    finally:
        worker.close()

if __name__ == '__main__':
    main()

