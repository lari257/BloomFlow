from flask import Blueprint, request, jsonify
from database import db
from models import User, Role
import requests
from config import Config

config = Config()

bp = Blueprint('users', __name__)


# ============================================================
# KEYCLOAK ADMIN API HELPERS
# ============================================================

def get_keycloak_admin_token():
    """Get admin access token from Keycloak master realm"""
    try:
        response = requests.post(
            f"{config.KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
            data={
                'grant_type': 'password',
                'client_id': 'admin-cli',
                'username': config.KEYCLOAK_ADMIN_USER,
                'password': config.KEYCLOAK_ADMIN_PASSWORD
            },
            timeout=10
        )
        if response.status_code == 200:
            return response.json().get('access_token')
        else:
            print(f"Failed to get admin token: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Error getting admin token: {e}")
        return None


def get_keycloak_client_role_id(admin_token, client_id, role_name):
    """Get the role ID for a client role in Keycloak"""
    try:
        # First get the client internal ID
        clients_response = requests.get(
            f"{config.KEYCLOAK_URL}/admin/realms/{config.KEYCLOAK_REALM}/clients",
            headers={'Authorization': f'Bearer {admin_token}'},
            params={'clientId': client_id},
            timeout=10
        )
        if clients_response.status_code != 200:
            print(f"Failed to get clients: {clients_response.text}")
            return None, None
        
        clients = clients_response.json()
        if not clients:
            print(f"Client {client_id} not found")
            return None, None
        
        client_uuid = clients[0]['id']
        
        # Get the role
        role_response = requests.get(
            f"{config.KEYCLOAK_URL}/admin/realms/{config.KEYCLOAK_REALM}/clients/{client_uuid}/roles/{role_name}",
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=10
        )
        if role_response.status_code != 200:
            print(f"Failed to get role: {role_response.text}")
            return client_uuid, None
        
        return client_uuid, role_response.json()
    except Exception as e:
        print(f"Error getting role: {e}")
        return None, None


def get_keycloak_realm_role(admin_token, role_name):
    """Get a realm role from Keycloak"""
    try:
        response = requests.get(
            f"{config.KEYCLOAK_URL}/admin/realms/{config.KEYCLOAK_REALM}/roles/{role_name}",
            headers={'Authorization': f'Bearer {admin_token}'},
            timeout=10
        )
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Failed to get realm role: {response.text}")
            return None
    except Exception as e:
        print(f"Error getting realm role: {e}")
        return None


def assign_keycloak_realm_role(user_keycloak_id, role_name):
    """Assign a realm role to a user in Keycloak"""
    admin_token = get_keycloak_admin_token()
    if not admin_token:
        return False, "Could not get admin token"
    
    # Get the role details
    role = get_keycloak_realm_role(admin_token, role_name)
    if not role:
        return False, f"Role {role_name} not found in Keycloak"
    
    # Assign the role to the user
    try:
        response = requests.post(
            f"{config.KEYCLOAK_URL}/admin/realms/{config.KEYCLOAK_REALM}/users/{user_keycloak_id}/role-mappings/realm",
            headers={
                'Authorization': f'Bearer {admin_token}',
                'Content-Type': 'application/json'
            },
            json=[role],
            timeout=10
        )
        if response.status_code in [200, 204]:
            print(f"Successfully assigned role {role_name} to user {user_keycloak_id}")
            return True, "Role assigned successfully"
        else:
            print(f"Failed to assign role: {response.status_code} - {response.text}")
            return False, f"Failed to assign role: {response.text}"
    except Exception as e:
        print(f"Error assigning role: {e}")
        return False, str(e)


def create_keycloak_user(username, password, email, first_name, last_name):
    """Create a new user in Keycloak"""
    admin_token = get_keycloak_admin_token()
    if not admin_token:
        return False, None, "Could not get admin token"
    
    try:
        # Create the user
        user_data = {
            'username': username,
            'email': email,
            'firstName': first_name,
            'lastName': last_name,
            'enabled': True,
            'emailVerified': True,
            'requiredActions': [],
            'credentials': [{
                'type': 'password',
                'value': password,
                'temporary': False
            }]
        }
        
        response = requests.post(
            f"{config.KEYCLOAK_URL}/admin/realms/{config.KEYCLOAK_REALM}/users",
            headers={
                'Authorization': f'Bearer {admin_token}',
                'Content-Type': 'application/json'
            },
            json=user_data,
            timeout=10
        )
        
        if response.status_code == 201:
            # Get the user ID from the Location header
            location = response.headers.get('Location', '')
            user_id = location.split('/')[-1] if location else None
            
            if user_id:
                # Assign the client role by default
                assign_keycloak_realm_role(user_id, 'client')
            
            return True, user_id, "User created successfully"
        elif response.status_code == 409:
            return False, None, "Username or email already exists"
        else:
            print(f"Failed to create user: {response.status_code} - {response.text}")
            return False, None, f"Failed to create user: {response.text}"
    except Exception as e:
        print(f"Error creating user: {e}")
        return False, None, str(e)


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
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
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
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
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
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
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

@bp.route('/users/me/notifications', methods=['PUT'])
@require_auth
def update_notification_preferences():
    """Update current user's notification preferences"""
    user_info = request.current_user
    user_sub = user_info.get('sub')
    
    user = User.query.filter_by(keycloak_id=user_sub).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    data = request.get_json()
    
    if 'email_notifications' in data:
        user.email_notifications = bool(data['email_notifications'])
    
    db.session.commit()
    
    return jsonify({
        'message': 'Notification preferences updated',
        'user': user.to_dict()
    }), 200

@bp.route('/users/me/notifications', methods=['GET'])
@require_auth
def get_notification_preferences():
    """Get current user's notification preferences"""
    user_info = request.current_user
    user_sub = user_info.get('sub')
    
    user = User.query.filter_by(keycloak_id=user_sub).first()
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'email_notifications': user.email_notifications
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


# ============================================================
# REGISTRATION WITH ROLE REQUEST
# ============================================================

@bp.route('/users/signup', methods=['POST'])
def signup():
    """
    Create a new user account in Keycloak.
    This is a public endpoint - no authentication required.
    """
    data = request.get_json() or {}
    
    # Validate required fields
    required_fields = ['username', 'password', 'email', 'firstName', 'lastName']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    username = data['username']
    password = data['password']
    email = data['email']
    first_name = data['firstName']
    last_name = data['lastName']
    requested_role = data.get('requestedRole', 'client')
    
    if requested_role not in ['client', 'florar']:
        return jsonify({'error': 'Invalid role. Choose "client" or "florar"'}), 400
    
    # Validate password length
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    
    # Create user in Keycloak
    success, keycloak_id, message = create_keycloak_user(
        username, password, email, first_name, last_name
    )
    
    if not success:
        return jsonify({'error': message}), 400
    
    # Create user in local database
    if requested_role == 'florar':
        # Florar needs admin approval
        user = User(
            keycloak_id=keycloak_id,
            email=email,
            name=username,
            role='client',  # Start as client
            requested_role='florar',  # Requested florar role
            status='pending_approval'  # Needs admin approval
        )
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Account created! Your florist account request is pending admin approval.',
            'user': user.to_dict(),
            'pending_approval': True
        }), 201
    else:
        # Regular client - active immediately
        user = User(
            keycloak_id=keycloak_id,
            email=email,
            name=username,
            role='client',
            status='active'
        )
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Account created successfully! You can now login.',
            'user': user.to_dict()
        }), 201


@bp.route('/users/register', methods=['POST'])
@require_auth
def register_with_role():
    """
    Register user with optional role request.
    If role 'florar' is requested, account needs admin approval.
    If role 'client' or no role specified, account is active immediately.
    """
    user_info = request.current_user
    data = request.get_json() or {}
    requested_role = data.get('requested_role', 'client')
    
    if requested_role not in ['client', 'florar']:
        return jsonify({'error': 'Invalid role. Choose "client" or "florar"'}), 400
    
    user_sub = user_info.get('sub')
    email = user_info.get('email')
    username = user_info.get('preferred_username', email)
    
    # Check if user already exists
    existing_user = User.query.filter_by(keycloak_id=user_sub).first()
    if existing_user:
        return jsonify({
            'message': 'User already registered',
            'user': existing_user.to_dict()
        }), 200
    
    # Create user based on role request
    if requested_role == 'florar':
        # Florar needs admin approval
        user = User(
            keycloak_id=user_sub,
            email=email,
            name=username,
            role='client',  # Start as client
            requested_role='florar',  # Requested florar role
            status='pending_approval'  # Needs admin approval
        )
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Registration submitted. Your florar account request is pending admin approval.',
            'user': user.to_dict(),
            'pending_approval': True
        }), 201
    else:
        # Regular client - active immediately
        user = User(
            keycloak_id=user_sub,
            email=email,
            name=username,
            role='client',
            status='active'
        )
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'Registration successful',
            'user': user.to_dict()
        }), 201


@bp.route('/users/pending-approvals', methods=['GET'])
@require_admin
def get_pending_approvals():
    """Get list of users pending florar approval (admin only)"""
    pending_users = User.query.filter_by(status='pending_approval').all()
    
    return jsonify({
        'pending_users': [user.to_dict() for user in pending_users],
        'count': len(pending_users)
    }), 200


@bp.route('/users/<int:user_id>/approve', methods=['POST'])
@require_admin
def approve_florar(user_id):
    """Approve a user's florar role request (admin only)"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    if user.status != 'pending_approval':
        return jsonify({'error': 'User is not pending approval'}), 400
    
    if user.requested_role != 'florar':
        return jsonify({'error': 'User did not request florar role'}), 400
    
    # Try to update Keycloak role first
    keycloak_success, keycloak_message = assign_keycloak_realm_role(
        user.keycloak_id, 
        'florar'
    )
    
    # Approve - update role and status in local database
    user.role = 'florar'
    user.status = 'active'
    user.requested_role = None  # Clear the request
    db.session.commit()
    
    return jsonify({
        'message': f'User {user.email} approved as florar',
        'user': user.to_dict(),
        'keycloak_updated': keycloak_success,
        'keycloak_message': keycloak_message
    }), 200


@bp.route('/users/<int:user_id>/reject', methods=['POST'])
@require_admin
def reject_florar(user_id):
    """Reject a user's florar role request (admin only)"""
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    data = request.get_json() or {}
    reason = data.get('reason', 'Request rejected by administrator')
    
    if user.status != 'pending_approval':
        return jsonify({'error': 'User is not pending approval'}), 400
    
    # Reject - keep as client but make active
    user.role = 'client'
    user.status = 'active'
    user.requested_role = None  # Clear the request
    db.session.commit()
    
    return jsonify({
        'message': f'Florar request rejected for {user.email}',
        'reason': reason,
        'user': user.to_dict()
    }), 200


# ============================================================
# INTERNAL SERVICE-TO-SERVICE ENDPOINTS (no auth required)
# ============================================================

@bp.route('/internal/users/<int:user_id>', methods=['GET'])
def get_user_internal(user_id):
    """
    Internal endpoint for service-to-service communication.
    Used by notification-service to fetch user details.
    """
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'user': user.to_dict()}), 200