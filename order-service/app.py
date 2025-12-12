from flask import Flask, jsonify
from sqlalchemy import text
from config import Config
from database import init_db
from routes import bp

app = Flask(__name__)
app.config.from_object(Config)

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
    with app.app_context():
        db.create_all()

if __name__ == '__main__':
    init_app()
    app.run(host='0.0.0.0', port=5000, debug=app.config['DEBUG'])

