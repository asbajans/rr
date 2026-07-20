#!/bin/sh
set -e

# Extract connection details from DATABASE_URL if set
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/rahatio}"
DB_USER="$(echo "$DB_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')"
DB_PASS="$(echo "$DB_URL" | sed -n 's/.*:\([^@]*\)@.*/\1/p')"
DB_HOST="$(echo "$DB_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')"
DB_PORT="$(echo "$DB_URL" | sed 's/.*://' | sed 's/\/.*//')"
DB_NAME="$(echo "$DB_URL" | sed 's/.*\///')"

# Wait for PostgreSQL
echo "Waiting for PostgreSQL ($DB_HOST:$DB_PORT)..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; do
  sleep 2
done
echo "PostgreSQL is ready!"

# Wait for Redis
echo "Waiting for Redis..."
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping; do
  sleep 2
done
echo "Redis is ready!"

# Run seeders if needed (tables created by sequelize.sync on app startup)
if [ "$RUN_SEEDERS" = "true" ]; then
  echo "Running seeders..."
  node /app/packages/core/src/scripts/seed.js
  echo "Seeders done!"
fi

# Start the application
echo "Starting application..."
exec "$@"