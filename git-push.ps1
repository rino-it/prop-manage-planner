param(
    [string]$Message = "update"
)

$repoPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$lockFile = "$repoPath\.git\index.lock"

if (Test-Path $lockFile) {
    Remove-Item $lockFile -Force
    Write-Host "Lock rimosso." -ForegroundColor Yellow
}

Set-Location $repoPath

git add src/components/CalendarView.tsx supabase/functions/sync-portals/index.ts

if ($Message -eq "update") {
    $Message = Read-Host "Messaggio commit"
}

git commit -m $Message
git push origin main

Write-Host "Done." -ForegroundColor Green
