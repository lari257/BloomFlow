import jwt
import requests
import sys
import json
from functools import wraps
from flask import request, jsonify, g
from config import Config
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend
import base64

config = Config()

def log_debug(msg):
    """Log to stderr so it appears in Docker logs"""
    print(f"[AUTH-SERVICE] {msg}", file=sys.stderr, flush=True)

# Cache for public keys (JWKS)
_jwks_cache = None

def get_jwks():
    """Fetch and cache Keycloak JWKS"""
    global _jwks_cache
    
    if _jwks_cache is None:
        try:
            url = f"{config.KEYCLOAK_PUBLIC_KEY_URL}/protocol/openid-connect/certs"
            log_debug(f"Fetching JWKS from: {url}")
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            _jwks_cache = response.json()
            log_debug(f"JWKS fetched successfully, {len(_jwks_cache.get('keys', []))} keys found")
        except Exception as e:
            log_debug(f"Error fetching JWKS: {e}")
            _jwks_cache = False
    
    return _jwks_cache

def jwk_to_pem(jwk):
    """Convert JWK to PEM format"""
    try:
        # Extract RSA parameters from JWK
        n = base64.urlsafe_b64decode(jwk['n'] + '==')
        e = base64.urlsafe_b64decode(jwk['e'] + '==')
        
        # Convert to integers
        n_int = int.from_bytes(n, 'big')
        e_int = int.from_bytes(e, 'big')
        
        # Create RSA public key
        public_numbers = rsa.RSAPublicNumbers(e_int, n_int)
        public_key = public_numbers.public_key(default_backend())
        
        # Serialize to PEM
        pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return pem.decode('utf-8')
    except Exception as e:
        log_debug(f"Error converting JWK to PEM: {e}")
        return None

def get_public_key_for_token(token):
    """Get the public key for a specific token by matching kid"""
    try:
        # Decode header to get kid
        header = jwt.get_unverified_header(token)
        kid = header.get('kid')
        
        jwks = get_jwks()
        if not jwks or not jwks.get('keys'):
            return None
        
        # Find the key with matching kid
        for key in jwks['keys']:
            if key.get('kid') == kid:
                return jwk_to_pem(key)
        
        # If no kid match, use first key (fallback)
        log_debug(f"No matching kid found, using first key")
        return jwk_to_pem(jwks['keys'][0])
    except Exception as e:
        log_debug(f"Error getting public key for token: {e}")
        return None

def verify_token(token):
    """Verify JWT token from Keycloak using public key verification"""
    try:
        log_debug(f"verify_token called with token (first 50 chars): {token[:50] if token else None}")
        
        # Remove 'Bearer ' prefix if present
        if token and token.startswith('Bearer '):
            token = token[7:]
            log_debug("Removed 'Bearer ' prefix from token")
        
        if not token:
            log_debug("No token provided")
            return None
        
        log_debug(f"Token after processing (first 50 chars): {token[:50]}")
        log_debug(f"Token length: {len(token)}")
        
        # Get public key for this token
        public_key_pem = get_public_key_for_token(token)
        if not public_key_pem:
            log_debug("Failed to get public key for token")
            # Fallback to introspection if public key verification fails
            return verify_token_introspection(token)
        
        log_debug("Got public key, verifying JWT signature...")
        
        # Verify and decode token using public key
        # Note: We verify signature and expiration, but audience is optional
        # as Keycloak tokens may have different audiences
        try:
            decoded_token = jwt.decode(
                token,
                public_key_pem,
                algorithms=[config.JWT_ALGORITHM],
                audience=config.KEYCLOAK_CLIENT_ID,
                options={"verify_exp": True, "verify_signature": True}
            )
        except jwt.InvalidAudienceError:
            # If audience doesn't match, try without audience verification
            log_debug("Audience mismatch, verifying without audience check...")
            decoded_token = jwt.decode(
                token,
                public_key_pem,
                algorithms=[config.JWT_ALGORITHM],
                options={"verify_exp": True, "verify_signature": True, "verify_aud": False}
            )
        
        log_debug(f"Token verified successfully. User: {decoded_token.get('preferred_username', 'unknown')}")
        return decoded_token
        
    except jwt.ExpiredSignatureError:
        log_debug("Token expired")
        return None
    except jwt.InvalidAudienceError:
        log_debug("Token audience mismatch")
        return None
    except jwt.InvalidTokenError as e:
        log_debug(f"Invalid token: {e}")
        # Fallback to introspection
        log_debug("Falling back to introspection...")
        return verify_token_introspection(token)
    except Exception as e:
        log_debug(f"Error verifying token: {e}")
        import traceback
        log_debug(traceback.format_exc())
        # Fallback to introspection
        log_debug("Falling back to introspection...")
        return verify_token_introspection(token)

def verify_token_introspection(token):
    """Fallback: Verify token using Keycloak introspection endpoint"""
    try:
        introspection_url = f"{config.KEYCLOAK_SERVER_URL}/realms/{config.KEYCLOAK_REALM}/protocol/openid-connect/token/introspect"
        
        log_debug(f"Trying introspection at: {introspection_url}")
        log_debug(f"Client ID: {config.KEYCLOAK_CLIENT_ID}")
        
        # Try HTTP Basic Auth first (preferred method)
        import base64
        auth_string = f"{config.KEYCLOAK_CLIENT_ID}:{config.KEYCLOAK_CLIENT_SECRET}"
        auth_bytes = auth_string.encode('utf-8')
        auth_b64 = base64.b64encode(auth_bytes).decode('utf-8')
        headers = {
            'Authorization': f'Basic {auth_b64}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        data = {'token': token}
        
        response = requests.post(introspection_url, data=data, headers=headers, timeout=5)
        
        # If Basic Auth fails, try form-encoded
        if response.status_code == 401:
            log_debug("Basic Auth failed, trying form-encoded credentials...")
            headers = {'Content-Type': 'application/x-www-form-urlencoded'}
            data = {
                'token': token,
                'client_id': config.KEYCLOAK_CLIENT_ID,
                'client_secret': config.KEYCLOAK_CLIENT_SECRET
            }
            response = requests.post(introspection_url, data=data, headers=headers, timeout=5)
        
        log_debug(f"Introspection response status: {response.status_code}")
        
        if response.status_code != 200:
            log_debug(f"Introspection error: {response.text}")
            return None
            
        token_info = response.json()
        log_debug(f"Token active: {token_info.get('active')}")
        
        if not token_info.get('active'):
            log_debug(f"Token is not active: {token_info}")
            return None
        
        # Decode token to get claims (signature already verified via introspection)
        decoded_token = jwt.decode(
            token,
            options={"verify_signature": False}
        )
        
        return decoded_token
        
    except Exception as e:
        log_debug(f"Introspection error: {e}")
        import traceback
        log_debug(traceback.format_exc())
        return None

def require_auth(f):
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = request.headers.get('Authorization')
        
        if not token:
            return jsonify({'error': 'Missing authorization token'}), 401
        
        decoded_token = verify_token(token)
        
        if not decoded_token:
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Store user info in Flask's g object
        g.current_user = {
            'sub': decoded_token.get('sub'),
            'email': decoded_token.get('email'),
            'preferred_username': decoded_token.get('preferred_username'),
            'realm_access': decoded_token.get('realm_access', {}),
            'resource_access': decoded_token.get('resource_access', {})
        }
        
        return f(*args, **kwargs)
    
    return decorated_function

def require_role(*allowed_roles):
    """Decorator to require specific role(s)"""
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            # Get roles from token
            realm_access = g.current_user.get('realm_access', {})
            roles = realm_access.get('roles', [])
            
            # Check if user has any of the allowed roles
            if not any(role in roles for role in allowed_roles):
                return jsonify({
                    'error': 'Insufficient permissions',
                    'required_roles': list(allowed_roles),
                    'user_roles': roles
                }), 403
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator