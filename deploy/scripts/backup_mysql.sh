#!/usr/bin/env bash
# ==============================================================================
# OyoPasal — Automated MySQL Production Backup Script
# Creates a compressed, non-blocking atomic dump with SHA256 checksum
# Retains the last 30 daily backups and prunes older archives
# ==============================================================================

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/var/backups/oyopasal/mysql}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/oyopasal_db_${TIMESTAMP}.sql.gz"
CHECKSUM_FILE="${BACKUP_DIR}/oyopasal_db_${TIMESTAMP}.sha256"
LOG_FILE="/var/log/oyopasal/mysql_backup.log"
RETENTION_DAYS=30

# Database credentials (read from environment or defaults)
DB_NAME="${DB_NAME:-oyopasal_prod}"
DB_USER="${DB_USER:-oyopasal_backup}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"

mkdir -p "${BACKUP_DIR}" "$(dirname "${LOG_FILE}")"

log() {
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $1" | tee -a "${LOG_FILE}"
}

log "Starting automated backup for database '${DB_NAME}' on host '${DB_HOST}'..."

# Perform non-blocking dump using --single-transaction
if mysqldump \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    --single-transaction \
    --quick \
    --routines \
    --triggers \
    --events \
    --hex-blob \
    --set-gtid-purged=OFF \
    "${DB_NAME}" | gzip -c > "${BACKUP_FILE}"; then

    # Generate SHA-256 verification checksum
    sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    log "Backup successful: ${BACKUP_FILE} (${BACKUP_SIZE})"
    log "Checksum generated: ${CHECKSUM_FILE}"
else
    log "ERROR: mysqldump backup failed for '${DB_NAME}'!"
    exit 1
fi

# Prune archives older than RETENTION_DAYS
log "Pruning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "oyopasal_db_*.sql.gz" -type f -mtime +"${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}" -name "oyopasal_db_*.sha256" -type f -mtime +"${RETENTION_DAYS}" -delete
log "Backup cycle finished cleanly."
