# PowerShell MySQL Backup Script for OyoPasal
param (
    [string]$DbUser = "oyopasal_user",
    [string]$DbPassword = "oyopasal_password",
    [string]$DbName = "oyopasal_db",
    [string]$DbHost = "127.0.0.1",
    [string]$BackupDir = "$PSScriptRoot\..\backups"
)

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "oyopasal_backup_$Timestamp.sql"

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "Creating backup of $DbName to $BackupFile..." -ForegroundColor Cyan

mysqldump -h $DbHost -u $DbUser --password=$DbPassword --default-character-set=utf8mb4 --single-transaction --no-tablespaces --routines --triggers $DbName > $BackupFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully: $BackupFile" -ForegroundColor Green
} else {
    Write-Host "Backup failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
