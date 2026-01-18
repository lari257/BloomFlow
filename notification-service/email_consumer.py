"""
RabbitMQ Consumer for Email Notifications
Listens to the notifications queue and sends emails based on order events
"""
import pika
import json
import logging
import sys
import time
import requests
from config import Config
from email_templates import EmailTemplates
from email_sender import EmailSender

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)
config = Config()

class NotificationConsumer:
    """Consumer for email notifications from RabbitMQ"""
    
    def __init__(self):
        self.connection = None
        self.channel = None
        self.config = config
        self.email_sender = EmailSender()
        self.connect()
    
    def connect(self):
        """Connect to RabbitMQ"""
        max_retries = 10
        retry_delay = 5
        
        for attempt in range(max_retries):
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
                
                # Set QoS to process one message at a time
                self.channel.basic_qos(prefetch_count=1)
                
                logger.info(f"Successfully connected to RabbitMQ and declared queue '{config.NOTIFICATION_QUEUE_NAME}'")
                return
                
            except pika.exceptions.AMQPConnectionError as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Failed to connect to RabbitMQ (attempt {attempt + 1}/{max_retries}): {e}")
                    logger.info(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                else:
                    logger.error(f"Failed to connect to RabbitMQ after {max_retries} attempts: {e}")
                    raise
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Error connecting to RabbitMQ (attempt {attempt + 1}/{max_retries}): {e}")
                    time.sleep(retry_delay)
                else:
                    logger.error(f"Fatal error connecting to RabbitMQ: {e}")
                    raise
    
    def get_user_info(self, user_id):
        """Fetch user information from user service (internal endpoint)"""
        try:
            response = requests.get(
                f"{config.USER_SERVICE_URL}/internal/users/{user_id}",
                timeout=5
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Failed to fetch user {user_id}: status {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error fetching user {user_id}: {e}")
            return None
    
    def get_order_info(self, order_id):
        """Fetch order information from order service (internal endpoint)"""
        try:
            response = requests.get(
                f"{config.ORDER_SERVICE_URL}/internal/orders/{order_id}",
                timeout=5
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.warning(f"Failed to fetch order {order_id}: status {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error fetching order {order_id}: {e}")
            return None
    
    def get_flowers_info(self):
        """Fetch all flowers from inventory service (internal endpoint)"""
        try:
            response = requests.get(
                f"{config.INVENTORY_SERVICE_URL}/internal/flowers",
                timeout=5
            )
            if response.status_code == 200:
                flowers = response.json().get('flowers', [])
                # Create a dictionary for quick lookup by ID
                return {flower['id']: flower['name'] for flower in flowers}
            else:
                logger.warning(f"Failed to fetch flowers: status {response.status_code}")
                return {}
        except Exception as e:
            logger.error(f"Error fetching flowers: {e}")
            return {}

    def handle_notification(self, ch, method, properties, body):
        """
        Handle notification message from RabbitMQ
        
        Args:
            ch: Channel object
            method: Method frame
            properties: Message properties
            body: Message body
        """
        try:
            # Decode message
            message = json.loads(body.decode('utf-8'))
            logger.info(f"Received notification: {message}")
            
            # Extract notification details
            notification_type = message.get('type')  # 'order_confirmed', 'order_paid', 'order_completed'
            order_id = message.get('order_id')
            user_id = message.get('user_id')
            
            if not all([notification_type, order_id, user_id]):
                logger.error(f"Invalid notification format: {message}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            # Fetch order and user data
            order_data = self.get_order_info(order_id)
            user_data = self.get_user_info(user_id)
            flowers_map = self.get_flowers_info()  # Fetch flower names
            
            if not order_data or not user_data:
                logger.error(f"Could not fetch order or user data for notification: {message}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            # Check if user has email from nested 'user' object or directly
            user_info = user_data.get('user', user_data)
            
            # Check if user has email notifications enabled
            email_notifications_enabled = user_info.get('email_notifications', True)
            if not email_notifications_enabled:
                logger.info(f"User {user_id} has email notifications disabled, skipping email")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            # Get user email
            user_email = user_info.get('email')
            if not user_email:
                logger.error(f"User {user_id} has no email address")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            # Generate email based on notification type
            subject = None
            html_body = None
            
            if notification_type == 'order_confirmed':
                subject, html_body = EmailTemplates.order_confirmed_template(order_data, user_data, flowers_map)
            elif notification_type == 'order_paid':
                subject, html_body = EmailTemplates.order_paid_template(order_data, user_data, flowers_map)
            elif notification_type == 'order_completed':
                subject, html_body = EmailTemplates.order_completed_template(order_data, user_data, flowers_map)
            else:
                logger.error(f"Unknown notification type: {notification_type}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            # Send email
            if subject and html_body:
                success = self.email_sender.send_email(user_email, subject, html_body)
                
                if success:
                    logger.info(f"Notification email sent successfully for order {order_id}")
                else:
                    logger.error(f"Failed to send notification email for order {order_id}")
            
            # Acknowledge message
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode message: {e}")
            ch.basic_ack(delivery_tag=method.delivery_tag)
        except Exception as e:
            logger.error(f"Error processing notification: {type(e).__name__}: {e}")
            # Acknowledge to avoid processing the same message repeatedly
            ch.basic_ack(delivery_tag=method.delivery_tag)
    
    def start_consuming(self):
        """Start consuming messages from the notification queue"""
        try:
            logger.info(f"Starting to consume notifications from queue '{config.NOTIFICATION_QUEUE_NAME}'")
            
            self.channel.basic_consume(
                queue=config.NOTIFICATION_QUEUE_NAME,
                on_message_callback=self.handle_notification
            )
            
            logger.info("Notification consumer started. Waiting for messages...")
            self.channel.start_consuming()
            
        except KeyboardInterrupt:
            logger.info("Received interrupt signal. Closing consumer...")
            self.stop_consuming()
        except Exception as e:
            logger.error(f"Error in consumer: {e}")
            self.stop_consuming()
    
    def stop_consuming(self):
        """Stop consuming messages and close connection"""
        try:
            if self.channel:
                self.channel.stop_consuming()
            if self.connection:
                self.connection.close()
            logger.info("Notification consumer stopped")
        except Exception as e:
            logger.error(f"Error stopping consumer: {e}")

def main():
    """Main entry point"""
    logger.info("Starting Notification Service (Email Consumer)")
    
    consumer = NotificationConsumer()
    consumer.start_consuming()

if __name__ == '__main__':
    main()
