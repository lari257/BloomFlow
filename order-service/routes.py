from flask import Blueprint, request, jsonify
from decimal import Decimal
from database import db
from models import Order, OrderItem
import requests
from config import Config
from rabbitmq_publisher import get_publisher
from notification_publisher import get_notification_publisher
import stripe
import logging

config = Config()
stripe.api_key = config.STRIPE_SECRET_KEY

logger = logging.getLogger(__name__)

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
        # Get user from user service
        response = requests.get(
            f"{config.USER_SERVICE_URL}/users/me",
            headers={'Authorization': token},
            timeout=10  # Increased timeout
        )
        logger.info(f"User service response status: {response.status_code}")
        if response.status_code == 200:
            user_data = response.json().get('user', {})
            user_id = user_data.get('id')
            logger.info(f"Got user_id from user service: {user_id}")
            return user_id
        else:
            logger.warning(f"User service returned status {response.status_code}")
    except Exception as e:
        logger.error(f"Error getting user ID: {e}")
    
    return None

def get_roles_from_token(user_info):
    """
    Extract roles from token.
    Auth-service can return roles in 2 formats:
    1. Directly in 'roles' (current auth-service format)
    2. In 'realm_access.roles' (original Keycloak format)
    """
    # First check: directly in 'roles'
    if 'roles' in user_info:
        return user_info.get('roles', [])
    
    # Second check: in realm_access.roles
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
            roles = get_roles_from_token(user_info)
            
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

def process_payment_success(order_id, token):
    """Process order after successful payment: update status, reduce inventory, publish to RabbitMQ"""
    try:
        order = Order.query.get(order_id)
        if not order:
            logger.error(f"Order {order_id} not found for payment processing")
            return False, "Order not found"
        
        # Update order status to pending
        order.status = 'pending'
        order.payment_status = 'succeeded'
        db.session.commit()
        
        # Publish order_confirmed notification
        try:
            notification_publisher = get_notification_publisher()
            notification_publisher.publish_notification('order_confirmed', order.id, order.user_id)
        except Exception as e:
            logger.error(f"Error publishing order_confirmed notification for order {order_id}: {e}")
        
        # Prepare items for inventory reduction
        items = [
            {
                'flower_type_id': item.flower_type_id,
                'quantity': item.quantity
            }
            for item in order.items
        ]
        
        # Reduce inventory quantities
        success, error_msg = reduce_inventory_quantities(items, token)
        if not success:
            logger.error(f"Failed to reduce inventory for order {order_id}: {error_msg}")
            # Rollback order status
            order.status = 'pending_payment'
            order.payment_status = 'failed'
            db.session.commit()
            return False, f"Inventory reduction failed: {error_msg}"
        
        # Publish order_paid notification
        try:
            notification_publisher = get_notification_publisher()
            notification_publisher.publish_notification('order_paid', order.id, order.user_id)
        except Exception as e:
            logger.error(f"Error publishing order_paid notification for order {order_id}: {e}")
        
        # Publish assembly task to RabbitMQ queue
        try:
            publisher = get_publisher()
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
                logger.info(f"Successfully published task for order {order.id}, updating status to 'processing'")
                order.status = 'processing'
                db.session.commit()
            else:
                logger.warning(f"Failed to publish assembly task for order {order.id} to RabbitMQ")
        except Exception as e:
            logger.error(f"Exception while publishing assembly task to RabbitMQ: {e}", exc_info=True)
        
        return True, None
    except Exception as e:
        logger.error(f"Error processing payment success for order {order_id}: {e}", exc_info=True)
        return False, str(e)


@bp.route('/orders', methods=['POST'])
@require_auth
def create_order():
    """Create new order (only admin and client roles allowed)"""
    user_info = request.current_user
    roles = get_roles_from_token(user_info)
    if not any(role in roles for role in ['admin', 'client']):
        return jsonify({'error': 'Insufficient permissions: only admin and client can create orders'}), 403

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

    # Create order with pending_payment status (payment required before processing)
    order = Order(
        user_id=user_id,
        status='pending_payment',
        payment_status='pending',
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

    # Commit the order (don't reduce inventory yet - wait for payment confirmation)
    db.session.commit()

    return jsonify({
        'message': 'Order created, payment required',
        'order': order.to_dict()
    }), 201

@bp.route('/orders', methods=['GET'])
@require_auth
def get_orders():
    """Get list of orders"""
    user_info = request.current_user
    roles = get_roles_from_token(user_info)
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
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    user_info = request.current_user
    roles = get_roles_from_token(user_info)
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
@require_auth
def update_order_status(order_id):
    """Update order status (admin, florar, client can cancel if not paid)"""
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    data = request.get_json()

    if 'status' not in data:
        return jsonify({'error': 'Missing status field'}), 400

    valid_statuses = ['pending_payment', 'pending', 'confirmed', 'processing', 'completed', 'cancelled']
    if data['status'] not in valid_statuses:
        return jsonify({'error': f'Invalid status. Must be one of: {", ".join(valid_statuses)}'}), 400

    user_info = request.current_user
    roles = get_roles_from_token(user_info)
    token = request.token

    # Only allow cancellation if payment_status is 'pending'
    if data['status'] == 'cancelled':
        if order.payment_status != 'processing':
            return jsonify({'error': 'Cannot cancel: order already paid or in process'}), 403
        # Admin/florar can cancel any unpaid order
        if 'admin' in roles or 'florar' in roles:
            pass
        else:
            # Client can only cancel their own unpaid order
            user_id = get_user_id_from_token(token)
            if not user_id or order.user_id != user_id:
                return jsonify({'error': 'Access denied'}), 403
    else:
        # Only admin can update to other statuses
        if 'admin' not in roles:
            return jsonify({'error': 'Only admin can update status except cancellation'}), 403

    old_status = order.status
    order.status = data['status']
    db.session.commit()

    # Publish order_completed notification when order is marked as completed
    if data['status'] == 'completed' and old_status != 'completed':
        try:
            notification_publisher = get_notification_publisher()
            notification_publisher.publish_notification('order_completed', order.id, order.user_id)
            logger.info(f"Published order_completed notification for order {order.id}")
        except Exception as e:
            logger.error(f"Error publishing order_completed notification for order {order.id}: {e}")

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

@bp.route('/orders/<int:order_id>/create-payment-intent', methods=['POST'])
@require_auth
def create_payment_intent(order_id):
    """Create Stripe payment intent for an order"""
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    token = request.token
    
    # Check access - users can only create payment intents for their own orders
    user_info = request.current_user
    roles = get_roles_from_token(user_info)
    logger.info(f"Payment intent request - Order ID: {order_id}, Order user_id: {order.user_id}, Roles: {roles}")
    
    # Check if order is in correct status
    if order.status != 'pending_payment':
        return jsonify({'error': f'Order is not in pending_payment status. Current status: {order.status}'}), 400
    
    # Check if payment intent already exists - return it without full user validation
    if order.stripe_payment_intent_id:
        try:
            payment_intent = stripe.PaymentIntent.retrieve(order.stripe_payment_intent_id)
            logger.info(f"Returning existing payment intent for order {order_id}")
            return jsonify({
                'client_secret': payment_intent.client_secret,
                'payment_intent_id': payment_intent.id
            }), 200
        except stripe.error.StripeError as e:
            logger.error(f"Error retrieving existing payment intent: {e}")
            # Continue to validate user and create new payment intent
    
    # Full access check for creating new payment intent
    if 'admin' not in roles and 'florar' not in roles:
        user_id = get_user_id_from_token(token)
        logger.info(f"Payment intent access check - Token user_id: {user_id}, Order user_id: {order.user_id}")
        if not user_id or order.user_id != user_id:
            logger.warning(f"Access denied for payment intent - user_id: {user_id}, order.user_id: {order.user_id}")
            return jsonify({'error': 'Access denied'}), 403
    
    try:
        # Convert total_price to cents (Stripe uses smallest currency unit)
        amount_cents = int(float(order.total_price) * 100)
        
        # Create payment intent
        payment_intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            metadata={
                'order_id': order.id,
                'user_id': order.user_id
            },
            automatic_payment_methods={
                'enabled': True,
            },
        )
        
        # Update order with payment intent ID
        order.stripe_payment_intent_id = payment_intent.id
        order.payment_status = 'processing'
        db.session.commit()
        
        return jsonify({
            'client_secret': payment_intent.client_secret,
            'payment_intent_id': payment_intent.id
        }), 200
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating payment intent: {e}")
        return jsonify({'error': f'Payment intent creation failed: {str(e)}'}), 500
    except Exception as e:
        logger.error(f"Error creating payment intent: {e}", exc_info=True)
        return jsonify({'error': 'Failed to create payment intent'}), 500

@bp.route('/orders/<int:order_id>/confirm-payment', methods=['POST'])
@require_auth
def confirm_payment(order_id):
    """Confirm payment after frontend processes it"""
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    data = request.get_json()
    token = request.token
    
    # Check access
    user_info = request.current_user
    roles = get_roles_from_token(user_info)
    if 'admin' not in roles and 'florar' not in roles:
        user_id = get_user_id_from_token(token)
        if not user_id or order.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
    
    payment_intent_id = data.get('payment_intent_id') or order.stripe_payment_intent_id
    if not payment_intent_id:
        return jsonify({'error': 'Payment intent ID is required'}), 400
    
    try:
        # Retrieve payment intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if payment_intent.status == 'succeeded':
            # Payment already succeeded, process the order
            success, error_msg = process_payment_success(order_id, token)
            if success:
                order = Order.query.get(order_id)  # Refresh order
                return jsonify({
                    'message': 'Payment confirmed',
                    'order': order.to_dict()
                }), 200
            else:
                return jsonify({'error': error_msg}), 500
        elif payment_intent.status == 'requires_payment_method':
            return jsonify({'error': 'Payment method is required'}), 400
        elif payment_intent.status == 'requires_confirmation':
            return jsonify({'error': 'Payment requires confirmation'}), 400
        else:
            order.payment_status = 'failed'
            db.session.commit()
            return jsonify({'error': f'Payment status: {payment_intent.status}'}), 400
            
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error confirming payment: {e}")
        order.payment_status = 'failed'
        db.session.commit()
        return jsonify({'error': f'Payment confirmation failed: {str(e)}'}), 500
    except Exception as e:
        logger.error(f"Error confirming payment: {e}", exc_info=True)
        return jsonify({'error': 'Failed to confirm payment'}), 500

@bp.route('/orders/<int:order_id>/test-payment', methods=['POST'])
@require_auth
def test_payment(order_id):
    """
    Test endpoint to simulate a successful Stripe payment using test card.
    This endpoint is for testing/demo purposes only.
    Uses Stripe's test payment method to complete payment flow.
    """
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    token = request.token
    
    # Check access
    user_info = request.current_user
    roles = get_roles_from_token(user_info)
    if 'admin' not in roles and 'florar' not in roles:
        user_id = get_user_id_from_token(token)
        if not user_id or order.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
    
    # Check if order is in correct status
    if order.status != 'pending_payment':
        return jsonify({'error': f'Order is not in pending_payment status. Current status: {order.status}'}), 400
    
    try:
        # Convert total_price to cents (Stripe uses smallest currency unit)
        amount_cents = int(float(order.total_price) * 100)
        
        # Create a PaymentIntent with automatic confirmation using test card
        # pm_card_visa is a Stripe test payment method that always succeeds
        payment_intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='usd',
            payment_method='pm_card_visa',  # Stripe test card - always succeeds
            confirm=True,  # Automatically confirm the payment
            automatic_payment_methods={
                'enabled': True,
                'allow_redirects': 'never'
            },
            metadata={
                'order_id': order.id,
                'user_id': order.user_id,
                'test_payment': 'true'
            }
        )
        
        # Update order with payment intent ID
        order.stripe_payment_intent_id = payment_intent.id
        db.session.commit()
        
        # Check if payment succeeded
        if payment_intent.status == 'succeeded':
            # Process the order (reduce inventory, publish to RabbitMQ, etc.)
            success, error_msg = process_payment_success(order_id, token)
            if success:
                order = Order.query.get(order_id)  # Refresh order
                return jsonify({
                    'message': 'Test payment successful',
                    'payment_intent_id': payment_intent.id,
                    'payment_status': payment_intent.status,
                    'order': order.to_dict()
                }), 200
            else:
                return jsonify({
                    'error': f'Payment succeeded but order processing failed: {error_msg}',
                    'payment_intent_id': payment_intent.id
                }), 500
        else:
            return jsonify({
                'error': f'Payment not completed. Status: {payment_intent.status}',
                'payment_intent_id': payment_intent.id
            }), 400
            
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error in test payment: {e}")
        return jsonify({'error': f'Stripe error: {str(e)}'}), 500
    except Exception as e:
        logger.error(f"Error in test payment: {e}", exc_info=True)
        return jsonify({'error': f'Test payment failed: {str(e)}'}), 500


@bp.route('/webhook/stripe', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhook events for all orders"""
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature')
    
    if not config.STRIPE_WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET not configured, skipping webhook verification")
        event = None
        try:
            import json
            event = json.loads(payload)
        except:
            return jsonify({'error': 'Invalid payload'}), 400
    else:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, config.STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.error(f"Invalid payload: {e}")
            return jsonify({'error': 'Invalid payload'}), 400
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid signature: {e}")
            return jsonify({'error': 'Invalid signature'}), 400
    
    # Handle the event
    event_type = event.get('type')
    event_data = event.get('data', {}).get('object', {})
    
    if event_type == 'payment_intent.succeeded':
        payment_intent = event_data
        payment_intent_id = payment_intent.get('id')
        
        # Find order by payment intent ID
        order = Order.query.filter_by(stripe_payment_intent_id=payment_intent_id).first()
        
        if not order:
            logger.warning(f"Order not found for payment intent {payment_intent_id}")
            return jsonify({'received': True, 'message': 'Order not found'}), 200
        
        # Extract order_id from metadata if available, otherwise use the found order
        order_id = payment_intent.get('metadata', {}).get('order_id')
        if order_id:
            try:
                order_id = int(order_id)
            except (ValueError, TypeError):
                order_id = order.id
        else:
            order_id = order.id
        
        # Verify the order matches
        if order.id != order_id:
            logger.warning(f"Order ID mismatch: metadata says {order_id}, but found order {order.id}")
            order_id = order.id
        
        # Get token from request if available, otherwise use a placeholder
        token = request.headers.get('Authorization', '')
        success, error_msg = process_payment_success(order_id, token)
        if success:
            logger.info(f"Payment succeeded for order {order_id}")
            return jsonify({'received': True}), 200
        else:
            logger.error(f"Failed to process payment success for order {order_id}: {error_msg}")
            return jsonify({'error': error_msg}), 500
    
    elif event_type == 'payment_intent.payment_failed':
        payment_intent = event_data
        payment_intent_id = payment_intent.get('id')
        
        # Find order by payment intent ID
        order = Order.query.filter_by(stripe_payment_intent_id=payment_intent_id).first()
        
        if not order:
            logger.warning(f"Order not found for payment intent {payment_intent_id}")
            return jsonify({'received': True, 'message': 'Order not found'}), 200
        
        order.payment_status = 'failed'
        db.session.commit()
        logger.info(f"Payment failed for order {order.id}")
        return jsonify({'received': True}), 200
    
    else:
        logger.info(f"Unhandled event type: {event_type}")
    
    return jsonify({'received': True}), 200


# ============================================================
# INTERNAL SERVICE-TO-SERVICE ENDPOINTS (no auth required)
# ============================================================

@bp.route('/internal/orders/<int:order_id>', methods=['GET'])
def get_order_internal(order_id):
    """
    Internal endpoint for service-to-service communication.
    Used by notification-service to fetch order details.
    """
    order = Order.query.get(order_id)
    if not order:
        return jsonify({'error': 'Order not found'}), 404
    return jsonify(order.to_dict()), 200

