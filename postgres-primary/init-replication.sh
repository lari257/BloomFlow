#!/bin/bash
set -e

echo "Setting up replication configuration..."

# Add replication entry to pg_hba.conf
echo "host replication all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
echo "host replication ${POSTGRES_USER:-bloomflow} 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"

# Grant replication privilege
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    ALTER USER ${POSTGRES_USER} WITH REPLICATION;
EOSQL

echo "Replication setup complete!"
