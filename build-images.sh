#!/bin/bash

# Build all Docker images for BloomFlow

set -e

echo "=== Building BloomFlow Docker Images ==="

echo "Building auth-service..."
docker build -t bloomflow/auth-service:latest ./auth-service

echo "Building user-service..."
docker build -t bloomflow/user-service:latest ./user-service

echo "Building inventory-service..."
docker build -t bloomflow/inventory-service:latest ./inventory-service

echo "Building order-service..."
docker build -t bloomflow/order-service:latest ./order-service

echo "Building bouquet-service..."
docker build -t bloomflow/bouquet-service:latest ./bouquet-service

echo "Building bouquet-worker..."
docker build -t bloomflow/bouquet-worker:latest ./bouquet-worker

echo "=== All images built successfully ==="
docker images | grep bloomflow

