from flask import Blueprint, request, jsonify
from decimal import Decimal
from database import db
from models import Order, OrderItem
import requests
from config import Config
from rabbitmq_publisher import get_publisher

config = Config()

bp = Blueprint('orders', __name__)

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

def get_user_id_from_token(token):
    """Get user ID from user service"""
    try:
        # First verify token
        user_info = verify_token()
        if not user_info:
            return None
        
        # Get user from user service
        response = requests.get(
            f"{config.USER_SERVICE_URL}/users/me",
            headers={'Authorization': token},
            timeout=5
        )
        if response.status_code == 200:
            user_data = response.json().get('user', {})
            return user_data.get('id')
    except Exception as e:
        print(f"Error getting user ID: {e}")
    
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

def require_role(*allowed_roles):
    """Decorator to require specific role"""
    from functools import wraps
    
    def decorator(f):
        @wraps(f)
        @require_auth
        def decorated_function(*args, **kwargs):
            user_info = request.current_user
            roles = user_info.get('realm_access', {}).get('roles', [])
            
            if not any(role in roles for role in allowed_roles):
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def check_inventory_availability(items, token):
    """Check if all items are available in inventory"""
    try:
        flower_type_ids = [item['flower_type_id'] for item in items]
        quantities = [item['quantity'] for item in items]
        
        params = {
            'flower_type_id': flower_type_ids,
            'quantity': quantities
        }
        
        # Flatten params for query string
        query_params = []
        for ft_id, qty in zip(flower_type_ids, quantities):
            query_params.append(f'flower_type_id={ft_id}')
            query_params.append(f'quantity={qty}')
        
        url = f"{config.INVENTORY_SERVICE_URL}/inventory/available?" + '&'.join(query_params)
        
        response = requests.get(
            url,
            headers={'Authorization': token},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            # Debug: print availability details
            print(f"Availability check response: {data}")
            return data.get('all_available', False)
        else:
            # Debug: print error response
            print(f"Availability check failed with status {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"Error checking inventory: {e}")
        return False

def get_flower_prices(items, token):
    """Get prices for flower types from inventory service"""
    prices = {}
    
    try:
        for item in items:
            flower_type_id = item['flower_type_id']
            
            response = requests.get(
                f"{config.INVENTORY_SERVICE_URL}/flowers/{flower_type_id}",
                headers={'Authorization': token},
                timeout=5
            )
            
            if response.status_code == 200:
                flower_data = response.json().get('flower', {})
                prices[flower_type_id] = float(flower_data.get('price_per_unit', 0))
            else:
                prices[flower_type_id] = 0
    except Exception as e:
        print(f"Error getting flower prices: {e}")
    
    return prices

def reduce_inventory_quantities(items, token):
    """Reduce inventory quantities after order creation"""
    try:
        response = requests.post(
            f"{config.INVENTORY_SERVICE_URL}/inventory/reduce",
            json={'items': items},
            headers={'Authorization': token},
            timeout=10
        )
        
        if response.status_code == 200:
            return True, None
        else:
            error_data = response.json() if response.content else {}
            error_msg = error_data.get('error', 'Failed to reduce inventory')
            return False, error_msg
    except Exception as e:
        print(f"Error reducing inventory: {e}")
        return False, str(e)

@bp.route('/orders', methods=['POST'])
@require_auth
def create_order():
    """Create new order (customer)"""
    data = request.get_json()
    token = request.token
    
    if 'items' not in data or not data['items']:
        return jsonify({'error': 'Order must contain at least one item'}), 400
    
    # Get user ID
    user_id = get_user_id_from_token(token)
    if not user_id:
        return jsonify({'error': 'Could not determine user ID'}), 400
    
    # Validate items
    items = data['items']
    for item in items:
        if 'flower_type_id' not in item or 'quantity' not in item:
            return jsonify({'error': 'Each item must have flower_type_id and quantity'}), 400
        if item['quantity'] <= 0:
            return jsonify({'error': 'Quantity must be positive'}), 400
    
    # Check inventory availability
    if not check_inventory_availability(items, token):
        return jsonify({'error': 'Some items are not available in sufficient quantity'}), 400
    
    # Get prices
    prices = get_flower_prices(items, token)
    
    # Calculate total
    total_price = Decimal('0.0')
    order_items = []
    
    for item in items:
        flower_type_id = item['flower_type_id']
        quantity = item['quantity']
        unit_price = Decimal(str(prices.get(flower_type_id, 0)))
        subtotal = unit_price * quantity
        total_price += subtotal
        
        order_items.append({
            'flower_type_id': flower_type_id,
            'quantity': quantity,
            'unit_price': unit_price,
            'subtotal': subtotal
        })
    
    # Create order (status will be updated to 'processing' when task is published)
    order = Order(
        user_id=user_id,
        status='pending',
        total_price=total_price,
        notes=data.get('notes')
    )
    
    db.session.add(order)
    db.session.flush()  # Get order ID
    
    # Create order items
    for item_data in order_items:
        order_item = OrderItem(
            order_id=order.id,
            **item_data
        )
        db.session.add(order_item)
    
    # Reduce inventory quantities before committing the order
    # This ensures we don't create orders if inventory can't be reduced
    success, error_msg = reduce_inventory_quantities(items, token)
    if not success:
        # Rollback the order if inventory reduction fails
        db.session.rollback()
        return jsonify({'error': f'Order creation failed: {error_msg}'}), 500
    
    # Commit the order after successful inventory reduction
    db.session.commit()
    
    # Publish assembly task to RabbitMQ queue
    try:
        import logging
        logger = logging.getLogger(__name__)
        
        publisher = get_publisher()
        # Prepare items for the worker (only flower_type_id and quantity)
        assembly_items = [
            {
                'flower_type_id': item['flower_type_id'],
                'quantity': item['quantity']
            }
            for item in items
        ]
        
        logger.info(f"Attempting to publish assembly task for order {order.id} to RabbitMQ")
        success = publisher.publish_assembly_task(order.id, assembly_items)
        
        if success:
            # Update order status to 'processing' when task is successfully published
            logger.info(f"Successfully published task for order {order.id}, updating status to 'processing'")
            order.status = 'processing'
            db.session.commit()
        else:
            logger.warning(f"Failed to publish assembly task for order {order.id} to RabbitMQ")
    except Exception as e:
        # Log error but don't fail the order creation
        # The order is already created, worker can pick it up later
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Exception while publishing assembly task to RabbitMQ: {e}", exc_info=True)
    
    return jsonify({
        'message': 'Order created',
        'order': order.to_dict()
    }), 201

@bp.route('/orders', methods=['GET'])
@require_auth
def get_orders():
    """Get list of orders"""
    user_info = request.current_user
    roles = user_info.get('realm_access', {}).get('roles', [])
    token = request.token
    
    # Admin and florar can see all orders, customers see only their own
    if 'admin' in roles or 'florar' in roles:
        orders = Order.query.order_by(Order.created_at.desc()).all()
    else:
        # Get user ID and filter orders
        user_id = get_user_id_from_token(token)
        if not user_id:
            return jsonify({'error': 'Could not determine user ID'}), 400
        
        orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    
    return jsonify({
        'orders': [order.to_dict() for order in orders]
    }), 200

@bp.route('/orders/<int:order_id>', methods=['GET'])
@require_auth
def get_order(order_id):
    """Get order by ID"""
    order = Order.query.get_or_404(order_id)
    user_info = request.current_user
    roles = user_info.get('realm_access', {}).get('roles', [])
    token = request.token
    
    # Check access - admin and florar can see all orders, customers see only their own
    if 'admin' not in roles and 'florar' not in roles:
        user_id = get_user_id_from_token(token)
        if not user_id or order.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
    
    return jsonify({
        'order': order.to_dict()
    }), 200

@bp.route('/orders/<int:order_id>/status', methods=['PUT'])
@require_role('admin')
def update_order_status(order_id):
    """Update order status (admin only)"""
    order = Order.query.get_or_404(order_id)
    data = request.get_json()
    
    if 'status' not in data:
        return jsonify({'error': 'Missing status field'}), 400
    
    valid_statuses = ['pending', 'confirmed', 'processing', 'completed', 'cancelled']
    if data['status'] not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400
    
    order.status = data['status']
    db.session.commit()
    
    return jsonify({
        'message': 'Order status updated',
        'order': order.to_dict()
    }), 200

@bp.route('/orders/user/<int:user_id>', methods=['GET'])
@require_role('admin')
def get_user_orders(user_id):
    """Get orders for a specific user (admin)"""
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    
    return jsonify({
        'user_id': user_id,
        'orders': [order.to_dict() for order in orders]
    }), 200

@bp.route('/orders/me', methods=['GET'])
@require_auth
def get_my_orders():
    """Get current user's orders"""
    token = request.token
    user_id = get_user_id_from_token(token)
    
    if not user_id:
        return jsonify({'error': 'Could not determine user ID'}), 400
    
    orders = Order.query.filter_by(user_id=user_id).order_by(Order.created_at.desc()).all()
    
    return jsonify({
        'orders': [order.to_dict() for order in orders]
    }), 200

