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
- **PostgreSQL** - Baza de date principală (Primary + Replica)
- **Keycloak** - Autentificare SSO
- **RabbitMQ** - Message broker pentru procesare asincronă
- **Stripe** - Procesare plăți

## Deployment

```bash
# Build și deploy
./build-images.sh
./deploy.sh

# Cleanup
./cleanup.sh
```

## Testare API cu Postman

### 1. Obținere Token de Autentificare

Pentru a testa API-urile, ai nevoie de un token JWT de la Keycloak.

**Request pentru obținere token:**

```
POST http://localhost:8080/realms/bloomflow/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded
```

**Body (x-www-form-urlencoded):**
| Key | Value |
|-----|-------|
| grant_type | password |
| client_id | bloomflow-api |
| client_secret | FUXZNF0uiYh0YVBj7lsuHl7sOj8TtB33 |
| username | admin |
| password | admin123 |

**Răspuns:**
```json
{
  "access_token": "eyJhbGciOiJS...",
  "token_type": "Bearer",
  "expires_in": 300
}
```

### 2. Configurare Postman

1. Copiază valoarea `access_token` din răspuns
2. În Postman, pentru fiecare request, adaugă header-ul:
   ```
   Authorization: Bearer <token_copiat>
   ```

**Sau folosește Postman Environment Variables:**
- Creează o variabilă `token` și setează-o cu valoarea access_token
- Folosește `{{token}}` în header: `Authorization: Bearer {{token}}`

### 3. Endpoints API

#### Auth Service (port 5010)
| Metoda | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `http://localhost:5010/health` | Health check |
| POST | `http://localhost:5010/verify` | Verificare token |
| GET | `http://localhost:5010/user` | Info user curent |
| GET | `http://localhost:5010/roles` | Roluri user |

#### User Service (port 5001)
| Metoda | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `http://localhost:5001/users` | Lista utilizatori (admin) |
| GET | `http://localhost:5001/users/me` | Profil utilizator curent |
| POST | `http://localhost:5001/users/signup` | Înregistrare cont nou |
| GET | `http://localhost:5001/users/pending-approvals` | Cereri pending (admin) |
| POST | `http://localhost:5001/users/{id}/approve` | Aprobare florar (admin) |
| POST | `http://localhost:5001/users/{id}/reject` | Respingere cerere (admin) |
| PUT | `http://localhost:5001/users/me/notifications` | Update notificări |

#### Inventory Service (port 5002)
| Metoda | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `http://localhost:5002/flowers` | Lista tipuri flori |
| POST | `http://localhost:5002/flowers` | Adaugă tip floare (admin/florar) |
| PUT | `http://localhost:5002/flowers/{id}` | Update tip floare |
| DELETE | `http://localhost:5002/flowers/{id}` | Șterge tip floare (admin) |
| GET | `http://localhost:5002/lots` | Lista loturi |
| POST | `http://localhost:5002/lots` | Adaugă lot (admin/florar) |
| PUT | `http://localhost:5002/lots/{id}` | Update lot |
| DELETE | `http://localhost:5002/lots/{id}` | Șterge lot (admin) |
| GET | `http://localhost:5002/lots/expiring` | Loturi care expiră curând |
| GET | `http://localhost:5002/inventory/summary` | Sumar stoc |
| GET | `http://localhost:5002/inventory/available` | Verificare disponibilitate |

#### Order Service (port 5003)
| Metoda | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `http://localhost:5003/orders` | Lista comenzi |
| POST | `http://localhost:5003/orders` | Creare comandă |
| GET | `http://localhost:5003/orders/{id}` | Detalii comandă |
| PUT | `http://localhost:5003/orders/{id}/status` | Update status (admin) |
| GET | `http://localhost:5003/orders/me` | Comenzile mele |
| POST | `http://localhost:5003/orders/{id}/create-payment-intent` | Creare plată Stripe |
| POST | `http://localhost:5003/orders/{id}/confirm-payment` | Confirmare plată |
| POST | `http://localhost:5003/orders/{id}/test-payment` | Simulare plată (test) |

#### Bouquet Service (port 5004)
| Metoda | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `http://localhost:5004/bouquet/preview?budget=100` | Preview buchete |
| POST | `http://localhost:5004/bouquet/validate` | Validare configurație |
| GET | `http://localhost:5004/bouquet/rules` | Reguli compoziție |

#### Reports Service (port 5005)
| Metoda | Endpoint | Descriere |
|--------|----------|-----------|
| GET | `http://localhost:5005/reports/sales/summary` | Sumar vânzări |
| GET | `http://localhost:5005/reports/sales/daily` | Vânzări zilnice |
| GET | `http://localhost:5005/reports/inventory/levels` | Niveluri stoc |
| GET | `http://localhost:5005/reports/inventory/low-stock` | Stoc scăzut |
| GET | `http://localhost:5005/reports/inventory/expiring` | Stoc care expiră |
| GET | `http://localhost:5005/reports/orders/status` | Comenzi per status |
| GET | `http://localhost:5005/reports/orders/top-products` | Produse populare |
| GET | `http://localhost:5005/reports/dashboard` | Dashboard complet |

### 4. Exemple Request-uri

#### Creare tip floare:
```
POST http://localhost:5002/flowers
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Trandafir Roșu",
  "color": "red",
  "seasonality": "all",
  "price_per_unit": 5.50,
  "description": "Trandafir roșu clasic"
}
```

#### Adăugare lot:
```
POST http://localhost:5002/lots
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "flower_type_id": 1,
  "quantity": 100,
  "expiry_date": "2026-02-01"
}
```

#### Creare comandă:
```
POST http://localhost:5003/orders
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "items": [
    {"flower_type_id": 1, "quantity": 10},
    {"flower_type_id": 2, "quantity": 5}
  ],
  "notes": "Livrare dimineața"
}
```

#### Simulare plată (pentru testare):
```
POST http://localhost:5003/orders/1/test-payment
Authorization: Bearer {{token}}
```

#### Preview buchete:
```
GET http://localhost:5004/bouquet/preview?budget=50&colors=red,white&season=spring
Authorization: Bearer {{token}}
```

### 5. Utilizatori de Test

| Username | Password | Rol |
|----------|----------|-----|
| admin | admin123 | Administrator |

### 6. Coduri de Răspuns

| Cod | Semnificație |
|-----|--------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - date invalide |
| 401 | Unauthorized - token lipsă/invalid |
| 403 | Forbidden - permisiuni insuficiente |
| 404 | Not Found - resursă inexistentă |
| 409 | Conflict - resursă duplicată |
| 500 | Server Error |

