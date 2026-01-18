from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy import text
from config import Config
from database import init_db
from routes import bp

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for all routes - allow all origins for development
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

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
            'service': 'user-service',
            'database': 'connected'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'service': 'user-service',
            'database': 'disconnected',
            'error': str(e)
        }), 503

def init_app():
    """Initialize application with database tables and default data"""
    with app.app_context():
        db.create_all()
        
        # Create default roles if they don't exist
        from models import Role
        default_roles = [
            {'name': 'admin', 'description': 'Administrator'},
            {'name': 'florar', 'description': 'Florar'},
            {'name': 'client', 'description': 'Client'}
        ]
        
        for role_data in default_roles:
            role = Role.query.filter_by(name=role_data['name']).first()
            if not role:
                role = Role(**role_data)
                db.session.add(role)
        
        db.session.commit()

if __name__ == '__main__':
    init_app()
    app.run(host='0.0.0.0', port=5000, debug=app.config['DEBUG'])