#!/bin/bash

# =============================================================================
# BloomFlow Worker Fault Tolerance Demo
# =============================================================================
# Simple demonstration: Kill workers one by one, orders still get processed
# =============================================================================

# Get script directory and source .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

RABBITMQ_USER="${RABBITMQ_USER:-bloomflow}"
RABBITMQ_PASSWORD="${RABBITMQ_PASSWORD:-rabbitmq123}"
ORDER_SERVICE="http://localhost:5004"

# Get token
get_token() {
    curl -sS -X POST "http://localhost:8080/realms/bloomflow/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password" \
        -d "client_id=bloomflow-api" \
        -d "client_secret=${KEYCLOAK_CLIENT_SECRET:-}" \
        -d "username=larisa" \
        -d "password=test" 2>/dev/null | jq -r '.access_token // empty'
}

# Get worker containers
get_workers() {
    docker ps --filter "name=bloomflow_bouquet-worker" --format "{{.ID}}" 2>/dev/null
}

# Get consumer count
get_consumers() {
    curl -s -u "$RABBITMQ_USER:$RABBITMQ_PASSWORD" \
        "http://localhost:15672/api/queues/%2F/bouquet_assembly" 2>/dev/null | jq -r '.consumers // 0'
}

# Create and queue order using Stripe test payment
create_order() {
    local ORDER_NUM=$1
    
    # Step 1: Create order (status: pending_payment)
    RESPONSE=$(curl -s -X POST "$ORDER_SERVICE/orders" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"items\": [{\"flower_type_id\": 1, \"quantity\": 1}], \"notes\": \"Test $ORDER_NUM\"}" 2>/dev/null)
    
    ORDER_ID=$(echo "$RESPONSE" | jq -r '.order.id // empty')
    [ -z "$ORDER_ID" ] && return 1
    
    # Step 2: Use test payment endpoint (Stripe test card)
    PAYMENT_RESPONSE=$(curl -s -X POST "$ORDER_SERVICE/orders/$ORDER_ID/test-payment" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null)
    
    PAYMENT_STATUS=$(echo "$PAYMENT_RESPONSE" | jq -r '.order.status // empty')
    if [ "$PAYMENT_STATUS" != "processing" ]; then
        echo "Payment failed: $(echo "$PAYMENT_RESPONSE" | jq -r '.error // "unknown"')" >&2
        return 1
    fi
    
    echo "$ORDER_ID"
}

# Check order status
check_order() {
    curl -s "$ORDER_SERVICE/orders/$1" -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r '.order.status // "unknown"'
}

# Wait for order to complete with status updates
wait_for_order() {
    local ORDER_ID=$1
    local MAX_WAIT=15
    local FINAL_STATUS="unknown"
    
    for i in $(seq 1 $MAX_WAIT); do
        FINAL_STATUS=$(check_order $ORDER_ID)
        if [ "$FINAL_STATUS" == "completed" ]; then
            echo -ne "\r   Order #$ORDER_ID: ${GREEN}completed${NC} (${i}s)          \n" >&2
            echo "completed"
            return 0
        fi
        echo -ne "\r   Order #$ORDER_ID: ${YELLOW}$FINAL_STATUS${NC} (${i}s)..." >&2
        sleep 1
    done
    echo -e "\r   Order #$ORDER_ID: ${YELLOW}$FINAL_STATUS${NC} (timeout)         " >&2
    echo "$FINAL_STATUS"
}

# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}       WORKER FAULT TOLERANCE DEMONSTRATION${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

TOKEN=$(get_token)
if [ -z "$TOKEN" ]; then
    echo -e "${RED}Failed to get token${NC}"
    exit 1
fi

# =============================================================================
# PHASE 1: Initial state with 3 workers
# =============================================================================
echo -e "${CYAN}▶ PHASE 1: Initial State (3 Workers)${NC}"
echo "────────────────────────────────────────"

WORKERS=($(get_workers))
echo -e "   Workers running: ${GREEN}${#WORKERS[@]}${NC}"
echo -e "   Queue consumers: ${GREEN}$(get_consumers)${NC}"

echo ""
echo "   Creating order #1 (with Stripe test payment)..."
ORDER1=$(create_order 1)
echo -e "   Order #$ORDER1 created → payment processed → sent to assembly queue"
STATUS1=$(wait_for_order $ORDER1)

# =============================================================================
# PHASE 2: Kill first worker
# =============================================================================
echo ""
echo -e "${CYAN}▶ PHASE 2: Kill First Worker (2 Workers Remain)${NC}"
echo "────────────────────────────────────────"

VICTIM1="${WORKERS[0]}"
echo -e "   ${RED}✗ Killing worker: $VICTIM1${NC}"
docker kill "$VICTIM1" > /dev/null 2>&1

sleep 2
WORKERS=($(get_workers))
echo -e "   Workers running: ${YELLOW}${#WORKERS[@]}${NC}"
echo -e "   Queue consumers: ${YELLOW}$(get_consumers)${NC}"

echo ""
echo "   Creating order #2 (with Stripe test payment)..."
ORDER2=$(create_order 2)
echo -e "   Order #$ORDER2 created → payment processed → sent to assembly queue"
STATUS2=$(wait_for_order $ORDER2)

# =============================================================================
# PHASE 3: Kill second worker
# =============================================================================
echo ""
echo -e "${CYAN}▶ PHASE 3: Kill Second Worker (1 Worker Remains)${NC}"
echo "────────────────────────────────────────"

WORKERS=($(get_workers))
VICTIM2="${WORKERS[0]}"
echo -e "   ${RED}✗ Killing worker: $VICTIM2${NC}"
docker kill "$VICTIM2" > /dev/null 2>&1

sleep 2
WORKERS=($(get_workers))
echo -e "   Workers running: ${YELLOW}${#WORKERS[@]}${NC}"
echo -e "   Queue consumers: ${YELLOW}$(get_consumers)${NC}"

echo ""
echo "   Creating order #3 (with Stripe test payment)..."
ORDER3=$(create_order 3)
echo -e "   Order #$ORDER3 created → payment processed → sent to assembly queue"
STATUS3=$(wait_for_order $ORDER3)

# =============================================================================
# PHASE 4: Auto-recovery
# =============================================================================
echo ""
echo -e "${CYAN}▶ PHASE 4: Auto-Recovery (Docker Swarm)${NC}"
echo "────────────────────────────────────────"
echo "   Waiting for Swarm to restart workers..."

for i in {1..6}; do
    sleep 5
    WORKERS=($(get_workers))
    CONSUMERS=$(get_consumers)
    echo -e "   Check $i: Workers=${#WORKERS[@]}, Consumers=$CONSUMERS"
    if [ "${#WORKERS[@]}" -ge 3 ]; then
        echo -e "   ${GREEN}✓ All workers recovered!${NC}"
        break
    fi
done

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                         SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "   ┌─────────────────────────────────────────────────────────┐"
echo "   │  Phase        │ Workers │ Order Created │ Status       │"
echo "   ├─────────────────────────────────────────────────────────┤"
printf "   │  Initial      │    3    │ Order #%-6s │ %-12s │\n" "$ORDER1" "$STATUS1"
printf "   │  After Kill 1 │    2    │ Order #%-6s │ %-12s │\n" "$ORDER2" "$STATUS2"
printf "   │  After Kill 2 │    1    │ Order #%-6s │ %-12s │\n" "$ORDER3" "$STATUS3"
echo "   └─────────────────────────────────────────────────────────┘"
echo ""

if [ "$STATUS1" == "completed" ] && [ "$STATUS2" == "completed" ] && [ "$STATUS3" == "completed" ]; then
    echo -e "   ${GREEN}✓ FAULT TOLERANCE VERIFIED!${NC}"
    echo ""
    echo "   Even with only 1 worker remaining, orders are processed."
    echo "   Docker Swarm automatically restores failed workers."
else
    echo -e "   ${YELLOW}! Some orders may still be processing${NC}"
fi

echo ""
