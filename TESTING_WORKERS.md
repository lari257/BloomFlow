# Testing Guide - Bouquet Assembly Workers

Acest ghid te ajută să verifici că workerii pentru asamblarea buchetelor funcționează corect.

## Pasul 1: Build și Deploy

### 1.1 Build Imagini Docker

```bash
# Build toate imaginile, inclusiv worker-ul nou
./build-images.sh

# Sau manual pentru worker:
docker build -t bloomflow/bouquet-worker:latest ./bouquet-worker

# Verifică că imaginea a fost creată
docker images | grep bouquet-worker
```

### 1.2 Deploy Stack

```bash
# Deploy stack-ul (sau re-deploy dacă rulează deja)
./deploy.sh

# Sau manual:
docker stack deploy -c docker-stack.yml bloomflow
```

### 1.3 Verifică că Workerii Rulează

```bash
# Verifică statusul serviciilor
docker service ls | grep bloomflow

# Ar trebui să vezi:
# bloomflow_bouquet-worker  replicated  3/3  bloomflow/bouquet-worker:latest

# Verifică detaliile workerilor
docker service ps bloomflow_bouquet-worker

# Ar trebui să vezi 3 replici (tasks) în status "Running"
```

## Pasul 2: Verifică RabbitMQ

### 2.1 Accesează RabbitMQ Management UI

1. Deschide browser-ul și accesează: **http://localhost:15672**
2. Login cu:
   - Username: `bloomflow` (sau valoarea din `RABBITMQ_USER`)
   - Password: `rabbitmq123` (sau valoarea din `RABBITMQ_PASSWORD`)

### 2.2 Verifică Queue-ul

1. Mergi la tab-ul **"Queues"** (din meniul de sus)
2. Caută queue-ul `bouquet_assembly`
3. Ar trebui să vezi:
   - **Name**: `bouquet_assembly`
   - **Messages**: 0 (inițial, va crește când creezi comenzi)
   - **Consumers**: 3 (unul pentru fiecare worker replica)

## Pasul 3: Testează Workflow-ul Complet

### 3.1 Pregătește Mediul de Test

```bash
# Obține token pentru un utilizator (client)
TOKEN=$(curl -sS -X POST "http://localhost:8080/realms/bloomflow/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=bloomflow-api" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "username=testuser" \
  -d "password=test123" | jq -r .access_token)

echo "Token: $TOKEN"
```

**Notă:** Înlocuiește `YOUR_CLIENT_SECRET` cu secret-ul real din Keycloak.

### 3.2 Verifică că Există Flori în Inventar

```bash
# Listă flori disponibile
curl http://localhost:5003/flowers \
  -H "Authorization: Bearer $TOKEN" | jq .

# Dacă nu există flori, adaugă câteva (necesită rol admin sau florar)
# Vezi TESTING.md pentru instrucțiuni
```

### 3.3 Creează o Comandă de Test

```bash
# Creează o comandă (înlocuiește flower_type_id cu ID-uri reale)
curl -X POST http://localhost:5004/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "flower_type_id": 1,
        "quantity": 5
      },
      {
        "flower_type_id": 2,
        "quantity": 3
      }
    ],
    "notes": "Test order for worker verification"
  }' | jq .

# Salvează order_id din răspuns pentru următorii pași
# Exemplu răspuns:
# {
#   "message": "Order created",
#   "order": {
#     "id": 1,
#     "status": "processing",  # <-- Ar trebui să fie "processing" imediat
#     ...
#   }
# }
```

**Observație Importantă:**
- Dacă comanda este creată cu succes, statusul ar trebui să fie `"processing"` imediat (nu `"pending"`)
- Acest lucru indică că task-ul a fost publicat cu succes în RabbitMQ

## Pasul 4: Monitorizează Workerii

### 4.1 Verifică Logs-urile Workerilor

```bash
# Vezi logs-urile tuturor workerilor
docker service logs bloomflow_bouquet-worker

# Sau urmărește logs-urile în timp real
docker service logs -f bloomflow_bouquet-worker

# Ar trebui să vezi mesaje precum:
# - "Connected to RabbitMQ at rabbitmq:5672"
# - "Worker started. Waiting for messages on queue 'bouquet_assembly'..."
# - "Received assembly task for order X"
# - "Assembling bouquet for order X with Y item types..."
# - "Order X status updated to completed"
# - "Completed assembly task for order X"
```

### 4.2 Verifică în RabbitMQ UI

1. Reîmprospătează pagina RabbitMQ Management UI
2. Mergi la queue-ul `bouquet_assembly`
3. Observă:
   - **Messages**: Ar trebui să scadă când workerii procesează task-urile
   - **Message rate**: Ar trebui să vezi mesaje procesate
   - **Consumers**: Ar trebui să vezi 3 consumatori activi

### 4.3 Verifică Statusul Comenzii

```bash
# Verifică statusul comenzii (înlocuiește 1 cu order_id-ul real)
curl http://localhost:5004/orders/1 \
  -H "Authorization: Bearer $TOKEN" | jq .

# Ar trebui să vezi:
# {
#   "order": {
#     "id": 1,
#     "status": "completed",  # <-- Ar trebui să fie "completed" după ~2 secunde
#     ...
#   }
# }
```

**Timeline așteptat:**
- **T+0s**: Comandă creată, status = `"processing"`
- **T+0-2s**: Worker procesează task-ul
- **T+2s**: Status = `"completed"`

## Pasul 5: Testează Procesarea Paralelă

### 5.1 Creează Mai Multe Comenzi Rapid

```bash
# Creează 5 comenzi rapid (în paralel)
for i in {1..5}; do
  curl -X POST http://localhost:5004/orders \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"items\": [
        {
          \"flower_type_id\": 1,
          \"quantity\": 2
        }
      ],
      \"notes\": \"Test order $i\"
    }" &
done
wait

echo "Toate comenzile au fost create"
```

### 5.2 Verifică Procesarea Paralelă

```bash
# Listă toate comenzile
curl http://localhost:5004/orders \
  -H "Authorization: Bearer $TOKEN" | jq '.orders[] | {id, status}'

# Ar trebui să vezi că mai multe comenzi sunt procesate simultan
# Datorită celor 3 workeri, ar trebui să vezi:
# - Unele comenzi în status "processing" (în procesare)
# - Altele în status "completed" (finalizate)
```

### 5.3 Monitorizează în RabbitMQ UI

1. Mergi la queue-ul `bouquet_assembly`
2. Click pe tab-ul **"Get messages"**
3. Observă că mesajele sunt distribuite între cei 3 consumatori
4. Fiecare worker procesează un mesaj la un moment dat (prefetch_count=1)

## Pasul 6: Verifică Logs-urile Detaliate

### 6.1 Logs Order Service

```bash
# Verifică logs-urile order-service pentru mesaje de publicare
docker service logs bloomflow_order-service | grep -i rabbitmq

# Ar trebui să vezi:
# "Published assembly task for order X to RabbitMQ"
```

### 6.2 Logs Worker

```bash
# Verifică logs-urile unui worker specific
docker service logs bloomflow_bouquet-worker --tail 50

# Ar trebui să vezi pentru fiecare comandă:
# 1. "Received assembly task for order X"
# 2. "Assembling bouquet for order X with Y item types..."
# 3. "Order X status updated to completed"
# 4. "Completed assembly task for order X"
```

## Pasul 7: Testează Resiliența

### 7.1 Testează Reconnectarea Workerilor

```bash
# Oprește temporar RabbitMQ
docker service scale bloomflow_rabbitmq=0

# Așteaptă câteva secunde
sleep 5

# Repornește RabbitMQ
docker service scale bloomflow_rabbitmq=1

# Verifică logs-urile workerilor
docker service logs bloomflow_bouquet-worker --tail 20

# Ar trebui să vezi mesaje de reconectare:
# "Failed to connect to RabbitMQ (attempt X/5): ..."
# "Connected to RabbitMQ at rabbitmq:5672"
```

### 7.2 Testează Durabilitatea Mesajelor

```bash
# Creează o comandă
ORDER_ID=$(curl -X POST http://localhost:5004/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"flower_type_id": 1, "quantity": 1}],
    "notes": "Test durability"
  }' | jq -r '.order.id')

# Oprește toți workerii
docker service scale bloomflow_bouquet-worker=0

# Verifică în RabbitMQ UI că mesajul este în queue (Ready)

# Repornește workerii
docker service scale bloomflow_bouquet-worker=3

# Verifică că mesajul este procesat
sleep 3
curl http://localhost:5004/orders/$ORDER_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.order.status'
# Ar trebui să fie "completed"
```

## Troubleshooting

### Workerii nu pornesc

```bash
# Verifică logs-urile pentru erori
docker service logs bloomflow_bouquet-worker

# Probleme comune:
# - RabbitMQ nu este accesibil: verifică că rabbitmq rulează
# - Database connection failed: verifică variabilele de mediu
# - Import errors: verifică că requirements.txt este corect
```

### Mesajele nu sunt procesate

```bash
# Verifică că queue-ul există în RabbitMQ
# Accesează http://localhost:15672 și verifică queue-ul "bouquet_assembly"

# Verifică că workerii sunt conectați
docker service logs bloomflow_bouquet-worker | grep "Connected to RabbitMQ"

# Verifică că order-service publică mesaje
docker service logs bloomflow_order-service | grep "Published assembly task"
```

### Statusul comenzii nu se actualizează

```bash
# Verifică logs-urile workerilor pentru erori
docker service logs bloomflow_bouquet-worker | grep -i error

# Verifică conexiunea la baza de date
docker service logs bloomflow_bouquet-worker | grep -i database

# Verifică manual în baza de date
docker exec -it $(docker ps -q -f name=bloomflow_postgres) \
  psql -U bloomflow -d bloomflow_orders -c "SELECT id, status FROM orders ORDER BY id DESC LIMIT 5;"
```

### RabbitMQ nu este accesibil

```bash
# Verifică statusul
docker service ps bloomflow_rabbitmq

# Verifică logs-urile
docker service logs bloomflow_rabbitmq

# Testează conectivitatea din interiorul unui container
docker run --rm --network bloomflow_bloomflow_network \
  -it rabbitmq:3-management-alpine sh -c "nc -zv rabbitmq 5672"
```

## Checklist de Verificare

- [ ] Workerii rulează (3 replici)
- [ ] Queue-ul `bouquet_assembly` există în RabbitMQ
- [ ] Queue-ul are 3 consumatori (workers)
- [ ] Comenzile sunt create cu status `"processing"`
- [ ] Workerii procesează task-urile (vezi logs)
- [ ] Statusul comenzilor se actualizează la `"completed"`
- [ ] Procesarea paralelă funcționează (mai multe comenzi simultan)
- [ ] Mesajele persistă în queue când workerii sunt opriți

## Comenzi Rapide de Verificare

```bash
# Status general
docker service ls | grep bloomflow

# Logs worker
docker service logs -f bloomflow_bouquet-worker

# Status comenzilor
curl http://localhost:5004/orders -H "Authorization: Bearer $TOKEN" | jq '.orders[] | {id, status}'

# RabbitMQ queue status (necesită jq)
curl -u bloomflow:rabbitmq123 http://localhost:15672/api/queues/%2F/bouquet_assembly | jq '{name, messages, consumers}'
```

