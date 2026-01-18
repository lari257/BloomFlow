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