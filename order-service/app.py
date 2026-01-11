from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import text
from config import Config
from database import init_db
from routes import bp
import logging
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for all routes
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

# Initialize database (will be connected with retry logic in init_app)
db = init_db(app)

# Register blueprints
app.register_blueprint(bp, url_prefix='')

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    try:
        # Test database connection
        db.session.execute(text('SELECT 1'))
        return jsonify({
            'status': 'healthy',
            'service': 'order-service',
            'database': 'connected'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'order-service',
            'database': 'disconnected',
            'error': str(e)
        }), 503

def init_app():
    """Initialize application with database tables"""
    import time
    max_retries = 30
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            with app.app_context():
                # Test connection first
                db.session.execute(text('SELECT 1'))
                db.create_all()
            logger.info("Database initialized successfully")
            return
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Database connection failed (attempt {attempt + 1}/{max_retries}): {e}")
                logger.info(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
            else:
                logger.error(f"Failed to connect to database after {max_retries} attempts: {e}")
                raise

if __name__ == '__main__':
    # Initialize database with retry logic before starting server
    init_app()
    logger.info("Starting order-service on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=app.config['DEBUG'])
else:
    # When running with gunicorn or other WSGI server, initialize in background
    import threading
    def init_in_background():
        init_app()
    thread = threading.Thread(target=init_in_background, daemon=True)
    thread.start()

