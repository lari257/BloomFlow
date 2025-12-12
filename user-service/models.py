from datetime import datetime
from database import db

# Association table for many-to-many relationship between users and roles
user_roles = db.Table('user_roles',
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True),
    db.Column('role_id', db.Integer, db.ForeignKey('roles.id'), primary_key=True)
)

class User(db.Model):
    """User model"""
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    keycloak_id = db.Column(db.String(255), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(50), nullable=False, default='client')  # admin, florar, client
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Many-to-many relationship with roles
    roles = db.relationship('Role', secondary=user_roles, lazy='subquery', backref=db.backref('users', lazy=True))
    
    def to_dict(self):
        """Convert user to dictionary"""
        return {
            'id': self.id,
            'keycloak_id': self.keycloak_id,
            'email': self.email,
            'name': self.name,
            'role': self.role,
            'roles': [role.name for role in self.roles],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def __repr__(self):
        return f'<User {self.email}>'

class Role(db.Model):
    """Role model"""
    __tablename__ = 'roles'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    def to_dict(self):
        """Convert role to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }
    
    def __repr__(self):
        return f'<Role {self.name}>'

