from flask import Blueprint, request, jsonify
from database import db
from models import User, Role
import requests
from config import Config

config = Config()

bp = Blueprint('users', __name__)

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

def get_roles_from_token(user_info):
    """
    Extrage rolurile din token.
    Auth-service poate returna rolurile în 2 formate:
    1. Direct în 'roles' (cum face auth-service acum)
    2. În 'realm_access.roles' (format original Keycloak)
    """
    # Prima verificare: direct în 'roles'
    if 'roles' in user_info:
        return user_info.get('roles', [])
    
    # A doua verificare: în realm_access.roles
    realm_access = user_info.get('realm_access', {})
    return realm_access.get('roles', [])

def require_auth(f):
    """Decorator to require authentication"""
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_info = verify_token()
        if not user_info:
            return jsonify({'error': 'Unauthorized'}), 401
        request.current_user = user_info
        return f(*args, **kwargs)
    return decorated_function

def require_role(*allowed_roles):
    """
    Decorator to require specific role(s).
    Citește rolurile din TOKEN (realm_access.roles)
    """
    from functools import wraps
    
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            user_info = request.current_user
            token_roles = get_roles_from_token(user_info)
            
            if not any(role in token_roles for role in allowed_roles):
                return jsonify({
                    'error': 'Insufficient permissions',
                    'required_roles': list(allowed_roles),
                    'your_roles': token_roles
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def require_admin(f):
    """Decorator to require admin role"""
    from functools import wraps
    
    @wraps(f)
    @require_auth
    def decorated_function(*args, **kwargs):
        user_info = request.current_user
        token_roles = get_roles_from_token(user_info)
        
        if 'admin' not in token_roles:
            return jsonify({
                'error': 'Admin access required',
                'your_roles': token_roles
            }), 403
        
        return f(*args, **kwargs)
    return decorated_function

def get_primary_role_from_keycloak(roles):
    """
    Determină rolul principal din lista de roluri Keycloak.
    Prioritate: admin > florar > client
    """
    if 'admin' in roles:
        return 'admin'
    elif 'florar' in roles:
        return 'florar'
    else:
        return 'client'

def sync_user_from_keycloak(user_info):
    """
    Sincronizează sau creează un user din informațiile Keycloak.
    """
    user_sub = user_info.get('sub')
    email = user_info.get('email')
    username = user_info.get('preferred_username', email)
    
    # CORECT: Extrage rolurile din realm_access.roles
    keycloak_roles = get_roles_from_token(user_info)
    
    # Determină rolul principal
    primary_role = get_primary_role_from_keycloak(keycloak_roles)
    
    # Caută userul existent
    user = User.query.filter_by(keycloak_id=user_sub).first()
    
    if user:
        # Actualizează userul existent
        user.email = email
        user.name = username
        user.role = primary_role
        sync_user_roles(user, keycloak_roles)
        db.session.commit()
        return user, False
    else:
        # Creează user nou
        user = User(
            keycloak_id=user_sub,
            email=email,
            name=username,
            role=primary_role
        )
        db.session.add(user)
        db.session.commit()
        sync_user_roles(user, keycloak_roles)
        db.session.commit()
        return user, True

def sync_user_roles(user, keycloak_roles):
    """Sincronizează rolurile din Keycloak cu tabelul local"""
    user.roles = []
    
    for role_name in keycloak_roles:
        # Ignoră rolurile Keycloak implicite
        if role_name in ['offline_access', 'uma_authorization', 'default-roles-bloomflow']:
            continue
        
        role = Role.query.filter_by(name=role_name).first()
        if role:
            user.roles.append(role)


# ============================================================
# ENDPOINTS
# ============================================================

@bp.route('/users', methods=['GET'])
@require_admin
def get_users():
    """Get list of users (admin only)"""
    users = User.query.all()
    return jsonify({
        'users': [user.to_dict() for user in users]
    }), 200

@bp.route('/users/<int:user_id>', methods=['GET'])
@require_auth
def get_user(user_id):
    """Get user by ID"""
    user_info = request.current_user
    user_sub = user_info.get('sub')
    token_roles = get_roles_from_token(user_info)
    
    user = User.query.get_or_404(user_id)
    
    current_user = User.query.filter_by(keycloak_id=user_sub).first()
    is_own_profile = current_user and current_user.id == user_id
    is_admin = 'admin' in token_roles
    
    if not is_own_profile and not is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'user': user.to_dict()
    }), 200

@bp.route('/users', methods=['POST'])
@require_auth
def create_user():
    """Create or sync user from Keycloak"""
    user_info = request.current_user
    user, is_new = sync_user_from_keycloak(user_info)
    
    if is_new:
        return jsonify({
            'message': 'User created',
            'user': user.to_dict()
        }), 201
    else:
        return jsonify({
            'message': 'User updated',
            'user': user.to_dict()
        }), 200

@bp.route('/users/<int:user_id>/role', methods=['PUT'])
@require_admin
def update_user_role(user_id):
    """Update user role in local database (admin only)"""
    data = request.get_json()
    role = data.get('role')
    
    if role not in ['admin', 'florar', 'client']:
        return jsonify({'error': 'Invalid role'}), 400
    
    user = User.query.get_or_404(user_id)
    user.role = role
    db.session.commit()
    
    return jsonify({
        'message': 'Role updated',
        'user': user.to_dict()
    }), 200

@bp.route('/users/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current user information"""
    user_info = request.current_user
    user, _ = sync_user_from_keycloak(user_info)
    
    return jsonify({
        'user': user.to_dict(),
        'keycloak_roles': get_roles_from_token(user_info)
    }), 200

@bp.route('/users/sync', methods=['POST'])
@require_auth
def sync_current_user():
    """Force sync current user with Keycloak data"""
    user_info = request.current_user
    user, is_new = sync_user_from_keycloak(user_info)
    
    return jsonify({
        'message': 'User synced successfully',
        'user': user.to_dict(),
        'keycloak_roles': get_roles_from_token(user_info),
        'was_new': is_new
    }), 200

@bp.route('/users/<int:user_id>/orders', methods=['GET'])
@require_auth
def get_user_orders(user_id):
    """Get orders for a user"""
    user_info = request.current_user
    user_sub = user_info.get('sub')
    token_roles = get_roles_from_token(user_info)
    
    user = User.query.get_or_404(user_id)
    
    current_user = User.query.filter_by(keycloak_id=user_sub).first()
    is_own = current_user and current_user.id == user_id
    is_admin = 'admin' in token_roles
    
    if not is_own and not is_admin:
        return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'user_id': user_id,
        'orders': []
    }), 200

@bp.route('/roles', methods=['GET'])
@require_auth
def get_roles():
    """Get all roles"""
    roles = Role.query.all()
    return jsonify({
        'roles': [role.to_dict() for role in roles]
    }), 200

@bp.route('/debug/token', methods=['GET'])
@require_auth
def debug_token():
    """Debug endpoint to see token info"""
    user_info = request.current_user
    return jsonify({
        'token_info': user_info,
        'extracted_roles': get_roles_from_token(user_info)
    }), 200