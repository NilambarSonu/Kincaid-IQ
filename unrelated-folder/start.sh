#!/bin/bash
set -e

echo "=========================================="
echo "  Kincaid IQ — Kincaid RMC Platform"
echo "  Stack: React 19 + FastAPI + PostgreSQL"
echo "=========================================="

# ── Frontend build cache ──────────────────────────────────────────────────────
# The Vite production build takes ~25-30s and only needs to run when a frontend
# input actually changes. We hash every frontend source + build-config file and
# skip the rebuild when the existing bundle already matches. Backend-only
# restarts (editing Python routers, etc.) then become near-instant, while ANY
# frontend edit still produces a real production build — never a dev server.
FRONTEND_HASH=$(
  {
    find client shared attached_assets -type f \
      \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \
         -o -name '*.css' -o -name '*.html' -o -name '*.json' -o -name '*.svg' \
         -o -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' -o -name '*.webp' \
         -o -name '*.woff' -o -name '*.woff2' \) -printf '%T@ %p\n' 2>/dev/null
    for f in package.json package-lock.json vite.config.ts tailwind.config.ts \
             postcss.config.js components.json script/build.ts; do
      [ -f "$f" ] && printf '%s %s\n' "$(stat -c '%Y' "$f")" "$f"
    done
  } | LC_ALL=C sort | md5sum | cut -d' ' -f1
)
HASH_FILE="dist/.frontend-hash"

if [ -f "dist/public/index.html" ] && [ -f "$HASH_FILE" ] && \
   [ "$(cat "$HASH_FILE")" = "$FRONTEND_HASH" ]; then
  echo ""
  echo "[1/2] Frontend unchanged — using cached production build ✓"
else
  echo ""
  echo "[1/2] Building React 19 frontend..."
  npm run build
  echo "$FRONTEND_HASH" > "$HASH_FILE"
fi

echo ""
echo "[2/2] Starting FastAPI server on port 5000..."
.pythonlibs/bin/uvicorn main:app --host 0.0.0.0 --port 5000 --h11-max-incomplete-event-size 209715200
