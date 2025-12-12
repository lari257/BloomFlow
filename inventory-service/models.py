from datetime import datetime
from database import db

class FlowerType(db.Model):
    """Flower type model"""
    __tablename__ = 'flower_types'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True, index=True)
    color = db.Column(db.String(100), nullable=True)
    seasonality = db.Column(db.String(50), nullable=True)  # spring, summer, autumn, winter, all
    price_per_unit = db.Column(db.Numeric(10, 2), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationship with lots
    lots = db.relationship('FlowerLot', backref='flower_type', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        """Convert flower type to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'seasonality': self.seasonality,
            'price_per_unit': float(self.price_per_unit) if self.price_per_unit else 0.0,
            'description': self.description,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<FlowerType {self.name}>'

class FlowerLot(db.Model):
    """Flower lot model"""
    __tablename__ = 'flower_lots'
    
    id = db.Column(db.Integer, primary_key=True)
    flower_type_id = db.Column(db.Integer, db.ForeignKey('flower_types.id'), nullable=False, index=True)
    quantity = db.Column(db.Integer, nullable=False, default=0)
    expiry_date = db.Column(db.Date, nullable=False, index=True)
    received_date = db.Column(db.Date, default=datetime.utcnow, nullable=False)
    status = db.Column(db.String(50), nullable=False, default='available', index=True)  # available, reserved, expired, sold
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    def to_dict(self):
        """Convert flower lot to dictionary"""
        return {
            'id': self.id,
            'flower_type_id': self.flower_type_id,
            'flower_type': self.flower_type.to_dict() if self.flower_type else None,
            'quantity': self.quantity,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'received_date': self.received_date.isoformat() if self.received_date else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<FlowerLot {self.id} - {self.quantity} units>'

