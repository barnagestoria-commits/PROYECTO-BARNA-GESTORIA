#!/usr/bin/env bash
# Crea tablas en Neon y carga usuarios demo.
# Requisito: DATABASE_URL y DIRECT_URL en .env.local (PostgreSQL de Neon)

set -euo pipefail
cd "$(dirname "$0")/.."

load_env() {
  if [[ -f .env.local ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env.local
    set +a
  fi
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
}

load_env

if [[ -z "${DATABASE_URL:-}" ]] || [[ "${DATABASE_URL}" != postgresql://* ]]; then
  echo ""
  echo "❌ DATABASE_URL no está configurada o no es PostgreSQL."
  echo ""
  echo "En Neon Dashboard → Connect, copia:"
  echo "  • Pooled connection  → DATABASE_URL en .env.local"
  echo "  • Direct connection  → DIRECT_URL en .env.local"
  echo ""
  echo "Ejemplo:"
  echo '  DATABASE_URL="postgresql://...@ep-xxx-pooler....neon.tech/neondb?sslmode=require"'
  echo '  DIRECT_URL="postgresql://...@ep-xxx....neon.tech/neondb?sslmode=require"'
  echo ""
  exit 1
fi

if [[ -z "${DIRECT_URL:-}" ]] || [[ "${DIRECT_URL}" != postgresql://* ]]; then
  echo "❌ DIRECT_URL es obligatoria para migraciones Prisma con Neon."
  exit 1
fi

echo "▶ Aplicando migraciones en Neon..."
npx prisma migrate deploy

echo "▶ Insertando usuarios de prueba..."
npx tsx prisma/seed.ts

echo ""
echo "✅ Base de datos lista. Usuarios demo:"
echo "   admin@gestoria.com / demo123  (Admin gestoría)"
echo "   gestor@gestoria.com / demo123 (Gestor)"
echo "   juan@empresa.com / demo123    (Cliente final)"
echo ""
