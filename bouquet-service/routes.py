from flask import Blueprint, request, jsonify
from builder import build_bouquet_preview, validate_bouquet_configuration
import requests
from config import Config

config = Config()

bp = Blueprint('bouquet', __name__)

def verify_token():
    """Verify token with auth service"""
    token = request.headers.get('Authorization')
    if not token:
        return None
    
    try:
        response = requests.post(
            f"{config.AUTH_SERVICE_URL}/verify",
            json={'token': token},
            headers={'Authorization': token},
            timeout=5
        )
        if response.status_code == 200:
            return response.json().get('user')
    except Exception as e:
        print(f"Error verifying token: {e}")
    
    return None

def require_auth(f):
    """Decorator to require authentication"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_info = verify_token()
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401
        request.current_user = user_info
        request.token = request.headers.get('Authorization')
        return f(*args, **kwargs)
    return decorated_function

@bp.route('/bouquet/preview', methods=['GET'])
@require_auth
def preview_bouquet():
    """Generate bouquet preview configurations"""
    # Get query parameters
    budget = request.args.get('budget', type=float)
    colors = request.args.get('colors')
    season = request.args.get('season')
    style = request.args.get('style')
    
    if not budget or budget <= 0:
        return jsonify({'error': 'Budget is required and must be positive'}), 400
    
    token = request.token
    
    # Build bouquet preview
    configurations = build_bouquet_preview(
        budget=budget,
        colors=colors,
        season=season,
        style=style,
        token=token
    )
    
    if not configurations:
        return jsonify({
            'message': 'No valid bouquet configurations found',
            'configurations': []
        }), 200
    
    return jsonify({
        'configurations': configurations,
        'count': len(configurations)
    }), 200

@bp.route('/bouquet/validate', methods=['POST'])
@require_auth
def validate_bouquet():
    """Validate a bouquet configuration"""
    data = request.get_json()
    token = request.token
    
    if not data:
        return jsonify({'error': 'Configuration is required'}), 400
    
    is_valid, message = validate_bouquet_configuration(data, token)
    
    if is_valid:
        return jsonify({
            'valid': True,
            'message': message
        }), 200
    else:
        return jsonify({
            'valid': False,
            'message': message
        }), 400

@bp.route('/bouquet/rules', methods=['GET'])
@require_auth
def get_rules():
    """Get available bouquet composition rules"""
    from config import Config
    from rules import COLOR_COMPATIBILITY, SEASONS
    
    return jsonify({
        'rules': {
            'min_flowers_per_bouquet': Config.MIN_FLOWERS_PER_BOUQUET,
            'max_flowers_per_bouquet': Config.MAX_FLOWERS_PER_BOUQUET,
            'min_flower_types': Config.MIN_FLOWER_TYPES,
            'max_flower_types': Config.MAX_FLOWER_TYPES,
            'color_compatibility': COLOR_COMPATIBILITY,
            'seasons': SEASONS
        }
    }), 200

