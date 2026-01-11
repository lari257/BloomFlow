# Debug Guide - RabbitMQ Connection Issues

Dacă comenzile au status "pending" în loc de "processing", înseamnă că publicarea în RabbitMQ eșuează.

## Verificări Rapide

### 1. Verifică că RabbitMQ rulează

```bash
docker service ps bloomflow_rabbitmq
```

Ar trebui să vezi status "Running".

### 2. Verifică logs-urile order-service

```bash
docker service logs bloomflow_order-service --tail 100
```

Caută mesaje despre:
- "Failed to connect to RabbitMQ"
- "Attempting to connect to RabbitMQ"
- "Successfully connected to RabbitMQ"
- "Published assembly task"

### 3. Verifică variabilele de mediu

```bash
docker service inspect bloomflow_order-service --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | grep RABBITMQ
```

Ar trebui să vezi:
- RABBITMQ_HOST=rabbitmq
- RABBITMQ_PORT=5672
- RABBITMQ_USER=bloomflow
- RABBITMQ_PASSWORD=...
- BOUQUET_QUEUE_NAME=bouquet_assembly

### 4. Testează conectivitatea

```bash
# Din interiorul unui container
docker run --rm --network bloomflow_bloomflow_network \
  -it python:3.11-slim sh -c "pip install pika && python -c 'import pika; conn = pika.BlockingConnection(pika.ConnectionParameters(\"rabbitmq\", 5672, credentials=pika.PlainCredentials(\"bloomflow\", \"rabbitmq123\"))); print(\"Connected!\"); conn.close()'"
```

## Soluții

### Soluția 1: Rebuild și Redeploy

După ce ai făcut modificările:

```bash
# 1. Rebuild imaginea order-service
docker build -t bloomflow/order-service:latest ./order-service

# 2. Redeploy stack-ul
docker stack deploy -c docker-stack.yml bloomflow

# 3. Verifică logs-urile
docker service logs -f bloomflow_order-service
```

### Soluția 2: Verifică ordinea de pornire

Order-service trebuie să pornească după RabbitMQ. Verifică că RabbitMQ este complet pornit:

```bash
# Așteaptă până când RabbitMQ este ready
docker service logs bloomflow_rabbitmq | grep "Server startup complete"
```

### Soluția 3: Verifică network-ul

```bash
# Verifică că ambele servicii sunt pe același network
docker network inspect bloomflow_bloomflow_network | grep -A 5 "Containers"
```

## Test Manual

După ce ai făcut modificările, testează manual:

```bash
# 1. Obține token
TOKEN=$(curl -sS -X POST "http://localhost:8080/realms/bloomflow/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=bloomflow-api" \
  -d "client_secret=YOUR_SECRET" \
  -d "username=testuser" \
  -d "password=test123" | jq -r .access_token)

# 2. Creează comandă
curl -X POST http://localhost:5004/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"flower_type_id": 1, "quantity": 1}], "notes": "Test"}'

# 3. Verifică logs-urile imediat
docker service logs bloomflow_order-service --tail 20
```

Ar trebui să vezi:
- "Attempting to connect to RabbitMQ at rabbitmq:5672"
- "Successfully connected to RabbitMQ"
- "Published assembly task for order X to RabbitMQ"
- "Successfully published task for order X, updating status to 'processing'"

## Dacă tot nu funcționează

1. **Verifică că RabbitMQ este accesibil:**
   ```bash
   curl http://localhost:15672
   ```

2. **Verifică că queue-ul există:**
   - Accesează http://localhost:15672
   - Login: bloomflow / rabbitmq123
   - Mergi la Queues
   - Caută "bouquet_assembly"

3. **Verifică că workerii rulează:**
   ```bash
   docker service ps bloomflow_bouquet-worker
   ```

4. **Verifică logs-urile workerilor:**
   ```bash
   docker service logs bloomflow_bouquet-worker --tail 20
   ```

