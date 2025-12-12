# BloomFlow

Platformă distribuită pentru gestionarea operațiunilor unei florării moderne.

## Descriere

BloomFlow este un sistem de microservicii care permite:
- Gestionarea stocurilor de flori pe loturi
- Generarea de configurații de buchete pe baza unor reguli de compoziție
- Procesarea comenzilor
- Autentificare și autorizare prin Keycloak
- Administrarea utilizatorilor și rolurilor

## Arhitectură

Sistemul este construit ca microservicii Flask deployate în Docker Swarm:

- **Auth Service** - Validare token-uri JWT de la Keycloak
- **User Service** - Gestionare utilizatori și roluri
- **Inventory Service** - Gestionare stocuri de flori și loturi
- **Order Service** - Gestionare comenzi
- **Bouquet Service** - Generare configurații de buchete

### Servicii de infrastructură:
- **PostgreSQL** - Baza de date principală
- **Keycloak** - Autentificare SSO
- **RabbitMQ** - Message broker (pentru viitor)

## Cerințe

- Docker Engine 20.10+
- Docker Swarm activat
- Acces la internet pentru descărcarea imaginilor Docker

## Instalare și Configurare

### 1. Clonare repository

```bash
git clone <repository-url>
cd BloomFlow
```

### 2. Configurare variabile de mediu

Creează fișierul `.env` din `.env.example`:

```bash
cp .env.example .env
```

Editează `.env` și setează valorile pentru:
- Parole PostgreSQL
- Credențiale Keycloak
- Parole RabbitMQ

### 3. Inițializare Docker Swarm

```bash
docker swarm init
```

### 4. Creare secrets Docker Swarm

```bash
# PostgreSQL password
echo "your_postgres_password" | docker secret create postgres_password -

# Keycloak admin password
echo "your_keycloak_admin_password" | docker secret create keycloak_admin_password -

# Keycloak client secret
echo "your_keycloak_client_secret" | docker secret create keycloak_client_secret -

# RabbitMQ password
echo "your_rabbitmq_password" | docker secret create rabbitmq_password -
```

### 5. Build imagini Docker

```bash
docker build -t bloomflow/auth-service ./auth-service
docker build -t bloomflow/user-service ./user-service
docker build -t bloomflow/inventory-service ./inventory-service
docker build -t bloomflow/order-service ./order-service
docker build -t bloomflow/bouquet-service ./bouquet-service
```

### 6. Deploy stack

**Linux/Mac:**
```bash
./deploy.sh
```

**Windows PowerShell:**
```powershell
.\deploy.ps1
```

**Sau manual:**
```bash
docker stack deploy -c docker-stack.yml bloomflow
```

## Verificare Status

Verifică statusul serviciilor:

```bash
docker service ls
```

Verifică logs pentru un serviciu:

```bash
docker service logs -f bloomflow_auth-service
```

## Configurare Keycloak

După ce Keycloak pornește (poate dura 1-2 minute):

1. Accesează http://localhost:8080
2. Login cu admin credentials din `.env`
3. Creează realm-ul `bloomflow`
4. Creează client-ul `bloomflow-api` cu:
   - Client ID: `bloomflow-api`
   - Access Type: `confidential`
   - Valid Redirect URIs: `*`
   - Web Origins: `*`
5. Creează rolurile: `admin`, `florar`, `client`
6. Creează utilizatori și atribuie-le roluri

## API Endpoints

### Auth Service (Port 5001)
- `GET /health` - Health check
- `POST /verify` - Verificare token
- `GET /user` - Informații utilizator curent
- `GET /roles` - Roluri utilizator

### User Service (Port 5002)
- `GET /users` - Listă utilizatori (admin)
- `GET /users/{id}` - Detalii utilizator
- `POST /users` - Creare/sincronizare utilizator
- `GET /users/me` - Utilizator curent
- `GET /users/{id}/orders` - Comenzi utilizator

### Inventory Service (Port 5003)
- `GET /flowers` - Listă tipuri de flori
- `POST /flowers` - Adăugare tip floare (admin)
- `PUT /flowers/{id}` - Actualizare tip floare (admin)
- `GET /lots` - Listă loturi
- `POST /lots` - Creare lot (admin)
- `PUT /lots/{id}` - Actualizare lot (admin)
- `PATCH /lots/{id}/quantity` - Actualizare cantitate (admin)
- `DELETE /lots/{id}` - Ștergere lot (admin)
- `GET /inventory/summary` - Sumar stocuri

### Order Service (Port 5004)
- `POST /orders` - Creare comandă (customer)
- `GET /orders` - Listă comenzi
- `GET /orders/{id}` - Detalii comandă
- `PUT /orders/{id}/status` - Actualizare status (admin only)
- `GET /orders/me` - Comenzile mele (customer)

### Bouquet Service (Port 5005)
- `GET /bouquet/preview?budget=100&colors=red,pink&season=spring` - Preview buchete
- `POST /bouquet/validate` - Validare configurație buchet
- `GET /bouquet/rules` - Reguli de compoziție

## Utilizare API

Toate endpoint-urile (exceptând `/health`) necesită autentificare. Vezi [TESTING.md](TESTING.md) pentru ghid complet de testare.

```bash
# Obține token de la Keycloak
TOKEN=$(curl -X POST http://localhost:8080/realms/bloomflow/protocol/openid-connect/token \
  -d "client_id=bloomflow-api" \
  -d "client_secret=your_secret" \
  -d "grant_type=client_credentials" | jq -r '.access_token')

# Folosește token în request-uri
curl -H "Authorization: Bearer $TOKEN" http://localhost:5002/users/me
```

## Scalare Servicii

Scalare un serviciu:

```bash
docker service scale bloomflow_auth-service=3
```

## Dezinstalare

Ștergere stack:

```bash
docker stack rm bloomflow
```

Ștergere secrets (opțional):

```bash
docker secret rm postgres_password keycloak_admin_password keycloak_client_secret rabbitmq_password
```

## Dezvoltare

Pentru dezvoltare locală, poți rula serviciile individual:

```bash
cd auth-service
pip install -r requirements.txt
python app.py
```

## Structură Proiect

```
BloomFlow/
├── auth-service/          # Serviciu autentificare
├── user-service/          # Serviciu utilizatori
├── inventory-service/     # Serviciu inventar
├── order-service/         # Serviciu comenzi
├── bouquet-service/       # Serviciu buchete
├── docker-stack.yml       # Configurație Docker Swarm
├── deploy.sh              # Script deploy (Linux/Mac)
├── deploy.ps1             # Script deploy (Windows)
├── .env.example           # Template variabile mediu
└── README.md              # Acest fișier
```

## Autor

Florea Larisa-Elena, 341C1
Coordonator: Bogdan-Costel Mocanu

## Licență

Proiect academic - SCD
