#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Kincaid IQ — Database Backup Script
# Creates a timestamped pg_dump of the production database.
# Works with any PostgreSQL host (Docker, AWS RDS, GCP Cloud SQL, etc.).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"

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

# Create backup directory
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/kincaid_backup_${TIMESTAMP}.sql.gz"

echo "Starting database backup..."
echo "Target: ${BACKUP_FILE}"

pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# Keep only the last 10 backups (oldest are deleted)
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/kincaid_backup_*.sql.gz 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 10 ]; then
  EXCESS=$((BACKUP_COUNT - 10))
  echo "Cleaning up ${EXCESS} old backup(s)..."
  ls -1t "$BACKUP_DIR"/kincaid_backup_*.sql.gz | tail -n "$EXCESS" | xargs rm -f
fi

echo "Done."
