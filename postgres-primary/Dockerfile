FROM postgres:15-alpine

# Copy custom pg_hba.conf that will be applied on every startup
COPY pg_hba.conf /etc/postgres/pg_hba.conf

# Create wrapper script that applies pg_hba.conf before starting postgres
COPY start-primary.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/start-primary.sh

# This entrypoint runs before postgres starts
ENTRYPOINT ["/usr/local/bin/start-primary.sh"]
