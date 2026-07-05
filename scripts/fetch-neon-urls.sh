#!/usr/bin/env bash
# Obtiene URLs de Neon vía CLI (requiere: npx neonctl auth)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Autenticando con Neon si hace falta..."
npx neonctl@latest auth 2>/dev/null || true

echo ""
echo "=== Pooled (DATABASE_URL) ==="
npx neonctl@latest connection-string --pooled

echo ""
echo "=== Direct (DIRECT_URL) ==="
npx neonctl@latest connection-string

echo ""
echo "Copia ambas cadenas en .env.local y en Vercel → Environment Variables."
