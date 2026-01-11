from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import text
from config import Config
from database import init_db
from routes import bp


app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for all routes
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

# Initialize database
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
            'service': 'inventory-service',
            'database': 'connected'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'inventory-service',
            'database': 'disconnected',
            'error': str(e)
        }), 503

def init_app():
    """Initialize application with database tables"""
    import time
    max_retries = 30
    for attempt in range(max_retries):
        try:
            with app.app_context():
                db.create_all()
            print("Database initialized successfully")
            return
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Database connection failed (attempt {attempt + 1}/{max_retries}): {e}")
                time.sleep(2)
            else:
                print(f"Failed to connect to database after {max_retries} attempts: {e}")
                raise

if __name__ == '__main__':
    init_app()
    app.run(host='0.0.0.0', port=5000, debug=app.config['DEBUG'])

