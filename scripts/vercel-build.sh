#!/usr/bin/env bash
# Vercel build: apply migrations + idempotent seed when a database is attached, then build.
set -euo pipefail
npx prisma generate
# Accept the connection-string names used by Vercel's Neon / Postgres integrations.
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-${STORAGE_DATABASE_URL:-${STORAGE_URL:-}}}}}"
if [ -n "${DATABASE_URL:-}" ]; then
  # Migrations need a direct (non-pooled) connection; Neon on Vercel provides DATABASE_URL_UNPOOLED.
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}" npx prisma migrate deploy
  DATABASE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}" npx tsx prisma/seed.ts
else
  echo "⚠ No DATABASE_URL — skipping migrations. Attach a database (Vercel → Storage) and redeploy."
fi
npx next build
