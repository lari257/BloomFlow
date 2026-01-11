from flask import Flask, jsonify, request, g
from flask_cors import CORS
from middleware import require_auth, verify_token
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

# Enable CORS for all routes
CORS(app, origins=["http://localhost:3000"], supports_credentials=True)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'auth-service'}), 200

@app.route('/verify', methods=['POST'])
def verify():
    """Verify token endpoint"""
    import sys
    print("[AUTH-SERVICE] /verify endpoint called", file=sys.stderr, flush=True)
    
    data = request.get_json()
    token_from_data = data.get('token') if data else None
    token_from_header = request.headers.get('Authorization')
    token = token_from_data or token_from_header
    
    print(f"[AUTH-SERVICE] Token from data: {bool(token_from_data)}, from header: {bool(token_from_header)}", file=sys.stderr, flush=True)
    if token_from_data:
        print(f"[AUTH-SERVICE] Token from data starts with 'Bearer': {token_from_data.startswith('Bearer ') if token_from_data else False}", file=sys.stderr, flush=True)
    if token_from_header:
        print(f"[AUTH-SERVICE] Token from header starts with 'Bearer': {token_from_header.startswith('Bearer ') if token_from_header else False}", file=sys.stderr, flush=True)
    
    if not token:
        print("[AUTH-SERVICE] No token provided", file=sys.stderr, flush=True)
        return jsonify({'error': 'Token required'}), 400
    
    print(f"[AUTH-SERVICE] Calling verify_token with token length: {len(token)}", file=sys.stderr, flush=True)
    decoded_token = verify_token(token)
    
    if not decoded_token:
        print("[AUTH-SERVICE] verify_token returned None", file=sys.stderr, flush=True)
        return jsonify({'valid': False, 'error': 'Invalid or expired token'}), 401
    
    print("[AUTH-SERVICE] Token verified successfully", file=sys.stderr, flush=True)
    
    return jsonify({
        'valid': True,
        'user': {
            'sub': decoded_token.get('sub'),
            'email': decoded_token.get('email'),
            'preferred_username': decoded_token.get('preferred_username'),
            'roles': decoded_token.get('realm_access', {}).get('roles', [])
        }
    }), 200

@app.route('/user', methods=['GET'])
@require_auth
def get_current_user():
    """Get current user information from token"""
    return jsonify({
        'user': g.current_user
    }), 200

@app.route('/roles', methods=['GET'])
@require_auth
def get_user_roles():
    """Get user roles from token"""
    realm_access = g.current_user.get('realm_access', {})
    roles = realm_access.get('roles', [])
    
    return jsonify({
        'roles': roles
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=app.config['DEBUG'])

