param(
    [int]$HostPort = 5050,
    [switch]$Recreate
)

$ErrorActionPreference = 'Stop'

$ContainerName = 'meralco-ph'
$Image = 'ghcr.io/rairulyle/meralco-ph:latest'
$HealthUrl = "http://localhost:$HostPort/health"
$RatesUrl = "http://localhost:$HostPort/rates"

Write-Host "[MERALCO] Using image: $Image"
Write-Host "[MERALCO] Target container: $ContainerName"
Write-Host "[MERALCO] Host port: $HostPort"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI is not installed or not in PATH.'
}

$dockerInfo = docker info 2>$null
if ($LASTEXITCODE -ne 0) {
    throw 'Docker daemon is not running. Start Docker Desktop and wait until Engine is running, then rerun this script.'
}

$existingIdRaw = docker ps -a -q -f "name=^/$ContainerName$"
$existingId = if ($existingIdRaw) { $existingIdRaw.Trim() } else { '' }

if ($Recreate -and $existingId) {
    Write-Host "[MERALCO] Recreate requested. Removing existing container..."
    docker rm -f $ContainerName | Out-Null
    $existingId = ''
}

if ($existingId) {
    $isRunning = (docker inspect -f "{{.State.Running}}" $ContainerName).Trim()
    if ($isRunning -eq 'true') {
        Write-Host '[MERALCO] Container already running.'
    } else {
        Write-Host '[MERALCO] Starting existing container...'
        docker start $ContainerName | Out-Null
    }
} else {
    Write-Host '[MERALCO] Pulling latest image if needed and starting new container...'
    docker run -d --name $ContainerName -p "${HostPort}:5000" $Image | Out-Null
}

$maxAttempts = 20
$delaySeconds = 2
$healthy = $false

for ($i = 1; $i -le $maxAttempts; $i++) {
    try {
        $health = Invoke-RestMethod -Method Get -Uri $HealthUrl -TimeoutSec 5
        Write-Host "[MERALCO] Health check passed on attempt $i."
        $healthy = $true
        break
    } catch {
        Write-Host "[MERALCO] Waiting for API readiness ($i/$maxAttempts)..."
        Start-Sleep -Seconds $delaySeconds
    }
}

if (-not $healthy) {
    Write-Warning "[MERALCO] API did not become healthy in time."
    Write-Host '[MERALCO] Recent logs:'
    docker logs $ContainerName --tail 50
    exit 1
}

try {
    $rates = Invoke-RestMethod -Method Get -Uri $RatesUrl -TimeoutSec 10
    Write-Host "[MERALCO] Rates endpoint reachable: $RatesUrl"
    if ($rates -and $rates.success -eq $false) {
        Write-Warning "[MERALCO] Service is up, but live scrape returned no rate data: $($rates.error)"
        Write-Host '[MERALCO] Backend will continue using fallback/stale rates until source data is available.'
    } else {
        Write-Host '[MERALCO] Live rates are available.'
    }
    Write-Host '[MERALCO] Startup complete.'
    $rates | ConvertTo-Json -Depth 6
} catch {
    Write-Warning "[MERALCO] Health is up but /rates request failed: $($_.Exception.Message)"
    Write-Host '[MERALCO] Backend can still use fallback/stale rates while API scrape recovers.'
    Write-Host '[MERALCO] Recent logs:'
    docker logs $ContainerName --tail 50
}
