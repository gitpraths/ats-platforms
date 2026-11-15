#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="database/backups"
BACKUP_FILE="${BACKUP_DIR}/workvision_production_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "Creating PostgreSQL backup from Railway production..."
railway ssh --service Postgres -i ~/.ssh/railway_workvision -- pg_dump -U postgres railway > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup completed successfully: ${BACKUP_FILE} (${SIZE})"
