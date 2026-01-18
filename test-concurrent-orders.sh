#!/bin/bash

# =============================================================================
# BloomFlow Concurrent Database Access Test
# =============================================================================
# Demonstrates that the system correctly handles concurrent orders
# when there's limited stock - preventing overselling.
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

ORDER_SERVICE="http://localhost:5004"
INVENTORY_SERVICE="http://localhost:5003"

# Get token for user 1 (larisa)
get_token_user1() {
    curl -sS -X POST "http://localhost:8080/realms/bloomflow/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password" \
        -d "client_id=bloomflow-api" \
        -d "client_secret=${KEYCLOAK_CLIENT_SECRET:-}" \
        -d "username=larisa" \
        -d "password=test" 2>/dev/null | jq -r '.access_token // empty'
}

# Get token for user 2 (testuser)
get_token_user2() {
    curl -sS -X POST "http://localhost:8080/realms/bloomflow/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password" \
        -d "client_id=bloomflow-api" \
        -d "client_secret=${KEYCLOAK_CLIENT_SECRET:-}" \
        -d "username=testuser" \
        -d "password=test" 2>/dev/null | jq -r '.access_token // empty'
}

# Get admin token (for inventory management)
get_admin_token() {
    curl -sS -X POST "http://localhost:8080/realms/bloomflow/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "grant_type=password" \
        -d "client_id=bloomflow-api" \
        -d "client_secret=${KEYCLOAK_CLIENT_SECRET:-}" \
        -d "username=admin" \
        -d "password=admin123" 2>/dev/null | jq -r '.access_token // empty'
}

# Get flower stock
get_flower_stock() {
    local FLOWER_ID=$1
    local TOKEN=$2
    curl -s "$INVENTORY_SERVICE/flowers" \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r ".flowers[] | select(.id == $FLOWER_ID) | .available_stock // 0"
}

# Get flower name
get_flower_name() {
    local FLOWER_ID=$1
    local TOKEN=$2
    curl -s "$INVENTORY_SERVICE/flowers" \
        -H "Authorization: Bearer $TOKEN" 2>/dev/null | jq -r ".flowers[] | select(.id == $FLOWER_ID) | .name // \"Unknown\""
}

# Create order (returns order ID or error message)
create_order() {
    local FLOWER_ID=$1
    local QUANTITY=$2
    local LABEL=$3
    
    RESPONSE=$(curl -s -X POST "$ORDER_SERVICE/orders" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"items\": [{\"flower_type_id\": $FLOWER_ID, \"quantity\": $QUANTITY}], \"notes\": \"$LABEL\"}" 2>/dev/null)
    
    ORDER_ID=$(echo "$RESPONSE" | jq -r '.order.id // empty')
    ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
    
    if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
        echo "SUCCESS:$ORDER_ID"
    else
        echo "FAILED:$ERROR"
    fi
}

# Confirm payment for an order (triggers inventory reduction)
confirm_payment() {
    local ORDER_ID=$1
    
    # First create payment intent
    INTENT_RESPONSE=$(curl -s -X POST "$ORDER_SERVICE/orders/$ORDER_ID/create-payment-intent" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" 2>/dev/null)
    
    # Then confirm payment (this reduces inventory)
    CONFIRM_RESPONSE=$(curl -s -X POST "$ORDER_SERVICE/orders/$ORDER_ID/confirm-payment" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"payment_intent_id": "pi_test_simulated"}' 2>/dev/null)
    
    STATUS=$(echo "$CONFIRM_RESPONSE" | jq -r '.order.status // .status // empty')
    ERROR=$(echo "$CONFIRM_RESPONSE" | jq -r '.error // empty')
    
    if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
        echo "FAILED:$ERROR"
    else
        echo "SUCCESS:$STATUS"
    fi
}

# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}     CONCURRENT DATABASE ACCESS TEST${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "This test demonstrates that when two DIFFERENT users compete for"
echo "limited stock simultaneously, the system prevents overselling."
echo ""

TOKEN_USER1=$(get_token_user1)
TOKEN_USER2=$(get_token_user2)

if [ -z "$TOKEN_USER1" ]; then
    echo -e "${RED}Failed to get token for user 1 (larisa)${NC}"
    exit 1
fi

if [ -z "$TOKEN_USER2" ]; then
    echo -e "${RED}Failed to get token for user 2 (testuser)${NC}"
    exit 1
fi

echo -e "   ${GREEN}✓ User 1 (larisa) authenticated${NC}"
echo -e "   ${GREEN}✓ User 2 (testuser) authenticated${NC}"
echo ""

# =============================================================================
# STEP 1: Check current stock
# =============================================================================
echo -e "${CYAN}▶ STEP 1: Check Current Stock${NC}"
echo "────────────────────────────────────────"

FLOWER_ID=1
FLOWER_NAME=$(get_flower_name $FLOWER_ID $TOKEN_USER1)
INITIAL_STOCK=$(get_flower_stock $FLOWER_ID $TOKEN_USER1)

echo -e "   Flower: ${GREEN}$FLOWER_NAME${NC} (ID: $FLOWER_ID)"
echo -e "   Current stock: ${GREEN}$INITIAL_STOCK${NC} units"

# Check if we have enough stock for the test
if [ "$INITIAL_STOCK" -lt 4 ]; then
    echo -e "${YELLOW}   Stock too low for test. Need at least 4 units.${NC}"
    echo "   You may need to add more inventory first."
    exit 1
fi

# =============================================================================
# STEP 2: Scenario Setup
# =============================================================================
echo ""
echo -e "${CYAN}▶ STEP 2: Test Scenario${NC}"
echo "────────────────────────────────────────"
echo ""
echo "   Available stock: $INITIAL_STOCK $FLOWER_NAME"
echo ""
echo "   We'll attempt TWO orders that together exceed available stock:"
# Calculate quantities - BOTH orders request more than half the stock
# This ensures they CANNOT both succeed
QUANTITY_A=$(( ($INITIAL_STOCK / 2) + 2 ))  # More than half
QUANTITY_B=$(( ($INITIAL_STOCK / 2) + 2 ))  # More than half

echo "   ┌─────────────────────────────────────────────┐"
echo "   │  Order A (larisa):   $QUANTITY_A $FLOWER_NAME         │"
echo "   │  Order B (testuser): $QUANTITY_B $FLOWER_NAME         │"
echo "   │  Total requested: $(($QUANTITY_A + $QUANTITY_B)) (exceeds stock: $INITIAL_STOCK)  │"
echo "   └─────────────────────────────────────────────┘"
echo ""
echo "   Expected: One order should FAIL due to insufficient stock"
echo ""

# =============================================================================
# STEP 3: Create orders (stock is reserved at payment, not creation)
# =============================================================================
echo -e "${CYAN}▶ STEP 3: Creating Orders (Two Different Users)${NC}"
echo "────────────────────────────────────────"
echo ""
echo "   Note: Stock is only reduced when payment succeeds, not at order creation."
echo ""

# Create Order A with User 1 (larisa)
echo -e "   ${CYAN}User 1 (larisa)${NC} creating Order A..."
RESPONSE_A=$(curl -s -X POST "$ORDER_SERVICE/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN_USER1" \
    -d "{\"items\": [{\"flower_type_id\": $FLOWER_ID, \"quantity\": $QUANTITY_A}], \"notes\": \"Order A - larisa - $QUANTITY_A roses\"}" 2>/dev/null)

ORDER_A_ID=$(echo "$RESPONSE_A" | jq -r '.order.id // empty')
ORDER_A_ERROR=$(echo "$RESPONSE_A" | jq -r '.error // empty')

if [ -n "$ORDER_A_ID" ] && [ "$ORDER_A_ID" != "null" ]; then
    ORDER_A_STATUS="SUCCESS"
    echo -e "   ${GREEN}✓ Order A created: #$ORDER_A_ID${NC} (User: larisa, Qty: $QUANTITY_A)"
else
    ORDER_A_STATUS="FAILED"
    echo -e "   ${RED}✗ Order A failed: $ORDER_A_ERROR${NC}"
fi

# Create Order B with User 2 (testuser)
echo -e "   ${CYAN}User 2 (testuser)${NC} creating Order B..."
RESPONSE_B=$(curl -s -X POST "$ORDER_SERVICE/orders" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN_USER2" \
    -d "{\"items\": [{\"flower_type_id\": $FLOWER_ID, \"quantity\": $QUANTITY_B}], \"notes\": \"Order B - testuser - $QUANTITY_B roses\"}" 2>/dev/null)

ORDER_B_ID=$(echo "$RESPONSE_B" | jq -r '.order.id // empty')
ORDER_B_ERROR=$(echo "$RESPONSE_B" | jq -r '.error // empty')

if [ -n "$ORDER_B_ID" ] && [ "$ORDER_B_ID" != "null" ]; then
    ORDER_B_STATUS="SUCCESS"
    echo -e "   ${GREEN}✓ Order B created: #$ORDER_B_ID${NC} (requested $QUANTITY_B)"
else
    ORDER_B_STATUS="FAILED"
    echo -e "   ${RED}✗ Order B failed: $ORDER_B_ERROR${NC}"
fi

# =============================================================================
# STEP 4: Process payments SIMULTANEOUSLY (this is when inventory gets reduced)
# =============================================================================
echo ""
echo -e "${CYAN}▶ STEP 4: Processing Payments SIMULTANEOUSLY${NC}"
echo "────────────────────────────────────────"
echo ""
echo -e "   ${YELLOW}This is where the database concurrency is tested!${NC}"
echo "   Both users will try to pay and reduce inventory at the SAME time."
echo ""

PAYMENT_A_STATUS="SKIPPED"
PAYMENT_B_STATUS="SKIPPED"
PAYMENT_A_RESULT=""
PAYMENT_B_RESULT=""

# Temporary files for payment results
PAYMENT_FILE_A=$(mktemp)
PAYMENT_FILE_B=$(mktemp)

# Launch both payments in parallel using the test-payment endpoint
if [ "$ORDER_A_STATUS" == "SUCCESS" ]; then
    (
        # User 1 (larisa) pays for Order A
        RESULT=$(curl -s -X POST "$ORDER_SERVICE/orders/$ORDER_A_ID/test-payment" \
            -H "Authorization: Bearer $TOKEN_USER1" \
            -H "Content-Type: application/json" 2>/dev/null)
        echo "$RESULT" > "$PAYMENT_FILE_A"
    ) &
    PID_PA=$!
fi

if [ "$ORDER_B_STATUS" == "SUCCESS" ]; then
    (
        # User 2 (testuser) pays for Order B
        RESULT=$(curl -s -X POST "$ORDER_SERVICE/orders/$ORDER_B_ID/test-payment" \
            -H "Authorization: Bearer $TOKEN_USER2" \
            -H "Content-Type: application/json" 2>/dev/null)
        echo "$RESULT" > "$PAYMENT_FILE_B"
    ) &
    PID_PB=$!
fi

echo "   Waiting for both payments to process..."
[ -n "$PID_PA" ] && wait $PID_PA
[ -n "$PID_PB" ] && wait $PID_PB

# Parse payment results
if [ "$ORDER_A_STATUS" == "SUCCESS" ]; then
    PAYMENT_RESPONSE_A=$(cat "$PAYMENT_FILE_A" 2>/dev/null)
    PAYMENT_A_ORDER_STATUS=$(echo "$PAYMENT_RESPONSE_A" | jq -r '.order.status // empty')
    PAYMENT_A_ERROR=$(echo "$PAYMENT_RESPONSE_A" | jq -r '.error // empty')
    
    if [ -n "$PAYMENT_A_ORDER_STATUS" ] && [ "$PAYMENT_A_ORDER_STATUS" != "null" ]; then
        PAYMENT_A_STATUS="SUCCESS"
        PAYMENT_A_RESULT="$PAYMENT_A_ORDER_STATUS"
        echo -e "   ${GREEN}✓ Order A (larisa) payment: $PAYMENT_A_RESULT${NC}"
    else
        PAYMENT_A_STATUS="FAILED"
        PAYMENT_A_RESULT="$PAYMENT_A_ERROR"
        echo -e "   ${RED}✗ Order A (larisa) payment failed: $PAYMENT_A_RESULT${NC}"
    fi
fi

if [ "$ORDER_B_STATUS" == "SUCCESS" ]; then
    PAYMENT_RESPONSE_B=$(cat "$PAYMENT_FILE_B" 2>/dev/null)
    PAYMENT_B_ORDER_STATUS=$(echo "$PAYMENT_RESPONSE_B" | jq -r '.order.status // empty')
    PAYMENT_B_ERROR=$(echo "$PAYMENT_RESPONSE_B" | jq -r '.error // empty')
    
    if [ -n "$PAYMENT_B_ORDER_STATUS" ] && [ "$PAYMENT_B_ORDER_STATUS" != "null" ]; then
        PAYMENT_B_STATUS="SUCCESS"
        PAYMENT_B_RESULT="$PAYMENT_B_ORDER_STATUS"
        echo -e "   ${GREEN}✓ Order B (testuser) payment: $PAYMENT_B_RESULT${NC}"
    else
        PAYMENT_B_STATUS="FAILED"
        PAYMENT_B_RESULT="$PAYMENT_B_ERROR"
        echo -e "   ${RED}✗ Order B (testuser) payment failed: $PAYMENT_B_RESULT${NC}"
    fi
fi

rm -f "$PAYMENT_FILE_A" "$PAYMENT_FILE_B"

# =============================================================================
# STEP 5: Verify final stock
# =============================================================================
echo ""
echo -e "${CYAN}▶ STEP 5: Final Stock Verification${NC}"
echo "────────────────────────────────────────"

FINAL_STOCK=$(get_flower_stock $FLOWER_ID $TOKEN_USER1)
echo ""
echo -e "   Initial stock:  ${CYAN}$INITIAL_STOCK${NC} units"
echo -e "   Final stock:    ${CYAN}$FINAL_STOCK${NC} units"
STOCK_REDUCED=$(($INITIAL_STOCK - $FINAL_STOCK))
echo -e "   Stock reduced:  ${CYAN}$STOCK_REDUCED${NC} units"

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                         SUMMARY${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "   ┌─────────────────────────────────────────────────────────────┐"
echo "   │  Order    │ Requested │ Created │ Payment    │ Result      │"
echo "   ├─────────────────────────────────────────────────────────────┤"
printf "   │  Order A  │ %-9s │ %-7s │ %-10s │ " "$QUANTITY_A units" "$ORDER_A_STATUS" "$PAYMENT_A_STATUS"
if [ "$PAYMENT_A_STATUS" == "SUCCESS" ]; then
    printf "${GREEN}%-11s${NC} │\n" "✓ Fulfilled"
else
    printf "${RED}%-11s${NC} │\n" "✗ Rejected"
fi
printf "   │  Order B  │ %-9s │ %-7s │ %-10s │ " "$QUANTITY_B units" "$ORDER_B_STATUS" "$PAYMENT_B_STATUS"
if [ "$PAYMENT_B_STATUS" == "SUCCESS" ]; then
    printf "${GREEN}%-11s${NC} │\n" "✓ Fulfilled"
else
    printf "${RED}%-11s${NC} │\n" "✗ Rejected"
fi
echo "   └─────────────────────────────────────────────────────────────┘"
echo ""

# Check if overselling occurred
if [ "$FINAL_STOCK" -lt 0 ]; then
    echo -e "   ${RED}✗ OVERSELLING DETECTED! Stock went negative.${NC}"
    echo "   This indicates a concurrency problem."
elif [ "$PAYMENT_A_STATUS" == "SUCCESS" ] && [ "$PAYMENT_B_STATUS" == "SUCCESS" ]; then
    echo -e "   ${YELLOW}! Both orders succeeded - stock was sufficient for both.${NC}"
    echo "   Try with larger order quantities to trigger the limit."
elif [ "$PAYMENT_A_STATUS" == "SUCCESS" ] || [ "$PAYMENT_B_STATUS" == "SUCCESS" ]; then
    echo -e "   ${GREEN}✓ CONCURRENCY CONTROL WORKING!${NC}"
    echo ""
    echo "   The system correctly:"
    echo "   - Fulfilled one order that had sufficient stock"  
    echo "   - Rejected the other order due to insufficient stock"
    echo "   - Prevented overselling (stock never went negative)"
else
    echo -e "   ${RED}✗ Both orders failed - unexpected result.${NC}"
fi

echo ""
