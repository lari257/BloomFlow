#!/bin/bash
set -e

# This script wraps the default postgres entrypoint and ensures pg_hba.conf
# has replication enabled every time the container starts

PGDATA="${PGDATA:-/var/lib/postgresql/data}"

# If PGDATA exists and has a pg_hba.conf, update it to allow replication
if [ -f "$PGDATA/pg_hba.conf" ]; then
  echo "Checking pg_hba.conf for replication settings..."
  
  # Check if replication entry already exists
  if ! grep -q "^host[[:space:]]*replication" "$PGDATA/pg_hba.conf"; then
    echo "Adding replication entries to pg_hba.conf..."
    echo "" >> "$PGDATA/pg_hba.conf"
    echo "# Allow replication connections from Docker network" >> "$PGDATA/pg_hba.conf"
    echo "host    replication     all             0.0.0.0/0               md5" >> "$PGDATA/pg_hba.conf"
    echo "local   replication     all                                     trust" >> "$PGDATA/pg_hba.conf"
    echo "Replication entries added!"
  else
    echo "Replication already configured in pg_hba.conf"
  fi
fi

# Call the original docker entrypoint
exec docker-entrypoint.sh "$@"
