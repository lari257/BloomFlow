"""
Reports Service - Flask Application
Uses PostgreSQL read replica for generating reports without loading main database
"""
from flask import Flask
from flask_cors import CORS
from config import Config
from routes import bp as reports_bp

def create_app():
    """Create Flask application"""
    app = Flask(__name__)
    app.config.from_object(Config)
    
    # Enable CORS
    CORS(app, resources={
        r"/*": {
            "origins": "*",
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Register blueprints
    app.register_blueprint(reports_bp)
    
    @app.route('/health')
    def health():
        return {'status': 'healthy', 'service': 'reports-service', 'database': 'read-replica'}, 200
    
    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
