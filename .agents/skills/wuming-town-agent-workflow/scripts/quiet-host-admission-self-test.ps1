$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$productionScript = Join-Path $PSScriptRoot "quiet-host-admission.ps1"
$windowsPowerShell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
$testModeVariable = "WM_QUIET_HOST_SELF_TEST"
$testPayloadVariable = "WM_QUIET_HOST_SELF_TEST_PAYLOAD_B64"
$exactCommit = "1111111111111111111111111111111111111111"

function New-TestWindow {
  param(
    [int]$WindowIndex,
    $HostBusyPct = 24.41,
    $MaxProcessHostPct = 6.0
  )

  return [pscustomobject][ordered]@{
    windowIndex = $WindowIndex
    elapsedSeconds = 6.0
    hostBusyPct = $HostBusyPct
    maxProcessHostPct = $MaxProcessHostPct
    maxProcessName = "Code"
    maxProcessId = 40096
    acShadowsAbsentAtStart = $true
    acShadowsAbsentAtEnd = $true
  }
}

function New-TestPayload {
  return [pscustomobject][ordered]@{
    invocationValid = $true
    throwUnexpected = $false
    repositoryRoot = "synthetic://repository"
    expectedCommit = $exactCommit
    actualCommitBefore = $exactCommit
    actualCommitAfter = $exactCommit
    logicalProcessorCount = 16
    gitCleanBefore = $true
    gitCleanAfter = $true
    noConcurrentBenchmarkConfirmed = $true
    acShadowsAbsentBefore = $true
    acShadowsAbsentWindow1End = $true
    acShadowsAbsentWindow2End = $true
    acShadowsAbsentAfter = $true
    windows = @(
      (New-TestWindow -WindowIndex 1),
      (New-TestWindow -WindowIndex 2 -HostBusyPct 22.53 -MaxProcessHostPct 5.5)
    )
  }
}

function New-TestCase {
  param(
    [string]$Name,
    $Payload,
    [int]$ExpectedExitCode,
    [string]$ExpectedStatus,
    [string]$ExpectedReasonCode,
    [string]$ExpectedEvidenceKind = "synthetic",
    [string]$ExtraArguments = ""
  )

  return [pscustomobject]@{
    name = $Name
    payload = $Payload
    expectedExitCode = $ExpectedExitCode
    expectedStatus = $ExpectedStatus
    expectedReasonCode = $ExpectedReasonCode
    expectedEvidenceKind = $ExpectedEvidenceKind
    extraArguments = $ExtraArguments
  }
}

function Invoke-TestCase {
  param($Case)

  $startInfo = New-Object Diagnostics.ProcessStartInfo
  $startInfo.FileName = $windowsPowerShell
  $quotedScript = '"' + $productionScript.Replace('"', '\"') + '"'
  $startInfo.Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File $quotedScript"
  if (-not [string]::IsNullOrWhiteSpace($Case.extraArguments)) {
    $startInfo.Arguments += " " + $Case.extraArguments
  }
  $startInfo.WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..\..\..")).Path
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true
  $null = $startInfo.EnvironmentVariables.Remove($testModeVariable)
  $null = $startInfo.EnvironmentVariables.Remove($testPayloadVariable)

  if ($null -ne $Case.payload) {
    $payloadJson = $Case.payload | ConvertTo-Json -Depth 10 -Compress
    $payloadBytes = [Text.Encoding]::UTF8.GetBytes($payloadJson)
    $startInfo.EnvironmentVariables[$testModeVariable] = "1"
    $startInfo.EnvironmentVariables[$testPayloadVariable] = [Convert]::ToBase64String($payloadBytes)
  }

  $process = New-Object Diagnostics.Process
  $process.StartInfo = $startInfo
  $started = $process.Start()
  if (-not $started) {
    throw "case $($Case.name): child process did not start"
  }
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()
  $exitCode = $process.ExitCode
  $process.Dispose()

  return [pscustomobject]@{
    stdout = $stdout
    stderr = $stderr
    exitCode = $exitCode
  }
}

function Assert-TestCase {
  param($Case)

  $result = Invoke-TestCase $Case
  if ($result.stderr.Length -ne 0) {
    throw "case $($Case.name): stderr was not empty: $($result.stderr)"
  }

  $line = $result.stdout.TrimEnd([char[]]"`r`n")
  if ([string]::IsNullOrWhiteSpace($line) -or $line.Contains("`r") -or $line.Contains("`n")) {
    throw "case $($Case.name): stdout was not exactly one non-empty JSON line"
  }
  if ($result.exitCode -ne $Case.expectedExitCode) {
    throw "case $($Case.name): process exit $($result.exitCode), expected $($Case.expectedExitCode); stdout=$line"
  }

  try {
    $json = $line | ConvertFrom-Json
  } catch {
    throw "case $($Case.name): stdout was not parseable JSON"
  }

  foreach ($field in @("schemaVersion", "evidenceKind", "status", "reasonCode", "exitCode", "constants", "windows", "facts")) {
    if (-not (@($json.PSObject.Properties.Name) -contains $field)) {
      throw "case $($Case.name): JSON field $field missing"
    }
  }
  if ([int]$json.schemaVersion -ne 1) {
    throw "case $($Case.name): schemaVersion mismatch"
  }
  if ([string]$json.evidenceKind -ne $Case.expectedEvidenceKind) {
    throw "case $($Case.name): evidenceKind $($json.evidenceKind), expected $($Case.expectedEvidenceKind)"
  }
  if ([string]$json.status -ne $Case.expectedStatus) {
    throw "case $($Case.name): status $($json.status), expected $($Case.expectedStatus)"
  }
  if ([string]$json.reasonCode -ne $Case.expectedReasonCode) {
    throw "case $($Case.name): reason $($json.reasonCode), expected $($Case.expectedReasonCode)"
  }
  if ([int]$json.exitCode -ne $result.exitCode) {
    throw "case $($Case.name): JSON/process exit disagreement"
  }
  if ([int]$json.constants.windowCount -ne 2 -or [int]$json.constants.windowSeconds -ne 6 -or [double]$json.constants.hostBusyThresholdPct -ne 40.0 -or [double]$json.constants.maxProcessHostThresholdPct -ne 8.0) {
    throw "case $($Case.name): locked constants changed"
  }
}

if (-not (Test-Path -LiteralPath $productionScript -PathType Leaf)) {
  throw "production script not found: $productionScript"
}
if (-not (Test-Path -LiteralPath $windowsPowerShell -PathType Leaf)) {
  throw "Windows PowerShell executable not found: $windowsPowerShell"
}
if ($PSVersionTable.PSVersion.Major -ne 5) {
  throw "self-test must run under Windows PowerShell 5.1"
}

$cases = New-Object Collections.Generic.List[object]

$null = $cases.Add((New-TestCase -Name "manual-invalid-arguments" -Payload $null -ExpectedExitCode 2 -ExpectedStatus "fail" -ExpectedReasonCode "invalid_invocation" -ExpectedEvidenceKind "measured" -ExtraArguments "-Unknown"))

$payload = New-TestPayload
$payload.invocationValid = $false
$null = $cases.Add((New-TestCase "synthetic-invalid-invocation" $payload 2 "fail" "invalid_invocation"))

foreach ($finiteCase in @(
  [pscustomobject]@{ name = "finite-zero"; host = 0.0; max = 0.0; exit = 0; status = "pass"; reason = "admission_passed" },
  [pscustomobject]@{ name = "finite-negative-zero"; host = [double]-0.0; max = 0.0; exit = 0; status = "pass"; reason = "admission_passed" },
  [pscustomobject]@{ name = "finite-24-41"; host = 24.41; max = 6.0; exit = 0; status = "pass"; reason = "admission_passed" },
  [pscustomobject]@{ name = "threshold-boundary-40-8"; host = 40.0; max = 8.0; exit = 0; status = "pass"; reason = "admission_passed" },
  [pscustomobject]@{ name = "finite-double-max"; host = [double]::MaxValue; max = 8.0; exit = 30; status = "fail"; reason = "threshold_exceeded" }
)) {
  $payload = New-TestPayload
  $payload.windows[0].hostBusyPct = $finiteCase.host
  $payload.windows[0].maxProcessHostPct = $finiteCase.max
  $null = $cases.Add((New-TestCase $finiteCase.name $payload $finiteCase.exit $finiteCase.status $finiteCase.reason))
}

foreach ($invalidCase in @(
  [pscustomobject]@{ name = "non-finite-null"; value = $null },
  [pscustomobject]@{ name = "non-numeric-string"; value = "not-a-number" },
  [pscustomobject]@{ name = "non-finite-nan"; value = "__NaN__" },
  [pscustomobject]@{ name = "non-finite-positive-infinity"; value = "__POSITIVE_INFINITY__" },
  [pscustomobject]@{ name = "non-finite-negative-infinity"; value = "__NEGATIVE_INFINITY__" },
  [pscustomobject]@{ name = "array-valued-measurement"; value = @(1.0, 2.0) }
)) {
  $payload = New-TestPayload
  $payload.windows[0].hostBusyPct = $invalidCase.value
  $null = $cases.Add((New-TestCase $invalidCase.name $payload 20 "fail" "evidence_shape_invalid"))
}

$payload = New-TestPayload
$payload.windows[0].PSObject.Properties.Remove("maxProcessName")
$null = $cases.Add((New-TestCase "missing-window-field" $payload 20 "fail" "evidence_shape_invalid"))

$payload = New-TestPayload
$payload.windows = @($payload.windows[0])
$null = $cases.Add((New-TestCase "wrong-window-count" $payload 20 "fail" "evidence_shape_invalid"))

$payload = New-TestPayload
$payload.windows = @($payload.windows[0], $payload.windows[0], $payload.windows[1])
$null = $cases.Add((New-TestCase "duplicate-window-output" $payload 20 "fail" "evidence_shape_invalid"))

$payload = New-TestPayload
$payload.logicalProcessorCount = 0
$null = $cases.Add((New-TestCase "invalid-logical-cpu-count" $payload 20 "fail" "evidence_shape_invalid"))

$payload = New-TestPayload
$payload.windows[0].hostBusyPct = 40.01
$null = $cases.Add((New-TestCase "host-threshold-exceeded" $payload 30 "fail" "threshold_exceeded"))

$payload = New-TestPayload
$payload.windows[0].maxProcessHostPct = 8.01
$null = $cases.Add((New-TestCase "process-threshold-exceeded" $payload 30 "fail" "threshold_exceeded"))

$payload = New-TestPayload
$payload.gitCleanBefore = $false
$null = $cases.Add((New-TestCase "dirty-before" $payload 10 "fail" "git_dirty_before"))

$payload = New-TestPayload
$payload.actualCommitBefore = "2222222222222222222222222222222222222222"
$null = $cases.Add((New-TestCase "commit-mismatch" $payload 10 "fail" "commit_mismatch"))

$payload = New-TestPayload
$payload.acShadowsAbsentBefore = $false
$null = $cases.Add((New-TestCase "acshadows-before" $payload 10 "fail" "acshadows_present_before"))

$payload = New-TestPayload
$payload.noConcurrentBenchmarkConfirmed = $false
$null = $cases.Add((New-TestCase "benchmark-confirmation-missing" $payload 10 "fail" "benchmark_confirmation_missing"))

$payload = New-TestPayload
$payload.gitCleanAfter = $false
$null = $cases.Add((New-TestCase "dirty-after" $payload 40 "fail" "git_dirty_after"))

$payload = New-TestPayload
$payload.acShadowsAbsentWindow1End = $false
$null = $cases.Add((New-TestCase "acshadows-during" $payload 40 "fail" "acshadows_present_during_or_after"))

$payload = New-TestPayload
$payload.acShadowsAbsentAfter = $false
$null = $cases.Add((New-TestCase "acshadows-after" $payload 40 "fail" "acshadows_present_during_or_after"))

$payload = New-TestPayload
$payload.actualCommitAfter = "3333333333333333333333333333333333333333"
$null = $cases.Add((New-TestCase "commit-changed-after" $payload 40 "fail" "commit_changed_after"))

$payload = New-TestPayload
$payload.throwUnexpected = $true
$null = $cases.Add((New-TestCase "unexpected-exception" $payload 70 "fail" "unexpected_exception"))

try {
  foreach ($case in $cases) {
    Assert-TestCase $case
  }
  [Console]::Out.WriteLine("WM-0180 quiet-host admission self-test passed: $($cases.Count) cases")
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
