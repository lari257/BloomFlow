import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Configuration for Auth Service"""
    
    # Keycloak Configuration
    KEYCLOAK_SERVER_URL = os.getenv('KEYCLOAK_SERVER_URL', 'http://keycloak:8080')
    KEYCLOAK_REALM = os.getenv('KEYCLOAK_REALM', 'bloomflow')
    KEYCLOAK_CLIENT_ID = os.getenv('KEYCLOAK_CLIENT_ID', 'bloomflow-api')
    
    # Read client secret from file if available (Docker Swarm secret)
    KEYCLOAK_CLIENT_SECRET_FILE = os.getenv('KEYCLOAK_CLIENT_SECRET_FILE', '/run/secrets/keycloak_client_secret')
    
    @property
    def KEYCLOAK_CLIENT_SECRET(self):
        """Read client secret from file or environment variable"""
        if os.path.exists(self.KEYCLOAK_CLIENT_SECRET_FILE):
            with open(self.KEYCLOAK_CLIENT_SECRET_FILE, 'r') as f:
                return f.read().strip()
        return os.getenv('KEYCLOAK_CLIENT_SECRET', '')
    
    @property
    def KEYCLOAK_PUBLIC_KEY_URL(self):
        """Dynamically construct the public key URL"""
        return f"{self.KEYCLOAK_SERVER_URL}/realms/{self.KEYCLOAK_REALM}"
    
    # Flask Configuration
    FLASK_ENV = os.getenv('FLASK_ENV', 'production')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    
    # JWT Configuration
    JWT_ALGORITHM = 'RS256'