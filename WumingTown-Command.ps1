param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("StartWeb", "StopWeb", "StartDesktop", "BuildWeb", "BuildDesktop", "BuildAll")]
  [string] $Mode,
  [int[]] $Ports = @(4173, 5173, 5174, 5175, 5180, 3000, 3001, 4174, 8000, 8080, 8090),
  [string] $HostName = "127.0.0.1",
  [switch] $NoBrowser,
  [switch] $DryRun
)

$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$WebRoot = Join-Path $Root "apps\web"
$PidFile = Join-Path $Root ".wuming-town-web.pid"
$DesktopExe = Join-Path $Root "dist\desktop\win-unpacked\WumingTown.exe"

function Write-Step {
  param([string] $Message)
  Write-Host ""
  Write-Host "==> $Message"
}

function Invoke-Checked {
  param(
    [string] $FilePath,
    [string[]] $Arguments
  )

  $display = "$FilePath $($Arguments -join ' ')"
  if ($DryRun) {
    Write-Host "[dry-run] $display"
    return
  }

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$display failed with exit code $LASTEXITCODE"
  }
}

function Ensure-Dependencies {
  $rootModules = Join-Path $Root "node_modules"
  $webModules = Join-Path $WebRoot "node_modules"
  if ((Test-Path $rootModules) -and (Test-Path $webModules)) {
    return
  }

  Write-Step "Installing workspace dependencies"
  Invoke-Checked "corepack" @("pnpm", "install")
}

function Test-PortAvailable {
  param([int] $Port)

  $listener = $null
  try {
    $address = [System.Net.IPAddress]::Parse($HostName)
    $listener = [System.Net.Sockets.TcpListener]::new($address, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $listener) {
      $listener.Stop()
    }
  }
}

function Test-WumingPage {
  param([string] $Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
    return ($response.StatusCode -eq 200 -and $response.Content -like "*Wuming Town Web Shell*")
  } catch {
    return $false
  }
}

function Wait-HttpOk {
  param(
    [string] $Url,
    [int] $TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  return $false
}

function Open-Browser {
  param([string] $Url)

  if ($NoBrowser) {
    Write-Host "Browser open skipped: $Url"
    return
  }

  if ($DryRun) {
    Write-Host "[dry-run] open $Url"
    return
  }

  Start-Process $Url
}

function Start-Web {
  if (!(Test-Path $WebRoot)) {
    throw "Missing web app directory: $WebRoot"
  }

  foreach ($port in $Ports) {
    $url = "http://$HostName`:$port/"
    if (Test-WumingPage $url) {
      Write-Step "Wuming Town web server is already running"
      Write-Host "URL: $url"
      Open-Browser $url
      return
    }

    if (Test-PortAvailable $port) {
      $selectedPort = $port
      break
    }
  }

  if ($null -eq $selectedPort) {
    throw "No available local test port found. Tried: $($Ports -join ', ')"
  }

  $selectedUrl = "http://$HostName`:$selectedPort/"
  $serverCommand = "title Wuming Town Web Server && cd /d `"$WebRoot`" && corepack pnpm exec vite --host $HostName --port $selectedPort --strictPort"

  Write-Step "Starting Wuming Town web server"
  Write-Host "URL: $selectedUrl"
  Write-Host "Command: cmd.exe /k $serverCommand"

  if ($DryRun) {
    return
  }

  Ensure-Dependencies
  $process = Start-Process -FilePath "cmd.exe" -ArgumentList @("/k", $serverCommand) -WorkingDirectory $Root -WindowStyle Normal -PassThru
  [System.IO.File]::WriteAllText($PidFile, [string] $process.Id, [System.Text.UTF8Encoding]::new($false))

  if (Wait-HttpOk $selectedUrl 30) {
    Open-Browser $selectedUrl
    Write-Host "Server PID: $($process.Id)"
    Write-Host "Close the server window or run StopLocalTest.cmd to stop it."
    return
  }

  throw "The server was started but did not answer within 30 seconds: $selectedUrl"
}

function Stop-ProcessTree {
  param([int] $ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree ([int] $child.ProcessId)
  }

  if ($DryRun) {
    Write-Host "[dry-run] stop PID $ProcessId"
    return
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
}

function Stop-Web {
  $pids = New-Object System.Collections.Generic.HashSet[int]

  if (Test-Path $PidFile) {
    $pidText = (Get-Content -Raw $PidFile).Trim()
    $pidValue = 0
    if ([int]::TryParse($pidText, [ref] $pidValue)) {
      [void] $pids.Add($pidValue)
    }
  }

  $escapedRoot = [WildcardPattern]::Escape($Root)
  $processes = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -like "*$escapedRoot*" -and
    ($_.CommandLine -like "*vite*" -or $_.CommandLine -like "*corepack*" -or $_.CommandLine -like "*pnpm*")
  }
  foreach ($process in $processes) {
    [void] $pids.Add([int] $process.ProcessId)
  }

  if ($pids.Count -eq 0) {
    Write-Host "No Wuming Town web server process found."
    return
  }

  Write-Step "Stopping Wuming Town web server"
  foreach ($pidValue in $pids) {
    Stop-ProcessTree $pidValue
  }

  if (!$DryRun -and (Test-Path $PidFile)) {
    Remove-Item -LiteralPath $PidFile -Force
  }
}

function Start-Desktop {
  Write-Step "Starting Wuming Town desktop build"
  Write-Host "Executable: $DesktopExe"

  if ($DryRun) {
    return
  }

  if (!(Test-Path $DesktopExe)) {
    throw "Desktop executable not found. Run BuildDesktop.cmd first: $DesktopExe"
  }

  Start-Process -FilePath $DesktopExe -WorkingDirectory (Split-Path -Parent $DesktopExe)
}

function Build-Web {
  Write-Step "Building Wuming Town web renderer"
  Ensure-Dependencies
  Invoke-Checked "corepack" @("pnpm", "build:web")
  Write-Host "Web renderer output: apps\desktop-electron\dist\renderer"
}

function Build-Desktop {
  Write-Step "Building Wuming Town desktop package"
  Ensure-Dependencies
  Invoke-Checked "corepack" @("pnpm", "build:desktop")
  Write-Host "Desktop executable: $DesktopExe"
}

function Build-All {
  Write-Step "Running quality gate and desktop package build"
  Ensure-Dependencies
  Invoke-Checked "corepack" @("pnpm", "quality")
  Invoke-Checked "corepack" @("pnpm", "build:desktop")
  Write-Host "Desktop executable: $DesktopExe"
}

Set-Location $Root

switch ($Mode) {
  "StartWeb" { Start-Web }
  "StopWeb" { Stop-Web }
  "StartDesktop" { Start-Desktop }
  "BuildWeb" { Build-Web }
  "BuildDesktop" { Build-Desktop }
  "BuildAll" { Build-All }
}
