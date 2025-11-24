# start-ii-min.ps1
param([int]$Port = 8090)

# Vars propres et stables
$env:NODE_ENV = "development"
$env:PORT     = "$Port"
$env:BASE_URL = "http://localhost:$Port"
$env:WEB_CONCURRENCY = "1"
$env:WEB_CONCURRENCY_OVERRIDE = "1"   # au cas où le code regarde un autre nom
$env:TAG_DEBUG = "1"
$env:SYNC_DDB_TOKEN = "CHANGEMOI"
$env:DDB_HEADLESS = "false"
$env:DDB_CONCURRENCY = "1"
$env:DDB_NAV_TIMEOUT = "20000"
#$env:SKIP_OPEN5E_API = "true"



# Rewards actifs / Patreon out
$env:DEFAULT_ACCOUNT_LEVEL = "epicinitiative"
$env:DEFAULT_PATREON_ID    = "local-dev"

# 1) Ouvre le watcher (Grunt) dans une 2e fenêtre
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command", "Set-Location `"$PSScriptRoot`"; npx grunt"
)

# 2) Lance le serveur dans la fenêtre courante
npm run start
