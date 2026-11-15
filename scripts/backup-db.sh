#!/bin/bash
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="database/backups"
BACKUP_FILE="${BACKUP_DIR}/workvision_production_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

echo "Creating PostgreSQL backup from Railway production..."
railway ssh --service Postgres -i ~/.ssh/railway_workvision -- pg_dump -U postgres railway > "$BACKUP_FILE"

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Local backup completed: ${BACKUP_FILE} (${SIZE})"

# Load R2 credentials if .env.backup exists
if [ -f ".env.backup" ]; then
  R2_ACC_ID=$(grep -E "^R2_ACCOUNT_ID=" .env.backup | cut -d'=' -f2)
  R2_KEY=$(grep -E "^R2_ACCESS_KEY_ID=" .env.backup | cut -d'=' -f2)
  R2_SEC=$(grep -E "^R2_SECRET_ACCESS_KEY=" .env.backup | cut -d'=' -f2)
  R2_BUCKET=$(grep -E "^R2_BUCKET_NAME=" .env.backup | cut -d'=' -f2)

  if [ -n "$R2_ACC_ID" ] && [ -n "$R2_KEY" ] && [ -n "$R2_SEC" ]; then
    echo "Compressing and uploading to Cloudflare R2 (${R2_BUCKET})..."
    GZ_FILE="${BACKUP_FILE}.gz"
    gzip -c "$BACKUP_FILE" > "$GZ_FILE"

    AWS_ACCESS_KEY_ID="$R2_KEY" \
    AWS_SECRET_ACCESS_KEY="$R2_SEC" \
    aws s3 cp "$GZ_FILE" "s3://${R2_BUCKET}/database/$(basename "$GZ_FILE")" \
      --endpoint-url "https://${R2_ACC_ID}.r2.cloudflarestorage.com"

    echo "Cloudflare R2 upload successful: s3://${R2_BUCKET}/database/$(basename "$GZ_FILE")"
    rm -f "$GZ_FILE"
  fi
fi

echo "All backup tasks finished successfully."
