from datetime import datetime
from database import db

class Order(db.Model):
    """Order model"""
    __tablename__ = 'orders'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)  # Reference to user (stored as integer, sync with user-service)
    status = db.Column(db.String(50), nullable=False, default='pending', index=True)  # pending_payment, pending, confirmed, processing, completed, cancelled
    total_price = db.Column(db.Numeric(10, 2), nullable=False, default=0.0)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Payment fields
    payment_status = db.Column(db.String(50), nullable=False, default='pending', index=True)  # pending, processing, succeeded, failed, refunded
    stripe_payment_intent_id = db.Column(db.String(255), nullable=True, index=True)
    stripe_customer_id = db.Column(db.String(255), nullable=True)
    
    # Relationship with order items
    items = db.relationship('OrderItem', backref='order', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert order to dictionary"""
        return {
            'id': self.id,
            'user_id': self.user_id,
            'status': self.status,
            'total_price': float(self.total_price) if self.total_price else 0.0,
            'notes': self.notes,
            'items': [item.to_dict() for item in self.items],
            'payment_status': self.payment_status,
            'stripe_payment_intent_id': self.stripe_payment_intent_id,
            'stripe_customer_id': self.stripe_customer_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<Order {self.id} - {self.status}>'

class OrderItem(db.Model):
    """Order item model"""
    __tablename__ = 'order_items'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False, index=True)
    flower_type_id = db.Column(db.Integer, nullable=False, index=True)  # Reference to flower type
    quantity = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Numeric(10, 2), nullable=False)
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        """Convert order item to dictionary"""
        return {
            'id': self.id,
            'order_id': self.order_id,
            'flower_type_id': self.flower_type_id,
            'quantity': self.quantity,
            'unit_price': float(self.unit_price) if self.unit_price else 0.0,
            'subtotal': float(self.subtotal) if self.subtotal else 0.0,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def __repr__(self):
        return f'<OrderItem {self.id} - {self.quantity} units>'

