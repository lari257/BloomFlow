from flask import Flask, jsonify
from config import Config
from routes import bp

app = Flask(__name__)
app.config.from_object(Config)

# Register blueprints
app.register_blueprint(bp, url_prefix='')

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'bouquet-service'
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=app.config['DEBUG'])

