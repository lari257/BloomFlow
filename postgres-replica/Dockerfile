FROM postgres:15-alpine

# Install gosu for proper user switching
RUN apk add --no-cache gosu

COPY start-replica.sh /usr/local/bin/start-replica.sh
RUN chmod +x /usr/local/bin/start-replica.sh

ENTRYPOINT ["/usr/local/bin/start-replica.sh"]
