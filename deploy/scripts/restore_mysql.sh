#!/usr/bin/env bash
# ==============================================================================
# OyoPasal — Safe MySQL Database Restoration Script
# Validates checksum, prompts for confirmation, and restores to target database
# ==============================================================================

set -euo pipefail

if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz> [target_database_name]"
    exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-oyopasal_prod}"
DB_USER="${DB_USER:-oyopasal_admin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file '${BACKUP_FILE}' does not exist!"
    exit 1
fi

# Verify SHA256 checksum if checksum file is present
CHECKSUM_FILE="${BACKUP_FILE%.sql.gz}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
    echo "Verifying SHA256 checksum..."
    sha256sum -c "${CHECKSUM_FILE}"
    echo "Checksum verified: OK"
else
    echo "WARNING: No .sha256 checksum file found. Proceeding with caution."
fi

echo "=================================================================="
echo "CRITICAL WARNING: You are about to RESTORE into database: ${TARGET_DB}"
echo "Source archive: ${BACKUP_FILE}"
echo "Target host:    ${DB_HOST}:${DB_PORT}"
echo "=================================================================="
read -r -p "Type 'RESTORE-${TARGET_DB}' to confirm and proceed: " CONFIRM

if [ "${CONFIRM}" != "RESTORE-${TARGET_DB}" ]; then
    echo "Restoration aborted by operator. No changes made."
    exit 0
fi

echo "Restoring database '${TARGET_DB}'..."
gunzip -c "${BACKUP_FILE}" | mysql \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --user="${DB_USER}" \
    -p \
    "${TARGET_DB}"

echo "Restoration completed successfully for database '${TARGET_DB}'."
