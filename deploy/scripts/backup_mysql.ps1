<#
.SYNOPSIS
    OyoPasal Automated MySQL Database Backup Script for Windows environments
#>
param(
    [string]$BackupDir = "C:\backups\oyopasal\mysql",
    [string]$DbName = "oyopasal_db",
    [string]$DbUser = "oyopasal_user",
    [string]$DbHost = "127.0.0.1",
    [string]$DbPort = "3306",
    [int]$RetentionDays = 30
)

$ErrorActionPreference = "Stop"
$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$BackupFile = Join-Path $BackupDir "oyopasal_db_$Timestamp.sql"
$ZipFile = "$BackupFile.zip"

if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "[$(Get-Date -Format 'u')] Starting MySQL backup for '$DbName'..."

# Execute mysqldump
& mysqldump.exe --host=$DbHost --port=$DbPort --user=$DbUser --single-transaction --quick --routines --triggers $DbName > $BackupFile

if ($LASTEXITCODE -eq 0 -and (Test-Path $BackupFile)) {
    # Compress
    Compress-Archive -Path $BackupFile -DestinationPath $ZipFile -Force
    Remove-Item -Path $BackupFile -Force
    $Size = (Get-Item $ZipFile).Length / 1MB
    Write-Host "[$(Get-Date -Format 'u')] Backup compressed successfully: $ZipFile ($('{0:N2}' -f $Size) MB)"

    # Prune old backups
    $Cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter "oyopasal_db_*.zip" | Where-Object { $_.LastWriteTime -lt $Cutoff } | Remove-Item -Force
    Write-Host "[$(Get-Date -Format 'u')] Pruned backups older than $RetentionDays days."
} else {
    Write-Error "mysqldump failed with exit code $LASTEXITCODE"
}
