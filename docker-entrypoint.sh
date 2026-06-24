#!/bin/sh
set -eu

attempt=1
until npx prisma migrate deploy; do
  if [ "$attempt" -ge 30 ]; then
    echo "Prisma migrations failed after $attempt attempts." >&2
    exit 1
  fi

  echo "PostgreSQL is not ready yet, retrying migrations in 2s... ($attempt/30)"
  attempt=$((attempt + 1))
  sleep 2
done

npm run db:seed

exec node server.js
