#!/bin/bash

# Script pentru verificarea conexiunii RabbitMQ

echo "=== Verificare RabbitMQ ==="

# Verifică dacă RabbitMQ rulează
echo "1. Verifică statusul serviciului RabbitMQ:"
docker service ps bloomflow_rabbitmq

echo ""
echo "2. Verifică logs-urile RabbitMQ:"
docker service logs bloomflow_rabbitmq --tail 20

echo ""
echo "3. Verifică logs-urile order-service pentru erori RabbitMQ:"
docker service logs bloomflow_order-service --tail 50 | grep -i -E "(rabbitmq|publish|error)" || echo "Nu s-au găsit mesaje relevante"

echo ""
echo "4. Testează conectivitatea la RabbitMQ:"
docker run --rm --network bloomflow_bloomflow_network \
  -it rabbitmq:3-management-alpine sh -c "nc -zv rabbitmq 5672" 2>&1 || echo "RabbitMQ nu este accesibil"

echo ""
echo "5. Verifică configurația RabbitMQ în order-service:"
docker service inspect bloomflow_order-service --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep -i rabbitmq

