#!/bin/sh
set -e

# Wait for PostgreSQL
echo "Waiting for PostgreSQL..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; do
  sleep 2
done
echo "PostgreSQL is ready!"

# Wait for Redis
echo "Waiting for Redis..."
until redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping; do
  sleep 2
done
echo "Redis is ready!"

# Run migrations
echo "Running database migrations..."
npx sequelize-cli db:migrate

# Run seeders if needed
if [ "$RUN_SEEDERS" = "true" ]; then
  echo "Running seeders..."
  npx sequelize-cli db:seed:all
fi

# Start the application
echo "Starting application..."
exec "$@"