# Ghid de Testare - BloomFlow

Acest ghid te va ajuta să testezi toate componentele implementate ale sistemului BloomFlow.

## ⚠️ IMPORTANT - Configurație Actuală

- **Nu mai folosim Docker secrets** - toate parolele sunt în variabile de mediu din `.env`
- **Bazele de date sunt create automat** de serviciul `db-init` la pornire
- **Keycloak folosește `mode: host`** pentru porturi (acces direct localhost:8080)
- **Inventory-service are retry logic** pentru conectarea la baza de date
- **Serviciile se conectează la PostgreSQL** folosind hostname-ul `postgres` (rezolvat automat în Docker Swarm)

## Pasul 1: Pregătirea Mediului

### 1.1 Verifică Docker și Docker Swarm

```bash
# Verifică versiunea Docker
docker --version

# Verifică dacă Docker Swarm este activat
docker info | grep Swarm

# Dacă nu este activat, inițializează Swarm
docker swarm init
```

### 1.2 Creează fișierul .env

Fișierul `.env` conține parolele și configurațiile necesare pentru servicii. Nu este inclus în repository pentru securitate.

**⚠️ IMPORTANT:** Fișierul `.env` este ascuns (începe cu punct) și poate să nu apară în VS Code. Vezi [CREARE_ENV.md](CREARE_ENV.md) pentru instrucțiuni detaliate.

**Ce trebuie să faci:**

1. **Creează fișierul `.env`** (alege o metodă):
   
   **Metoda A - VS Code:**
   - Apasă `Ctrl+N` pentru fișier nou
   - Apasă `Ctrl+S` și numește-l exact `.env` (cu punct la început)
   - Salvează în folderul root al proiectului
   
   **Metoda B - Terminal WSL:**
   ```bash
   cat > .env << 'EOF'
   POSTGRES_PASSWORD=bloomflow123
   KEYCLOAK_ADMIN_PASSWORD=admin123
   KEYCLOAK_CLIENT_SECRET=abc123xyz789
   RABBITMQ_PASSWORD=rabbitmq123
   EOF
   ```

2. **Copiază acest conținut în fișierul `.env`:**
   ```
   # PostgreSQL Configuration
   POSTGRES_DB=bloomflow
   POSTGRES_USER=bloomflow
   POSTGRES_PASSWORD=bloomflow123

   # Keycloak Configuration
   KEYCLOAK_ADMIN=admin
   KEYCLOAK_ADMIN_PASSWORD=admin123
   KEYCLOAK_REALM=bloomflow
   KEYCLOAK_CLIENT_ID=bloomflow-api
   KEYCLOAK_CLIENT_SECRET=abc123xyz789

   # RabbitMQ Configuration
   RABBITMQ_USER=bloomflow
   RABBITMQ_PASSWORD=rabbitmq123
   ```

3. **Verifică că există:**
   ```bash
   # Terminal
   ls -la .env
   cat .env
   
   # Sau în VS Code: Ctrl+P și scrie ".env"
   ```

**Notă:** Dacă tot nu vezi fișierul, poți continua fără el - doar setează manual parolele la pasul 1.3.

### 1.3 Exportă Variabilele de Mediu

**IMPORTANT:** Configurația actuală folosește variabile de mediu directe din `.env`, nu mai folosește Docker secrets.

```bash
# Linux/WSL - încarcă variabilele din .env
export $(grep -v '^#' .env | xargs)

# Sau setează manual:
export POSTGRES_PASSWORD=bloomflow123
export KEYCLOAK_ADMIN_PASSWORD=admin123
export KEYCLOAK_CLIENT_SECRET=abc123xyz789
export RABBITMQ_PASSWORD=rabbitmq123
export POSTGRES_DB=bloomflow
export POSTGRES_USER=bloomflow
export KEYCLOAK_ADMIN=admin
export KEYCLOAK_REALM=bloomflow
export KEYCLOAK_CLIENT_ID=bloomflow-api
export RABBITMQ_USER=bloomflow

# Verifică că variabilele sunt setate
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo "KEYCLOAK_ADMIN_PASSWORD=$KEYCLOAK_ADMIN_PASSWORD"
```

## Pasul 2: Build Imagini Docker

```bash
# Linux/Mac
./build-images.sh

# Windows PowerShell
.\build-images.ps1

# Sau manual pentru fiecare serviciu:
docker build -t bloomflow/auth-service:latest ./auth-service
docker build -t bloomflow/user-service:latest ./user-service
docker build -t bloomflow/inventory-service:latest ./inventory-service
docker build -t bloomflow/order-service:latest ./order-service
docker build -t bloomflow/bouquet-service:latest ./bouquet-service

# Verifică imagini
docker images | grep bloomflow
```

## Pasul 3: Deploy Stack

```bash
# Linux/Mac
./deploy.sh

# Windows PowerShell
.\deploy.ps1

# Sau manual:
docker stack deploy -c docker-stack.yml bloomflow
```

### 3.1 Verifică Status Servicii

```bash
# Verifică statusul tuturor serviciilor
docker service ls

# Pentru a vedea DOAR serviciile BloomFlow, filtrează:
docker service ls | grep bloomflow

# Sau listează toate serviciile și caută cele care încep cu "bloomflow_"
# Serviciile BloomFlow vor avea nume precum:
# - bloomflow_postgres
# - bloomflow_keycloak
# - bloomflow_auth-service
# - bloomflow_user-service
# - bloomflow_inventory-service
# - bloomflow_order-service
# - bloomflow_bouquet-service
# - bloomflow_rabbitmq

# Așteaptă până când toate serviciile sunt running (poate dura 1-2 minute)
watch 'docker service ls | grep bloomflow'  # Linux/Mac
# sau
while ($true) { docker service ls | Select-String "bloomflow"; Start-Sleep -Seconds 5 }  # Windows PowerShell

# Verifică logs pentru un serviciu specific
docker service logs -f bloomflow_postgres
docker service logs -f bloomflow_keycloak
docker service logs -f bloomflow_auth-service
```

**Notă:** Dacă vezi servicii de la alte proiecte (precum `scd_redis`, `scd_web`), acestea sunt normale - pot rula simultan mai multe proiecte în Docker Swarm. Serviciile BloomFlow vor avea prefixul `bloomflow_`.

### 3.2 Verifică dacă bazele de date sunt create

```bash
# Verifică logs-urile db-init
docker service logs bloomflow_db-init

# Verifică dacă bazele de date există
docker exec $(docker ps -q -f name=bloomflow_postgres) psql -U bloomflow -d postgres -c "\l" | grep bloomflow
```

Ar trebui să vezi:
- `bloomflow`
- `bloomflow_inventory`
- `bloomflow_orders`

## Pasul 4: Configurare Keycloak

### 4.1 Verifică dacă Keycloak pornește

```bash
# Verifică statusul
docker service ps bloomflow_keycloak

# Urmărește logs-urile
docker service logs -f bloomflow_keycloak
```

Caută mesajul: `Keycloak 25.0.0 ... started ... Listening on: http://0.0.0.0:8080`

### 4.2 Accesează Keycloak Admin Console

1. Așteaptă ca Keycloak să pornească complet (1-2 minute)
2. Testează accesul:
   ```bash
   curl http://localhost:8080
   ```
3. Accesează în browser: **http://localhost:8080**
4. Login cu:
   - Username: `admin` (sau valoarea din `KEYCLOAK_ADMIN`)
   - Password: valoarea din `KEYCLOAK_ADMIN_PASSWORD`

### 4.3 Creează Realm

1. Click pe dropdown "master" (stânga sus)
2. Click "Create Realm"
3. Nume realm: `bloomflow`
4. Click "Create"

### 4.4 Creează Client

1. În realm-ul `bloomflow`, mergi la "Clients" (meniu stânga)
2. Click "Create client"
3. General Settings:
   - Client type: `OpenID Connect`
   - Client ID: `bloomflow-api`
   - Click "Next"
4. Capability config:
   - Client authentication: `ON`
   - Authorization: `OFF`
   - Click "Next"
5. Login settings:
   - Valid redirect URIs: `*`
   - Web origins: `*`
   - Click "Save"
6. Mergi la tab "Credentials"
7. Copiază "Client secret" și actualizează variabila de mediu:
   ```bash
   # Exportă noul client secret
   export KEYCLOAK_CLIENT_SECRET="FUXZNF0uiYh0YVBj7lsuHl7sOj8TtB33"
   
   # Redeploy stack-ul pentru a aplica modificările
   docker stack deploy -c docker-stack.yml bloomflow
   
   # Sau actualizează doar auth-service
   docker service update --env-add KEYCLOAK_CLIENT_SECRET="oQwYxG8kbCLtKnQmdX2Py5hMAekMny40" bloomflow_auth-service
   ```

### 4.5 Creează Roluri

1. Mergi la "Realm roles" (meniu stânga)
2. Click "Create role"
3. Creează rolurile:
   - `admin` - Administrator (acces complet: gestionează utilizatori, flori, loturi, comenzi - vede toate comenzile și actualizează statusul)
   - `florar` - Florar (gestionează stocul: poate adăuga flori, crea loturi, actualiza cantități)
   - `client` - Client (utilizator standard, poate plasa comenzi)

### 4.6 Creează Utilizator de Test

1. Mergi la "Users" (meniu stânga)
2. Click "Create new user"
3. Completează:
   - Username: `testuser`
   - Email: `test@example.com`
   - First name: `Test`
   - Last name: `User`
   - Email verified: `ON`
   - Click "Create"
4. Mergi la tab "Credentials"
5. Setează password:
   - Password: `test123`
   - Temporary: `OFF`
   - Click "Save"
6. Mergi la tab "Role mapping"
7. Click "Assign role"
8. Selectează rolul `client` și click "Assign"

## Pasul 5: Obținere Token de Acces

### 5.1 Obține Token pentru Utilizator

```bash
# IMPORTANT: Înlocuiește YOUR_CLIENT_SECRET cu secret-ul real din Keycloak
# Poți găsi secret-ul în Keycloak Admin Console: Clients > bloomflow-api > Credentials > Client secret

# Obține token pentru utilizatorul de test
TOKEN=$(curl -X POST http://localhost:8080/realms/bloomflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser" \
  -d "password=test" \
  -d "grant_type=password" \
  -d "client_id=bloomflow-api" \
  -d "client_secret=FUXZNF0uiYh0YVBj7lsuHl7sOj8TtB33" | jq -r '.access_token')

# Verifică token
echo $TOKEN

# Dacă primești null, verifică răspunsul complet pentru erori:
curl -X POST http://localhost:8080/realms/bloomflow/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser" \
  -d "password=test123" \
  -d "grant_type=password" \
  -d "client_id=bloomflow-api" \
  -d "client_secret=YOUR_CLIENT_SECRET" | jq .
```
TOKEN=$(
  curl -sS -X POST "http://localhost:8080/realms/bloomflow/protocol/openid-connect/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=password" \
    -d "client_id=bloomflow-api" \
    -d "client_secret=oQwYxG8kbCLtKnQmdX2Py5hMAekMny40" \
    -d "username=admin" \
    -d "password=admin123" | jq -r .access_token
)

**Dacă primești `null`, verifică:**
1. **Client secret-ul este corect** - copiază-l din Keycloak Admin Console (Clients > bloomflow-api > Credentials)
2. **Utilizatorul există** - verifică că `testuser` există în realm-ul `bloomflow`
3. **Parola este corectă** - verifică că parola este `test123` (sau ce ai setat tu)
4. **Realm-ul există** - verifică că realm-ul `bloomflow` este creat
5. **Client-ul este configurat corect** - verifică că `bloomflow-api` are:
   - Client authentication: `ON`
   - Valid redirect URIs: `*`
   - Web origins: `*`

**Notă:** Dacă nu ai `jq` instalat:
```bash
# Linux
sudo apt-get install jq

# Mac
brew install jq

# Windows - folosește PowerShell pentru parsing JSON
```

**Alternativă PowerShell (Windows):**
```powershell
$response = Invoke-RestMethod -Uri "http://localhost:8080/realms/bloomflow/protocol/openid-connect/token" `
  -Method Post `
  -ContentType "application/x-www-form-urlencoded" `
  -Body @{
    username = "testuser"
    password = "test123"
    grant_type = "password"
    client_id = "bloomflow-api"
    client_secret = "YOUR_CLIENT_SECRET"
  }
$TOKEN = $response.access_token
```

## Pasul 6: Testare Servicii

### 6.1 Testare Auth Service

```bash
# Health check
curl http://localhost:5001/health

# Ar trebui să primești:
# {"status":"healthy","service":"auth-service"}

# Verificare token
curl -X POST http://localhost:5001/verify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"token\": \"$TOKEN\"}"

# Informații utilizator curent
curl http://localhost:5001/user \
  -H "Authorization: Bearer $TOKEN"
```

**Notă:** Auth-service depinde de Keycloak. Dacă Keycloak nu rulează, auth-service va returna erori.

### 6.2 Testare User Service

```bash
# Health check
curl http://localhost:5002/health

# Creare/sincronizare utilizator
curl -X POST http://localhost:5002/users \
  -H "Authorization: Bearer $TOKEN"

# Informații utilizator curent
curl http://localhost:5002/users/me \
  -H "Authorization: Bearer $TOKEN"

# Listă utilizatori (necesită rol admin)
curl http://localhost:5002/users \
  -H "Authorization: Bearer $TOKEN"
```

### 6.3 Testare Inventory Service

```bash
# Health check
curl http://localhost:5003/health

# Listă flori (ar trebui să fie goală inițial)
curl http://localhost:5003/flowers \
  -H "Authorization: Bearer $TOKEN"

# Adăugare tip floare (necesită rol admin sau florar)
curl -X POST http://localhost:5003/flowers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trandafir roșu",
    "color": "red",
    "seasonality": "all",
    "price_per_unit": 5.50,
    "description": "Trandafir roșu clasic"
  }'

# Adăugare alt tip floare
curl -X POST http://localhost:5000/flowers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lalea galbenă",
    "color": "yellow",
    "seasonality": "spring",
    "price_per_unit": 3.00,
    "description": "Lalea galbenă de primăvară"
  }'

# Listă flori
curl http://localhost:5003/flowers \
  -H "Authorization: Bearer $TOKEN"

# Creare lot (necesită rol admin sau florar)
curl -X POST http://localhost:5003/lots \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "flower_type_id": 1,
    "quantity": 50,
    "expiry_date": "2024-12-31",
    "status": "available"
  }'

# Listă loturi
curl http://localhost:5003/lots \
  -H "Authorization: Bearer $TOKEN"

# Sumar inventar
curl http://localhost:5003/inventory/summary \
  -H "Authorization: Bearer $TOKEN"
```

### 6.4 Testare Bouquet Service

```bash
# Health check
curl http://localhost:5005/health

# Preview buchete
curl "http://localhost:5005/bouquet/preview?budget=100&colors=red,yellow&season=spring" \
  -H "Authorization: Bearer $TOKEN"

# Reguli de compoziție
curl http://localhost:5005/bouquet/rules \
  -H "Authorization: Bearer $TOKEN"

# Validare configurație buchet
curl -X POST http://localhost:5005/bouquet/validate \
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
    ]
  }'
```

### 6.5 Testare Order Service

```bash
# Health check
curl http://localhost:5004/health

# Creare comandă
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
    "notes": "Comandă de test"
  }'

# Listă comenzi
curl http://localhost:5004/orders \
  -H "Authorization: Bearer $TOKEN"

# Comenzile mele
curl http://localhost:5004/orders/me \
  -H "Authorization: Bearer $TOKEN"

# Detalii comandă (înlocuiește 1 cu ID-ul comenzii)
curl http://localhost:5004/orders/1 \
  -H "Authorization: Bearer $TOKEN"
```

## Pasul 7: Testare Scenarii Complete

### Scenariu 1: Admin sau Florar adaugă flori și stocuri

1. Creează utilizator admin sau florar în Keycloak și atribuie-i rolul corespunzător
2. Obține token pentru admin sau florar
3. Adaugă tipuri de flori (admin sau florar)
4. Adaugă loturi pentru fiecare tip de floare (admin sau florar)

**Notă:** 
- `admin` poate face toate operațiile (inclusiv actualizare prețuri, ștergere loturi)
- `florar` poate adăuga flori, crea și actualiza loturi, dar nu poate șterge loturi sau actualiza prețurile florilor

### Scenariu 2: Client generează buchet și plasează comandă

1. Folosește token-ul utilizatorului `client`
2. Generează preview buchete cu buget și preferințe
3. Validează o configurație de buchet
4. Plasează comandă folosind configurația validată

### Scenariu 3: Admin actualizează status comandă

1. Creează utilizator admin în Keycloak și atribuie-i rolul `admin`
2. Obține token pentru admin
3. Listă toate comenzile (admin poate vedea toate comenzile, nu doar ale sale):
   ```bash
   curl http://localhost:5004/orders -H "Authorization: Bearer $TOKEN_ADMIN"
   ```
4. Actualizează statusul unei comenzi:
   ```bash
   curl -X PUT http://localhost:5004/orders/1/status \
     -H "Authorization: Bearer $TOKEN_ADMIN" \
     -H "Content-Type: application/json" \
     -d '{"status": "confirmed"}'
   ```

## Troubleshooting

### Serviciile nu pornesc

```bash
# Verifică logs
docker service logs bloomflow_<service-name>

# Verifică dacă variabilele de mediu sunt setate
env | grep POSTGRES
env | grep KEYCLOAK

# Verifică network
docker network ls | grep bloomflow

# Verifică statusul serviciilor
docker service ls | grep bloomflow
```

### Eroare de conexiune la baza de date

```bash
# Verifică dacă PostgreSQL rulează
docker service ps bloomflow_postgres

# Verifică logs PostgreSQL
docker service logs bloomflow_postgres

# Testează conexiunea
docker exec -it $(docker ps -q -f name=bloomflow_postgres) psql -U bloomflow -d bloomflow
```

### Keycloak nu pornește

```bash
# Verifică logs
docker service logs bloomflow_keycloak

# Verifică dacă PostgreSQL este accesibil
docker service ps bloomflow_postgres

# Verifică dacă baza de date bloomflow există
docker exec $(docker ps -q -f name=bloomflow_postgres) psql -U bloomflow -d postgres -c "\l" | grep bloomflow

# Testează accesul la Keycloak
curl http://localhost:8080

# Dacă curl se blochează, verifică dacă portul este expus
netstat -tlnp | grep 8080 || ss -tlnp | grep 8080
```

**Notă:** Keycloak folosește `mode: host` pentru porturi în Docker Swarm, deci ar trebui să fie accesibil direct pe `localhost:8080`.

### Token invalid sau expirat

- Token-urile JWT expiră după un timp (de obicei 5 minute în modul dev)
- Obține un token nou când expiră
- Verifică că client secret-ul este corect în Keycloak

## Curățare

```bash
# Șterge stack
docker stack rm bloomflow

# Așteaptă până când toate serviciile sunt oprite
docker service ls

# Sau folosește scriptul de cleanup
./cleanup.sh

# Șterge volume (opțional - șterge datele)
docker volume rm bloomflow_postgres_data
```

## Note Importante

1. **Porturi expuse:**
   - Keycloak: 8080
   - RabbitMQ Management: 15672
   - Auth Service: 5001
   - User Service: 5002
   - Inventory Service: 5003
   - Order Service: 5004
   - Bouquet Service: 5005

2. **Service Discovery:**
   - Serviciile se comunică între ele folosind numele serviciilor din docker-stack.yml
   - De exemplu: `http://auth-service:5000` în loc de `http://localhost:5000`

3. **Pentru testare externă:**
   - Poți expune porturile serviciilor în docker-stack.yml dacă vrei să le accesezi direct
   - Sau folosește `docker service update --publish-add 5001:5000 bloomflow_auth-service` pentru a expune un serviciu

4. **Baze de date:**
   - Bazele de date sunt create automat de serviciul `db-init` la pornire
   - Fiecare serviciu are propria bază de date:
     - `bloomflow` - pentru user-service și Keycloak
     - `bloomflow_inventory` - pentru inventory-service
     - `bloomflow_orders` - pentru order-service
   - Toate folosesc același server PostgreSQL
   - Serviciile se conectează folosind hostname-ul `postgres` (rezolvat automat în Docker Swarm)

5. **Configurație actuală:**
   - Nu mai folosim Docker secrets - toate parolele sunt în variabile de mediu din `.env`
   - Keycloak folosește `mode: host` pentru porturi (acces direct localhost:8080)
   - Inventory-service are retry logic pentru conectarea la baza de date
   - Bazele de date sunt create automat de `db-init` serviciu
