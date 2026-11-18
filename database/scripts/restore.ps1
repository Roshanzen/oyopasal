# PowerShell MySQL Restore Script for OyoPasal
param (
    [Parameter(Mandatory=$true)]
    [string]$BackupFile,
    [string]$DbUser = "oyopasal_user",
    [string]$DbPassword = "oyopasal_password",
    [string]$DbName = "oyopasal_db",
    [string]$DbHost = "127.0.0.1"
)

if (!(Test-Path $BackupFile)) {
    Write-Host "Error: Backup file '$BackupFile' does not exist." -ForegroundColor Red
    exit 1
}

Write-Host "Restoring $DbName from $BackupFile..." -ForegroundColor Yellow

Get-Content $BackupFile | mysql -h $DbHost -u $DbUser --password=$DbPassword --default-character-set=utf8mb4 $DbName

if ($LASTEXITCODE -eq 0) {
    Write-Host "Restoration completed successfully." -ForegroundColor Green
} else {
    Write-Host "Restoration failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
