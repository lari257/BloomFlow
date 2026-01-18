"""
Email sender utility for the Notification Service
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from config import Config

logger = logging.getLogger(__name__)
config = Config()

class EmailSender:
    """Send emails via SMTP"""
    
    @staticmethod
    def send_email(to_email, subject, html_body):
        """
        Send an email to a recipient
        
        Args:
            to_email (str): Recipient email address
            subject (str): Email subject
            html_body (str): HTML email body
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = config.MAIL_DEFAULT_SENDER
            msg['To'] = to_email
            
            # Attach HTML body
            html_part = MIMEText(html_body, 'html')
            msg.attach(html_part)
            
            # Send email via SMTP
            with smtplib.SMTP(config.MAIL_SERVER, config.MAIL_PORT) as server:
                if config.MAIL_USE_TLS:
                    server.starttls()
                
                server.login(config.MAIL_USERNAME, config.MAIL_PASSWORD)
                server.sendmail(config.MAIL_DEFAULT_SENDER, to_email, msg.as_string())
            
            logger.info(f"Email sent successfully to {to_email} with subject: {subject}")
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            logger.error("Check MAIL_USERNAME and MAIL_PASSWORD in configuration")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error occurred: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {type(e).__name__}: {e}")
            return False
