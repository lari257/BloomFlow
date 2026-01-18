"""
Flask app for Notification Service health checks
"""
from flask import Flask, jsonify
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

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'notification-service',
        'type': 'email'
    }), 200

if __name__ == '__main__':
    logger.info("Starting notification-service health check server on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
