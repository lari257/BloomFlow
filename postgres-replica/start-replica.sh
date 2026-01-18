#!/bin/bash
set -e

PGDATA="/var/lib/postgresql/data"

echo "=== PostgreSQL Replica Initialization ==="

# Wait for primary
echo "Waiting for primary PostgreSQL..."
until pg_isready -h postgres -U ${POSTGRES_USER:-bloomflow}; do
  echo "Primary not ready, waiting..."
  sleep 3
done
sleep 10

echo "Primary is ready!"

# Check if replica is already initialized
if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "Initializing replica from primary using pg_basebackup..."
  rm -rf "$PGDATA"/*
  
  # Ensure directory exists with proper permissions
  mkdir -p "$PGDATA"
  chown postgres:postgres "$PGDATA"
  chmod 700 "$PGDATA"
  
  # Create pgpass file in postgres home directory
  POSTGRES_HOME=$(getent passwd postgres | cut -d: -f6)
  echo "postgres:5432:*:${POSTGRES_USER:-bloomflow}:${POSTGRES_PASSWORD}" > "$POSTGRES_HOME/.pgpass"
  chown postgres:postgres "$POSTGRES_HOME/.pgpass"
  chmod 600 "$POSTGRES_HOME/.pgpass"
  
  # Run pg_basebackup as postgres user
  echo "Running pg_basebackup as postgres user..."
  gosu postgres pg_basebackup \
    -h postgres \
    -U "${POSTGRES_USER:-bloomflow}" \
    -D "$PGDATA" \
    -Fp -Xs -P -R || {
      echo "pg_basebackup failed!"
      exit 1
    }
  
  echo "Replica initialized successfully!"
else
  echo "Replica data directory already exists, starting in standby mode..."
  # Ensure proper ownership
  chown -R postgres:postgres "$PGDATA"
fi

# Ensure standby.signal exists for hot standby mode
touch "$PGDATA/standby.signal"
chown postgres:postgres "$PGDATA/standby.signal"

# Update postgresql.auto.conf with connection info
cat > "$PGDATA/postgresql.auto.conf" << EOF
primary_conninfo = 'host=postgres port=5432 user=${POSTGRES_USER:-bloomflow} password=${POSTGRES_PASSWORD}'
hot_standby = on
EOF
chown postgres:postgres "$PGDATA/postgresql.auto.conf"

echo "Starting PostgreSQL in hot standby mode..."
# Switch to postgres user to start the server
exec gosu postgres postgres -c hot_standby=on -c hot_standby_feedback=on
