from flask import Blueprint, request, jsonify
from datetime import datetime, date, timedelta
from database import db
from models import FlowerType, FlowerLot
import requests
from config import Config

config = Config()

bp = Blueprint('inventory', __name__)

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
        return f(*args, **kwargs)
    return decorated_function

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

def require_role(*allowed_roles):
    """
    Decorator to require specific role(s).
    Citește rolurile din TOKEN-ul Keycloak (realm_access.roles)!
    """
    from functools import wraps
    
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            user_info = request.current_user
            # CORECT: Citește rolurile din realm_access.roles
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
    """Decorator to require admin role from token"""
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


# ============================================================
# FLOWER TYPE ENDPOINTS
# ============================================================

@bp.route('/flowers', methods=['GET'])
@require_auth
def get_flowers():
    """Get list of all flower types with stock information"""
    flowers = FlowerType.query.all()
    return jsonify({
        'flowers': [flower.to_dict_with_stock() for flower in flowers]
    }), 200

@bp.route('/flowers/<int:flower_id>', methods=['GET'])
@require_auth
def get_flower(flower_id):
    """Get flower type by ID"""
    flower = FlowerType.query.get(flower_id)
    if not flower:
        return jsonify({'error': 'Flower type not found'}), 404
    return jsonify({
        'flower': flower.to_dict()
    }), 200

@bp.route('/flowers', methods=['POST'])
@require_role('admin', 'florar')
def create_flower():
    """Create new flower type (admin or florar)"""
    data = request.get_json()
    
    required_fields = ['name', 'price_per_unit']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Check if flower type already exists
    existing = FlowerType.query.filter_by(name=data['name']).first()
    if existing:
        return jsonify({'error': 'Flower type already exists'}), 409
    
    flower = FlowerType(
        name=data['name'],
        color=data.get('color'),
        seasonality=data.get('seasonality', 'all'),
        price_per_unit=data['price_per_unit'],
        description=data.get('description')
    )
    
    db.session.add(flower)
    db.session.commit()
    
    return jsonify({
        'message': 'Flower type created',
        'flower': flower.to_dict()
    }), 201

@bp.route('/flowers/<int:flower_id>', methods=['PUT'])
@require_role('admin', 'florar')
def update_flower(flower_id):
    """Update flower type"""
    flower = FlowerType.query.get(flower_id)
    if not flower:
        return jsonify({'error': 'Flower type not found'}), 404
    data = request.get_json()
    
    if 'name' in data:
        flower.name = data['name']
    if 'color' in data:
        flower.color = data['color']
    if 'seasonality' in data:
        flower.seasonality = data['seasonality']
    if 'price_per_unit' in data:
        flower.price_per_unit = data['price_per_unit']
    if 'description' in data:
        flower.description = data['description']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Flower type updated',
        'flower': flower.to_dict()
    }), 200

@bp.route('/flowers/<int:flower_id>', methods=['DELETE'])
@require_admin
def delete_flower(flower_id):
    """Delete flower type (admin only)"""
    flower = FlowerType.query.get(flower_id)
    if not flower:
        return jsonify({'error': 'Flower type not found'}), 404
    db.session.delete(flower)
    db.session.commit()
    
    return jsonify({
        'message': 'Flower type deleted'
    }), 200


# ============================================================
# FLOWER LOT ENDPOINTS
# ============================================================

@bp.route('/lots', methods=['GET'])
@require_auth
def get_lots():
    """Get list of all flower lots"""
    status = request.args.get('status')
    flower_type_id = request.args.get('flower_type_id', type=int)
    
    query = FlowerLot.query
    
    if status:
        query = query.filter_by(status=status)
    if flower_type_id:
        query = query.filter_by(flower_type_id=flower_type_id)
    
    lots = query.all()
    return jsonify({
        'lots': [lot.to_dict() for lot in lots]
    }), 200

@bp.route('/lots/<int:lot_id>', methods=['GET'])
@require_auth
def get_lot(lot_id):
    """Get flower lot by ID"""
    lot = FlowerLot.query.get(lot_id)
    if not lot:
        return jsonify({'error': 'Flower lot not found'}), 404
    return jsonify({
        'lot': lot.to_dict()
    }), 200

@bp.route('/lots', methods=['POST'])
@require_role('admin', 'florar')
def create_lot():
    """Create new flower lot (admin or florar)"""
    data = request.get_json()
    
    required_fields = ['flower_type_id', 'quantity', 'expiry_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    # Verify flower type exists
    flower_type = FlowerType.query.get(data['flower_type_id'])
    if not flower_type:
        return jsonify({'error': 'Flower type not found'}), 404
    
    # Parse expiry date
    try:
        expiry_date = datetime.strptime(data['expiry_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    lot = FlowerLot(
        flower_type_id=data['flower_type_id'],
        quantity=data['quantity'],
        expiry_date=expiry_date,
        status=data.get('status', 'available')
    )
    
    db.session.add(lot)
    db.session.commit()
    
    return jsonify({
        'message': 'Flower lot created',
        'lot': lot.to_dict()
    }), 201

@bp.route('/lots/<int:lot_id>', methods=['PUT'])
@require_role('admin', 'florar')
def update_lot(lot_id):
    """Update flower lot (admin or florar)"""
    lot = FlowerLot.query.get(lot_id)
    if not lot:
        return jsonify({'error': 'Flower lot not found'}), 404
    data = request.get_json()
    
    if 'quantity' in data:
        lot.quantity = data['quantity']
    if 'expiry_date' in data:
        try:
            lot.expiry_date = datetime.strptime(data['expiry_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    if 'status' in data:
        if data['status'] not in ['available', 'expired', 'sold']:
            return jsonify({'error': 'Invalid status'}), 400
        lot.status = data['status']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Flower lot updated',
        'lot': lot.to_dict()
    }), 200

@bp.route('/lots/<int:lot_id>/quantity', methods=['PATCH'])
@require_role('admin', 'florar')
def update_lot_quantity(lot_id):
    """Update lot quantity (admin or florar)"""
    lot = FlowerLot.query.get(lot_id)
    if not lot:
        return jsonify({'error': 'Flower lot not found'}), 404
    data = request.get_json()
    
    if 'quantity' not in data:
        return jsonify({'error': 'Missing quantity field'}), 400
    
    if not isinstance(data['quantity'], int) or data['quantity'] < 0:
        return jsonify({'error': 'Quantity must be a non-negative integer'}), 400
    
    lot.quantity = data['quantity']
    db.session.commit()
    
    return jsonify({
        'message': 'Quantity updated',
        'lot': lot.to_dict()
    }), 200

@bp.route('/lots/<int:lot_id>', methods=['DELETE'])
@require_admin
def delete_lot(lot_id):
    """Delete flower lot (admin only)"""
    lot = FlowerLot.query.get(lot_id)
    if not lot:
        return jsonify({'error': 'Flower lot not found'}), 404
    db.session.delete(lot)
    db.session.commit()
    
    return jsonify({
        'message': 'Flower lot deleted'
    }), 200

@bp.route('/lots/expiring', methods=['GET'])
@require_auth
def get_expiring_lots():
    """Get lots expiring soon (within 7 days)"""
    days = request.args.get('days', 7, type=int)
    expiry_threshold = date.today() + timedelta(days=days)
    
    lots = FlowerLot.query.filter(
        FlowerLot.expiry_date <= expiry_threshold,
        FlowerLot.status == 'available'
    ).all()
    
    return jsonify({
        'lots': [lot.to_dict() for lot in lots],
        'expiry_threshold': expiry_threshold.isoformat()
    }), 200


# ============================================================
# INVENTORY SUMMARY ENDPOINTS
# ============================================================

@bp.route('/inventory/summary', methods=['GET'])
@require_auth
def get_inventory_summary():
    """Get inventory summary"""
    summary = {}
    
    flower_types = FlowerType.query.all()
    for flower_type in flower_types:
        total_quantity = db.session.query(db.func.sum(FlowerLot.quantity)).filter(
            FlowerLot.flower_type_id == flower_type.id,
            FlowerLot.status == 'available'
        ).scalar() or 0
        
        summary[flower_type.name] = {
            'flower_type_id': flower_type.id,
            'total_quantity': int(total_quantity),
            'price_per_unit': float(flower_type.price_per_unit) if flower_type.price_per_unit else 0.0
        }
    
    return jsonify({
        'summary': summary
    }), 200

@bp.route('/inventory/available', methods=['GET'])
@require_auth
def check_availability():
    """Check availability for bouquet creation"""
    flower_type_ids = request.args.getlist('flower_type_id', type=int)
    quantities = request.args.getlist('quantity', type=int)
    
    if len(flower_type_ids) != len(quantities):
        return jsonify({'error': 'flower_type_id and quantity arrays must have same length'}), 400
    
    availability = {}
    all_available = True
    
    for flower_type_id, quantity in zip(flower_type_ids, quantities):
        # Get all lots for this flower type to debug
        all_lots = FlowerLot.query.filter(
            FlowerLot.flower_type_id == flower_type_id
        ).all()
        
        # Calculate available quantity with filters
        available_quantity = db.session.query(db.func.sum(FlowerLot.quantity)).filter(
            FlowerLot.flower_type_id == flower_type_id,
            FlowerLot.status == 'available',
            FlowerLot.expiry_date >= date.today(),
            FlowerLot.quantity > 0
        ).scalar() or 0
        
        # Debug: count lots by status and expiry
        today = date.today()
        lots_info = []
        for lot in all_lots:
            is_expired = lot.expiry_date < today if lot.expiry_date else True
            lots_info.append({
                'lot_id': lot.id,
                'quantity': lot.quantity,
                'status': lot.status,
                'expiry_date': lot.expiry_date.isoformat() if lot.expiry_date else None,
                'is_expired': is_expired,
                'is_available': lot.status == 'available' and not is_expired and lot.quantity > 0
            })
        
        is_available = available_quantity >= quantity
        availability[flower_type_id] = {
            'required': quantity,
            'available': int(available_quantity),
            'sufficient': is_available,
            'lots_debug': lots_info  # Add debug info
        }
        
        if not is_available:
            all_available = False
    
    return jsonify({
        'availability': availability,
        'all_available': all_available,
        'today': date.today().isoformat()  # Add today's date for debugging
    }), 200

@bp.route('/inventory/reduce', methods=['POST'])
@require_auth
def reduce_inventory():
    """Reduce inventory quantities for order items (FIFO - earliest expiry first)
    
    Uses database-level locking (SELECT FOR UPDATE) to prevent race conditions
    when multiple orders try to reduce the same inventory simultaneously.
    """
    data = request.get_json()
    
    if 'items' not in data or not data['items']:
        return jsonify({'error': 'Items list is required'}), 400
    
    items = data['items']
    reduction_results = {}
    errors = []
    
    try:
        # First, validate all items and check availability WITH LOCKING
        for item in items:
            flower_type_id = item.get('flower_type_id')
            quantity_needed = item.get('quantity')
            
            if not flower_type_id or quantity_needed is None:
                errors.append(f'Invalid item: missing flower_type_id or quantity')
                continue
            
            if quantity_needed <= 0:
                errors.append(f'Invalid quantity for flower_type_id {flower_type_id}: must be positive')
                continue
            
            # Find available lots for this flower type, ordered by expiry date (FIFO)
            # Using FOR UPDATE to lock these rows and prevent concurrent modifications
            # Primary sort: expiry_date ascending (earliest expiring first)
            # Secondary sort: received_date ascending (older lots first if same expiry)
            # Tertiary sort: id ascending (deterministic ordering)
            lots = FlowerLot.query.filter(
                FlowerLot.flower_type_id == flower_type_id,
                FlowerLot.status == 'available',
                FlowerLot.expiry_date >= date.today(),
                FlowerLot.quantity > 0
            ).order_by(
                FlowerLot.expiry_date.asc(),
                FlowerLot.received_date.asc(),
                FlowerLot.id.asc()
            ).with_for_update().all()  # LOCK rows for update
            
            # Calculate total available
            total_available = sum(lot.quantity for lot in lots)
            
            if total_available < quantity_needed:
                db.session.rollback()  # Release locks
                errors.append(f'Insufficient quantity for flower_type_id {flower_type_id}: need {quantity_needed}, have {total_available}')
                continue
        
        # If any validation errors, return early
        if errors:
            db.session.rollback()  # Release any locks
            return jsonify({
                'error': 'Validation failed',
                'errors': errors
            }), 400
        
        # All validations passed, now reduce quantities
        for item in items:
            flower_type_id = item.get('flower_type_id')
            quantity_needed = item.get('quantity')
            
            # Find available lots for this flower type, ordered by expiry date (FIFO)
            # Rows are already locked from validation step, but we query again to get current values
            lots = FlowerLot.query.filter(
                FlowerLot.flower_type_id == flower_type_id,
                FlowerLot.status == 'available',
                FlowerLot.expiry_date >= date.today(),
                FlowerLot.quantity > 0
            ).order_by(
                FlowerLot.expiry_date.asc(),
                FlowerLot.received_date.asc(),
                FlowerLot.id.asc()
            ).with_for_update().all()
            
            # Reduce quantities from lots using FIFO (First In First Out)
            # Takes from the lot that expires soonest first, then moves to next lot
            # Example: Lot 1 expires in 4 days (20 flowers), Lot 2 expires in 2 days (5 flowers)
            # Order needs 7 flowers: takes 5 from Lot 2, then 2 from Lot 1
            remaining = quantity_needed
            lot_updates = []
            
            for lot in lots:
                if remaining <= 0:
                    break
                
                # Take as many as needed from this lot, but not more than available
                quantity_to_take = min(remaining, lot.quantity)
                lot.quantity -= quantity_to_take
                remaining -= quantity_to_take
                
                # Update lot status if quantity reaches 0
                if lot.quantity == 0:
                    lot.status = 'sold'
                
                lot_updates.append({
                    'lot_id': lot.id,
                    'quantity_taken': quantity_to_take,
                    'remaining_quantity': lot.quantity
                })
            
            reduction_results[flower_type_id] = {
                'quantity_reduced': quantity_needed,
                'lot_updates': lot_updates
            }
        
        # Commit all changes at once
        db.session.commit()
        
        return jsonify({
            'message': 'Inventory reduced successfully',
            'results': reduction_results
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'error': f'Error reducing inventory: {str(e)}',
            'results': reduction_results
        }), 500

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
# INTERNAL ENDPOINTS (no auth required - for service-to-service)
# ============================================================

@bp.route('/internal/flowers', methods=['GET'])
def internal_get_flowers():
    """Get all flowers (internal endpoint for service-to-service communication)"""
    flowers = FlowerType.query.all()
    return jsonify({
        'flowers': [flower.to_dict() for flower in flowers]
    }), 200

@bp.route('/internal/flowers/<int:flower_id>', methods=['GET'])
def internal_get_flower(flower_id):
    """Get flower by ID (internal endpoint for service-to-service communication)"""
    flower = FlowerType.query.get(flower_id)
    if not flower:
        return jsonify({'error': 'Flower not found'}), 404
    return jsonify(flower.to_dict()), 200