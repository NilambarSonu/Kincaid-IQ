#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kincaid IQ — Database Restore Script
# Restores a database from a backup created by db_backup.sh.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load DATABASE_URL from .env if not already set
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -f "${PROJECT_ROOT}/.env" ]; then
    DATABASE_URL=$(grep -E '^DATABASE_URL=' "${PROJECT_ROOT}/.env" | cut -d'=' -f2-)
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set. Set it in .env or as an environment variable."
  exit 1
fi

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh "${PROJECT_ROOT}/backups"/kincaid_backup_*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will overwrite the current database with the backup."
echo "Backup:  $BACKUP_FILE"
echo "Target:  $DATABASE_URL"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring database from backup..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"

echo "Restore complete."
