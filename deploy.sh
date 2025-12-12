#!/bin/bash

# BloomFlow Docker Swarm Deployment Script

set -e

# Function to convert Windows line endings to Unix
convert_line_endings() {
    if [ -f "$1" ]; then
        sed -i 's/\r$//' "$1" 2>/dev/null || sed -i '' 's/\r$//' "$1" 2>/dev/null || true
    fi
}

echo "=== BloomFlow Docker Swarm Deployment ==="

# Check if Docker Swarm is initialized
if ! docker info | grep -q "Swarm: active"; then
    echo "Initializing Docker Swarm..."
    docker swarm init
else
    echo "Docker Swarm is already initialized"
fi

# Create overlay network if it doesn't exist
echo "Creating overlay network..."
docker network create --driver overlay --attachable bloomflow_network 2>/dev/null || echo "Network already exists"

# Create secrets if they don't exist
echo "Creating secrets..."

# Read secrets from .env file or use defaults
if [ -f .env ]; then
    # Load .env file, handling both Unix and Windows line endings
    # Remove comments, empty lines, and Windows line endings, then export variables
    while IFS= read -r line || [ -n "$line" ]; do
        # Remove Windows line endings
        line=$(echo "$line" | tr -d '\r')
        # Skip empty lines and comments
        if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            # Export the variable
            export "$line" 2>/dev/null || true
        fi
    done < .env
else
    echo "WARNING: .env file not found. Using default values or you can set them manually."
fi

# Set defaults if not set
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-bloomflow123}
KEYCLOAK_ADMIN_PASSWORD=${KEYCLOAK_ADMIN_PASSWORD:-admin123}
KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET:-abc123xyz789}
RABBITMQ_PASSWORD=${RABBITMQ_PASSWORD:-rabbitmq123}

# Create PostgreSQL password secret
echo "$POSTGRES_PASSWORD" | docker secret create postgres_password - 2>/dev/null || echo "postgres_password secret already exists"

# Create Keycloak admin password secret
echo "$KEYCLOAK_ADMIN_PASSWORD" | docker secret create keycloak_admin_password - 2>/dev/null || echo "keycloak_admin_password secret already exists"

# Create Keycloak client secret
echo "$KEYCLOAK_CLIENT_SECRET" | docker secret create keycloak_client_secret - 2>/dev/null || echo "keycloak_client_secret secret already exists"

# Create RabbitMQ password secret
echo "$RABBITMQ_PASSWORD" | docker secret create rabbitmq_password - 2>/dev/null || echo "rabbitmq_password secret already exists"

# Build images (build locally first, then deploy)
echo "Note: Build images manually before deploying:"
echo "  docker build -t bloomflow/auth-service ./auth-service"
echo "  docker build -t bloomflow/user-service ./user-service"
echo "  docker build -t bloomflow/inventory-service ./inventory-service"
echo "  docker build -t bloomflow/order-service ./order-service"
echo "  docker build -t bloomflow/bouquet-service ./bouquet-service"

# Deploy stack
echo "Deploying stack..."
docker stack deploy -c docker-stack.yml bloomflow

echo "=== Deployment complete ==="
echo "Waiting for services to start..."
sleep 10

# Show service status
echo "Service status:"
docker service ls | grep bloomflow

echo ""
echo "To view logs: docker service logs -f bloomflow_<service-name>"
echo "To scale a service: docker service scale bloomflow_<service-name>=<replicas>"
echo "To remove stack: docker stack rm bloomflow"

