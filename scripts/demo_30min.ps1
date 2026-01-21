# Shipyard Community v0.2.0 – 30-minute demo (Windows PowerShell)
# Flow: build → smoke (ephemeral port) → start (PORT, default 8788, override allowed) → curl 3 endpoints
# No secrets required; OPENAI_API_KEY is not needed.

$ErrorActionPreference = 'Stop'
$PSStyle.OutputRendering = 'PlainText'

$ScriptRoot = Split-Path -Path $MyInvocation.MyCommand.Path -Parent
$RepoRoot   = Split-Path -Path $ScriptRoot -Parent
Push-Location $RepoRoot

$DEFAULT_PORT = 8788
$Port = if ($env:PORT) { [int]$env:PORT } else { $DEFAULT_PORT }
$ServerProcess = $null
$ServerLog = Join-Path $RepoRoot 'tmp_demo_server.log'
$PreviousPort = $env:PORT

function Test-PortBusy([int]$PortToCheck) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $client.Connect('127.0.0.1', $PortToCheck)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Get-FreePort() {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    return $port
}

function Write-Rule($text) {
    Write-Host ('=' * 56)
    Write-Host "  $text"
    Write-Host ('=' * 56)
}

try {
    Write-Rule 'Shipyard Community – 30-Minute Live Demo (Windows)'
    Write-Host ''

    if (Test-PortBusy -PortToCheck $Port) {
        if (-not $env:PORT -and $Port -eq $DEFAULT_PORT) {
            Write-Host "⚠️  Default port $DEFAULT_PORT is busy; searching for a free port..."
            $fallback = Get-FreePort
            $Port = $fallback
            Write-Host "   Using fallback PORT=$Port"
        } else {
            Write-Host "❌ Port $Port is busy. Choose a different port, e.g."
            Write-Host "   $env:COMSPEC /c \"set PORT=8790&& pwsh -NoProfile -File scripts/demo_30min.ps1\""
            Write-Host "   or: $env:COMSPEC /c \"set PORT=8790&& pnpm -s start\""
            exit 1
        }
    }

    Write-Host "📦 Step 1: Building UI..."
    pnpm -s build
    Write-Host "   ✅ Build complete"
    Write-Host ''

    Write-Host "🧪 Step 2: Running smoke tests..."
    pnpm -s test:smoke
    Write-Host "   ✅ Smoke tests passed"
    Write-Host ''

    Write-Host "🚀 Step 3: Starting server on port $Port..."
    $env:PORT = $Port
    $ServerProcess = Start-Process -FilePath 'pnpm' -ArgumentList '-s','start' -WorkingDirectory $RepoRoot -PassThru -NoNewWindow -RedirectStandardOutput $ServerLog -RedirectStandardError $ServerLog
    Write-Host "   Server PID: $($ServerProcess.Id)"
    Write-Host "   Base URL: http://127.0.0.1:$Port"
    Write-Host "   Waiting for server to boot..."

    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        try {
            Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2 | Out-Null
            $ready = $true
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }

    if (-not $ready) {
        Write-Host "   ❌ Server failed to start"
        if (Test-Path $ServerLog) {
            Write-Host '--- server log tail ---'
            Get-Content -Path $ServerLog -Tail 40
        }
        exit 1
    }

    Write-Host "   ✅ Server ready"
    Write-Host ''

    Write-Host "📡 Step 4: Running live API demos..."
    Write-Host ''

    Write-Host "  Demo 1: Health check"
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
    Write-Host "    GET /health"
    Write-Host "    Response: $($health | ConvertTo-Json -Compress)"
    Write-Host "    ✅ HTTP 200"
    Write-Host ''

    Write-Host "  Demo 2: Orchestrator state"
    $state = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/state" -TimeoutSec 5
    $stateSummary = if ($state.current) { $state.current } else { '(state object)' }
    Write-Host "    GET /api/state"
    Write-Host "    Response: $stateSummary"
    Write-Host "    ✅ HTTP 200"
    Write-Host ''

    Write-Host "  Demo 3: Project list"
    $projects = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/projects" -TimeoutSec 5
    $count = ($projects | Measure-Object).Count
    Write-Host "    GET /api/projects"
    Write-Host "    Response: $count projects"
    Write-Host "    ✅ HTTP 200"
    Write-Host ''

    Write-Rule '✅ Demo complete!'
    Write-Host "Summary:"
    Write-Host "  • UI built successfully"
    Write-Host "  • Smoke tests passed"
    Write-Host "  • Server running on http://127.0.0.1:$Port"
    Write-Host "  • All 3 API endpoints returned HTTP 200"
    Write-Host ''
    Write-Host "What you saw:"
    Write-Host "  - The open-core orchestrator managing projects locally"
    Write-Host "  - State synchronization (no platform dependencies)"
    Write-Host "  - Project registry from ./data/projects.json"
    Write-Host ''
    Write-Host "Try manually:"
    Write-Host "  curl http://127.0.0.1:$Port/api/project-status?id=agent-dashboard"
    Write-Host ''
    Write-Host "The server will shut down automatically when this script exits."
    Write-Host ''
}
finally {
    if ($ServerProcess -and -not $ServerProcess.HasExited) {
        Write-Host "🧹 Cleaning up server (PID $($ServerProcess.Id))..."
        Stop-Process -Id $ServerProcess.Id -Force -ErrorAction SilentlyContinue
    }
    if ($PreviousPort) { $env:PORT = $PreviousPort } else { Remove-Item Env:PORT -ErrorAction SilentlyContinue }
    Pop-Location
}
