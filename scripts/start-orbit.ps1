<#
.SYNOPSIS
Starts the installed Orbit (see publish-local.ps1) in the background and opens it in the browser. If it is
already running it only opens the browser. It keeps running until stop-orbit.ps1.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File C:\Orbit\start-orbit.ps1
#>
param([switch] $NoBrowser)
$ErrorActionPreference = 'Stop'

$orbitHome = $PSScriptRoot
$appDir = Join-Path $orbitHome 'app'
$dataDir = Join-Path $orbitHome 'data'
$logDir = Join-Path $dataDir 'logs'
$pidFile = Join-Path $dataDir 'orbit.pid'
$port = 5050
$url = "http://localhost:$port"
$timeoutSeconds = 60

function Test-Orbit {
    try { Invoke-WebRequest -Uri "$url/health" -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true }
    catch { return $false }
}

if (Test-Orbit) { if (-not $NoBrowser) { Start-Process $url }; return }
if (-not (Test-Path (Join-Path $appDir 'Orbit.Api.dll'))) { throw "Orbit is not installed in $orbitHome; run scripts\publish-local.ps1 first." }

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:ASPNETCORE_URLS = $url
$env:ConnectionStrings__Orbit = "Data Source=$(Join-Path $dataDir 'orbit.db')"
$env:Auth__SigningKey = (Get-Content -LiteralPath (Join-Path $dataDir 'auth.key') -Raw).Trim()

# Started through cmd, which writes the logs, instead of Start-Process -RedirectStandardOutput: that
# option makes Windows hand the API every handle this script holds, including the pipe of whoever ran it
# (a terminal piping the output, publish-local.ps1 run from a tool). The pipe then stays open while Orbit
# runs and the caller never gets past this script. Without the -Redirect options Start-Process uses
# ShellExecute, which passes the environment above but no handles.
function Start-Api {
    $dll = Join-Path $appDir 'Orbit.Api.dll'
    $outLog = Join-Path $logDir 'orbit.out.log'
    $errLog = Join-Path $logDir 'orbit.err.log'
    $command = "`"dotnet`" `"$dll`" > `"$outLog`" 2> `"$errLog`""
    return Start-Process -FilePath 'cmd.exe' -ArgumentList '/d', '/s', '/c', "`"$command`"" `
        -WorkingDirectory $appDir -WindowStyle Hidden -PassThru
}

# stop-orbit.ps1 stops the dotnet process named in the pid file, not the cmd that started it.
function Save-ApiProcessId([int] $starterId) {
    $deadline = (Get-Date).AddSeconds(10)
    while ((Get-Date) -lt $deadline) {
        $api = Get-CimInstance Win32_Process -Filter "ParentProcessId = $starterId AND Name = 'dotnet.exe'"
        if ($api) { $api.ProcessId | Select-Object -First 1 | Set-Content -LiteralPath $pidFile; return }
        Start-Sleep -Milliseconds 100
    }
    throw "Orbit's dotnet process did not start (cmd $starterId); see $logDir"
}

$starter = Start-Api
Save-ApiProcessId $starter.Id

$deadline = (Get-Date).AddSeconds($timeoutSeconds)
while ((Get-Date) -lt $deadline) {
    if (Test-Orbit) { if (-not $NoBrowser) { Start-Process $url }; return }
    Start-Sleep -Milliseconds 300
}
throw "Orbit did not answer at $url within $timeoutSeconds seconds; see $logDir"
