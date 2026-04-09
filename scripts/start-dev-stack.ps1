param(
    [switch]$NoMeralco,
    [switch]$NoBackend,
    [switch]$NoFrontend,
    [switch]$NoNgrok,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot 'backend'
$FrontendDir = Join-Path $ProjectRoot 'frontend'
$MeralcoScript = Join-Path $BackendDir 'scripts\start-meralco-local.ps1'
$NgrokConfig = Join-Path $env:LOCALAPPDATA 'ngrok\ngrok.yml'

function Write-Step([string]$message) {
    Write-Host "[STARTUP] $message"
}

function Start-TerminalCommand {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    if ($DryRun) {
        Write-Step "DRY RUN -> $Title | cd $WorkingDirectory ; $Command"
        return
    }

    $cmd = "$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$WorkingDirectory'; $Command"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $cmd | Out-Null
    Write-Step "Started: $Title"
}

function Get-NgrokExecutable {
    $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -and (Test-Path $cmd.Source) -and ((Get-Item $cmd.Source).Length -gt 0)) {
        return $cmd.Source
    }

    $pkgDir = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'Ngrok.Ngrok*' } |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($pkgDir) {
        $candidate = Join-Path $pkgDir.FullName 'ngrok.exe'
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return $null
}

Write-Step "Project root: $ProjectRoot"

if (-not $NoMeralco) {
    if (-not (Test-Path $MeralcoScript)) {
        throw "Meralco startup script not found: $MeralcoScript"
    }

    if ($DryRun) {
        Write-Step "DRY RUN -> powershell -ExecutionPolicy Bypass -File '$MeralcoScript'"
    }
    else {
        Write-Step 'Starting Meralco local API...'
        powershell -ExecutionPolicy Bypass -File $MeralcoScript
    }
}

if (-not $NoBackend) {
    if (-not (Test-Path (Join-Path $BackendDir 'package.json'))) {
        throw "Backend package.json not found: $BackendDir"
    }
    Start-TerminalCommand -Title 'JNL Backend' -WorkingDirectory $BackendDir -Command 'npm start'
}

if (-not $NoFrontend) {
    if (-not (Test-Path (Join-Path $FrontendDir 'package.json'))) {
        throw "Frontend package.json not found: $FrontendDir"
    }
    Start-TerminalCommand -Title 'JNL Frontend' -WorkingDirectory $FrontendDir -Command 'npm start'
}

if (-not $NoNgrok) {
    $ngrokExe = Get-NgrokExecutable
    if (-not $ngrokExe) {
        Write-Step 'ngrok executable not found. Skipping ngrok startup.'
    }
    else {
        $quotedNgrok = '"' + $ngrokExe + '"'
        $ngrokCommand = if (Test-Path $NgrokConfig) {
            "& $quotedNgrok start frontend backend --config '$NgrokConfig'"
        } else {
            "& $quotedNgrok start frontend backend"
        }

        Start-TerminalCommand -Title 'JNL ngrok' -WorkingDirectory $ProjectRoot -Command $ngrokCommand
    }
}

Write-Step 'Startup sequence completed.'
