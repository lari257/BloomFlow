#!/bin/bash

# BloomFlow Cleanup Script - Oprește totul și curăță resursele

set -e

echo "=== BloomFlow Cleanup ==="

# Pasul 1: Oprește stack-ul
echo "1. Oprind stack-ul bloomflow..."
docker stack rm bloomflow 2>/dev/null || echo "Stack-ul nu există sau este deja oprit"

# Pasul 2: Așteaptă până când serviciile sunt oprite
echo "2. Așteptând ca serviciile să se oprească..."
sleep 5

# Verifică dacă mai există servicii
SERVICES=$(docker service ls --format "{{.Name}}" | grep bloomflow || true)
if [ -n "$SERVICES" ]; then
    echo "   Serviciile se opresc... (poate dura câteva secunde)"
    while [ -n "$(docker service ls --format '{{.Name}}' | grep bloomflow || true)" ]; do
        sleep 2
    done
    echo "   ✓ Toate serviciile au fost oprite"
else
    echo "   ✓ Nu există servicii active"
fi

# Pasul 3: Șterge secrets (opțional - comentează dacă vrei să le păstrezi)
read -p "3. Vrei să ștergi secrets? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Șterg secrets..."
    docker secret rm postgres_password 2>/dev/null || echo "   postgres_password nu există"
    docker secret rm keycloak_admin_password 2>/dev/null || echo "   keycloak_admin_password nu există"
    docker secret rm keycloak_client_secret 2>/dev/null || echo "   keycloak_client_secret nu există"
    docker secret rm rabbitmq_password 2>/dev/null || echo "   rabbitmq_password nu există"
    echo "   ✓ Secrets șterse"
else
    echo "   Secrets păstrate"
fi

# Pasul 4: Șterge volume-uri (opțional - șterge datele din baza de date)
read -p "4. Vrei să ștergi volume-urile (inclusiv datele din baza de date)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Șterg volume-uri..."
    docker volume rm bloomflow_postgres_data 2>/dev/null || echo "   bloomflow_postgres_data nu există"
    echo "   ✓ Volume-uri șterse"
else
    echo "   Volume-uri păstrate"
fi

# Pasul 5: Șterge network (opțional)
read -p "5. Vrei să ștergi network-ul? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Șterg network..."
    docker network rm bloomflow_network 2>/dev/null || echo "   bloomflow_network nu există"
    echo "   ✓ Network șters"
else
    echo "   Network păstrat"
fi

echo ""
echo "=== Cleanup complet ==="
echo ""
echo "Pentru a începe de la capăt, rulează:"
echo "  1. ./deploy.sh  (sau ./deploy.ps1 pe Windows)"
echo "  2. Sau manual:"
echo "     - Creează secrets: docker secret create ..."
echo "     - Deploy stack: docker stack deploy -c docker-stack.yml bloomflow"

