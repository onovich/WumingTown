$ErrorActionPreference = "Stop"
Set-StrictMode -Version 2.0

$script:SchemaVersion = 1
$script:WindowCount = 2
$script:WindowSeconds = 6
$script:HostBusyThresholdPct = 40.0
$script:MaxProcessThresholdPct = 8.0
$script:SelfTestModeVariable = "WM_QUIET_HOST_SELF_TEST"
$script:SelfTestPayloadVariable = "WM_QUIET_HOST_SELF_TEST_PAYLOAD_B64"

function Test-HasProperty {
  param($Value, [string]$Name)

  if ($null -eq $Value) {
    return $false
  }

  return @($Value.PSObject.Properties.Name) -contains $Name
}

function Test-FiniteNumber {
  param($Value)

  if ($null -eq $Value -or $Value -is [System.Array] -or $Value -is [string] -or $Value -is [bool] -or $Value -is [char]) {
    return $false
  }

  try {
    $number = [Convert]::ToDouble($Value, [Globalization.CultureInfo]::InvariantCulture)
  } catch {
    return $false
  }

  return (-not [double]::IsNaN($number)) -and (-not [double]::IsInfinity($number))
}

function Test-PositiveInt32 {
  param($Value)

  if (-not (Test-FiniteNumber $Value)) {
    return $false
  }
  $number = [Convert]::ToDouble($Value, [Globalization.CultureInfo]::InvariantCulture)
  return $number -gt 0 -and $number -le [int]::MaxValue -and [math]::Floor($number) -eq $number
}

function Test-NonNegativeInt32 {
  param($Value)

  if (-not (Test-FiniteNumber $Value)) {
    return $false
  }
  $number = [Convert]::ToDouble($Value, [Globalization.CultureInfo]::InvariantCulture)
  return $number -ge 0 -and $number -le [int]::MaxValue -and [math]::Floor($number) -eq $number
}

function New-AdmissionEvidence {
  param([string]$EvidenceKind)

  return [pscustomobject][ordered]@{
    schemaVersion = $script:SchemaVersion
    evidenceKind = $EvidenceKind
    status = "fail"
    reasonCode = "unexpected_exception"
    reasonDetail = $null
    exitCode = 70
    exactCommit = $null
    runtime = [pscustomobject][ordered]@{
      powerShellVersion = $PSVersionTable.PSVersion.ToString()
      osVersion = [Environment]::OSVersion.VersionString
    }
    logicalProcessorCount = $null
    constants = [pscustomobject][ordered]@{
      windowCount = $script:WindowCount
      windowSeconds = $script:WindowSeconds
      hostBusyThresholdPct = $script:HostBusyThresholdPct
      maxProcessHostThresholdPct = $script:MaxProcessThresholdPct
    }
    windows = @()
    maximumProcess = $null
    facts = [pscustomobject][ordered]@{
      repositoryRoot = $null
      expectedCommit = $null
      actualCommitBefore = $null
      actualCommitAfter = $null
      gitCleanBefore = $false
      gitCleanAfter = $false
      acShadowsAbsentBefore = $false
      acShadowsAbsentWindow1End = $false
      acShadowsAbsentWindow2End = $false
      acShadowsAbsentAfter = $false
      noConcurrentBenchmarkConfirmed = $false
    }
  }
}

function Complete-AdmissionEvidence {
  param(
    $Evidence,
    [string]$Status,
    [string]$ReasonCode,
    [int]$ExitCode,
    [string]$ReasonDetail = $null
  )

  $Evidence.status = $Status
  $Evidence.reasonCode = $ReasonCode
  $Evidence.reasonDetail = $ReasonDetail
  $Evidence.exitCode = $ExitCode
  return $Evidence
}

function Parse-AdmissionArguments {
  param([object[]]$Tokens)

  $repositoryRoot = $null
  $expectedCommit = $null
  $confirmed = $false
  $index = 0

  while ($index -lt $Tokens.Count) {
    $token = [string]$Tokens[$index]
    switch ($token) {
      "-RepositoryRoot" {
        if ($null -ne $repositoryRoot -or ($index + 1) -ge $Tokens.Count) {
          return [pscustomobject]@{ ok = $false; reason = "invalid_repository_argument" }
        }
        $index += 1
        $repositoryRoot = [string]$Tokens[$index]
      }
      "-ExpectedCommit" {
        if ($null -ne $expectedCommit -or ($index + 1) -ge $Tokens.Count) {
          return [pscustomobject]@{ ok = $false; reason = "invalid_commit_argument" }
        }
        $index += 1
        $expectedCommit = [string]$Tokens[$index]
      }
      "-NoConcurrentBenchmarkConfirmed" {
        if ($confirmed) {
          return [pscustomobject]@{ ok = $false; reason = "duplicate_benchmark_confirmation" }
        }
        $confirmed = $true
      }
      default {
        return [pscustomobject]@{ ok = $false; reason = "unknown_argument" }
      }
    }
    $index += 1
  }

  if ([string]::IsNullOrWhiteSpace($repositoryRoot) -or [string]::IsNullOrWhiteSpace($expectedCommit)) {
    return [pscustomobject]@{ ok = $false; reason = "required_argument_missing" }
  }

  if ($expectedCommit -notmatch "^[0-9a-fA-F]{40,64}$") {
    return [pscustomobject]@{ ok = $false; reason = "expected_commit_not_exact" }
  }

  return [pscustomobject]@{
    ok = $true
    repositoryRoot = $repositoryRoot
    expectedCommit = $expectedCommit.ToLowerInvariant()
    noConcurrentBenchmarkConfirmed = $confirmed
  }
}

function Invoke-GitText {
  param([string]$RepositoryRoot, [string[]]$GitArguments)

  $command = Get-Command git -ErrorAction SilentlyContinue
  if ($null -eq $command) {
    return [pscustomobject]@{ ok = $false; exitCode = -1; text = "" }
  }

  $arguments = @("-C", $RepositoryRoot) + $GitArguments
  $output = @(& git @arguments 2>&1)
  $exitCode = $LASTEXITCODE
  return [pscustomobject]@{
    ok = $exitCode -eq 0
    exitCode = $exitCode
    text = (@($output | ForEach-Object { [string]$_ }) -join "`n").Trim()
  }
}

function Get-GitFacts {
  param([string]$RepositoryRoot)

  if (-not (Test-Path -LiteralPath $RepositoryRoot -PathType Container)) {
    return [pscustomobject]@{ ok = $false; reason = "repository_not_found" }
  }

  try {
    $normalizedRoot = [IO.Path]::GetFullPath($RepositoryRoot).TrimEnd([char[]]"\/")
  } catch {
    return [pscustomobject]@{ ok = $false; reason = "repository_path_invalid" }
  }

  $topLevel = Invoke-GitText -RepositoryRoot $normalizedRoot -GitArguments @("rev-parse", "--show-toplevel")
  if (-not $topLevel.ok) {
    return [pscustomobject]@{ ok = $false; reason = "repository_git_unavailable" }
  }

  try {
    $actualTopLevel = [IO.Path]::GetFullPath($topLevel.text).TrimEnd([char[]]"\/")
  } catch {
    return [pscustomobject]@{ ok = $false; reason = "repository_root_unreadable" }
  }

  if (-not [string]::Equals($normalizedRoot, $actualTopLevel, [StringComparison]::OrdinalIgnoreCase)) {
    return [pscustomobject]@{ ok = $false; reason = "repository_root_mismatch" }
  }

  $commit = Invoke-GitText -RepositoryRoot $normalizedRoot -GitArguments @("rev-parse", "HEAD")
  $status = Invoke-GitText -RepositoryRoot $normalizedRoot -GitArguments @("status", "--porcelain=v1", "--untracked-files=all")
  if (-not $commit.ok -or -not $status.ok) {
    return [pscustomobject]@{ ok = $false; reason = "git_facts_unavailable" }
  }

  return [pscustomobject]@{
    ok = $true
    repositoryRoot = $normalizedRoot
    commit = $commit.text.ToLowerInvariant()
    clean = [string]::IsNullOrEmpty($status.text)
  }
}

function Test-AcShadowsAbsent {
  $running = @(Get-Process -Name "ACShadows" -ErrorAction SilentlyContinue)
  return $running.Count -eq 0
}

function Get-CpuSnapshot {
  $byId = @{}
  $processes = @(Get-Process -ErrorAction SilentlyContinue)
  foreach ($process in $processes) {
    try {
      $cpu = $process.CPU
      if ($null -eq $cpu -or -not (Test-FiniteNumber $cpu)) {
        continue
      }
      $byId[[int]$process.Id] = [pscustomobject]@{
        id = [int]$process.Id
        name = [string]$process.ProcessName
        cpuSeconds = [double]$cpu
      }
    } catch {
      continue
    }
  }

  return [pscustomobject]@{
    processes = $byId
    acShadowsAbsent = Test-AcShadowsAbsent
  }
}

function Measure-CpuWindow {
  param([int]$WindowIndex, [int]$LogicalProcessorCount)

  $before = Get-CpuSnapshot
  $stopwatch = [Diagnostics.Stopwatch]::StartNew()
  Start-Sleep -Seconds $script:WindowSeconds
  $stopwatch.Stop()
  $after = Get-CpuSnapshot
  $elapsedSeconds = $stopwatch.Elapsed.TotalSeconds

  if (-not (Test-FiniteNumber $elapsedSeconds) -or $elapsedSeconds -le 0) {
    throw "invalid_elapsed_time"
  }

  $totalDelta = 0.0
  $maximumDelta = 0.0
  $maximumName = "none"
  $maximumId = 0

  foreach ($processId in $after.processes.Keys) {
    if (-not $before.processes.ContainsKey($processId)) {
      continue
    }
    $current = $after.processes[$processId]
    $previous = $before.processes[$processId]
    if (-not [string]::Equals($current.name, $previous.name, [StringComparison]::OrdinalIgnoreCase)) {
      continue
    }
    $delta = [double]$current.cpuSeconds - [double]$previous.cpuSeconds
    if (-not (Test-FiniteNumber $delta) -or $delta -le 0) {
      continue
    }
    $totalDelta += $delta
    if ($delta -gt $maximumDelta) {
      $maximumDelta = $delta
      $maximumName = $current.name
      $maximumId = [int]$processId
    }
  }

  $normalizer = [double]$elapsedSeconds * [double]$LogicalProcessorCount
  $hostBusyPct = ($totalDelta / $normalizer) * 100.0
  $maxProcessHostPct = ($maximumDelta / $normalizer) * 100.0

  return [pscustomobject][ordered]@{
    windowIndex = $WindowIndex
    elapsedSeconds = [math]::Round($elapsedSeconds, 6)
    hostBusyPct = [math]::Round($hostBusyPct, 6)
    maxProcessHostPct = [math]::Round($maxProcessHostPct, 6)
    maxProcessName = $maximumName
    maxProcessId = $maximumId
    acShadowsAbsentAtStart = [bool]$before.acShadowsAbsent
    acShadowsAbsentAtEnd = [bool]$after.acShadowsAbsent
  }
}

function Test-WindowShape {
  param($Windows, $LogicalProcessorCount)

  if (-not (Test-PositiveInt32 $LogicalProcessorCount) -or @($Windows).Count -ne $script:WindowCount) {
    return [pscustomobject]@{ ok = $false; reason = "wrong_window_count_or_cpu_count" }
  }

  for ($index = 0; $index -lt $script:WindowCount; $index += 1) {
    $window = $Windows[$index]
    if ($null -eq $window -or $window -is [System.Array]) {
      return [pscustomobject]@{ ok = $false; reason = "window_not_scalar" }
    }
    foreach ($field in @("windowIndex", "elapsedSeconds", "hostBusyPct", "maxProcessHostPct", "maxProcessName", "maxProcessId", "acShadowsAbsentAtStart", "acShadowsAbsentAtEnd")) {
      if (-not (Test-HasProperty $window $field)) {
        return [pscustomobject]@{ ok = $false; reason = "window_field_missing" }
      }
    }
    if (-not (Test-PositiveInt32 $window.windowIndex) -or [int]$window.windowIndex -ne ($index + 1)) {
      return [pscustomobject]@{ ok = $false; reason = "window_index_invalid" }
    }
    foreach ($field in @("elapsedSeconds", "hostBusyPct", "maxProcessHostPct")) {
      if (-not (Test-FiniteNumber $window.$field)) {
        return [pscustomobject]@{ ok = $false; reason = "window_value_non_finite" }
      }
    }
    if (-not (Test-NonNegativeInt32 $window.maxProcessId)) {
      return [pscustomobject]@{ ok = $false; reason = "window_process_id_invalid" }
    }
    if ([double]$window.elapsedSeconds -le 0 -or [double]$window.hostBusyPct -lt 0 -or [double]$window.maxProcessHostPct -lt 0) {
      return [pscustomobject]@{ ok = $false; reason = "window_value_out_of_range" }
    }
    if ([double]$window.maxProcessHostPct -gt ([double]$window.hostBusyPct + 0.000001)) {
      return [pscustomobject]@{ ok = $false; reason = "window_max_exceeds_total" }
    }
    if ([string]::IsNullOrWhiteSpace([string]$window.maxProcessName)) {
      return [pscustomobject]@{ ok = $false; reason = "window_process_name_missing" }
    }
  }

  return [pscustomobject]@{ ok = $true; reason = "shape_valid" }
}

function Set-ValidatedWindows {
  param($Evidence, $Windows)

  $Evidence.windows = @($Windows)
  $maximum = $Evidence.windows[0]
  if ([double]$Evidence.windows[1].maxProcessHostPct -gt [double]$maximum.maxProcessHostPct) {
    $maximum = $Evidence.windows[1]
  }
  $Evidence.maximumProcess = [pscustomobject][ordered]@{
    name = [string]$maximum.maxProcessName
    id = [int]$maximum.maxProcessId
    hostPct = [double]$maximum.maxProcessHostPct
    windowIndex = [int]$maximum.windowIndex
  }
}

function Test-ThresholdsExceeded {
  param($Windows)

  foreach ($window in @($Windows)) {
    if ([double]$window.hostBusyPct -gt $script:HostBusyThresholdPct -or [double]$window.maxProcessHostPct -gt $script:MaxProcessThresholdPct) {
      return $true
    }
  }
  return $false
}

function Convert-SyntheticNumber {
  param($Value)

  if ($Value -eq "__NaN__") { return [double]::NaN }
  if ($Value -eq "__POSITIVE_INFINITY__") { return [double]::PositiveInfinity }
  if ($Value -eq "__NEGATIVE_INFINITY__") { return [double]::NegativeInfinity }
  return $Value
}

function Invoke-SyntheticAdmission {
  param($Payload)

  $evidence = New-AdmissionEvidence -EvidenceKind "synthetic"
  if ($null -eq $Payload) {
    return Complete-AdmissionEvidence $evidence "fail" "invalid_invocation" 2 "synthetic_payload_missing"
  }
  if ((Test-HasProperty $Payload "throwUnexpected") -and [bool]$Payload.throwUnexpected) {
    throw "synthetic_unexpected_exception"
  }
  if (-not (Test-HasProperty $Payload "invocationValid") -or -not [bool]$Payload.invocationValid) {
    return Complete-AdmissionEvidence $evidence "fail" "invalid_invocation" 2
  }

  $required = @("repositoryRoot", "expectedCommit", "actualCommitBefore", "actualCommitAfter", "logicalProcessorCount", "gitCleanBefore", "gitCleanAfter", "noConcurrentBenchmarkConfirmed", "acShadowsAbsentBefore", "acShadowsAbsentWindow1End", "acShadowsAbsentWindow2End", "acShadowsAbsentAfter", "windows")
  foreach ($field in $required) {
    if (-not (Test-HasProperty $Payload $field)) {
      return Complete-AdmissionEvidence $evidence "fail" "evidence_shape_invalid" 20 "synthetic_field_missing"
    }
  }

  $evidence.facts.repositoryRoot = [string]$Payload.repositoryRoot
  $evidence.facts.expectedCommit = [string]$Payload.expectedCommit
  $evidence.facts.actualCommitBefore = [string]$Payload.actualCommitBefore
  $evidence.facts.actualCommitAfter = [string]$Payload.actualCommitAfter
  $evidence.facts.gitCleanBefore = [bool]$Payload.gitCleanBefore
  $evidence.facts.gitCleanAfter = [bool]$Payload.gitCleanAfter
  $evidence.facts.noConcurrentBenchmarkConfirmed = [bool]$Payload.noConcurrentBenchmarkConfirmed
  $evidence.facts.acShadowsAbsentBefore = [bool]$Payload.acShadowsAbsentBefore
  $evidence.facts.acShadowsAbsentWindow1End = [bool]$Payload.acShadowsAbsentWindow1End
  $evidence.facts.acShadowsAbsentWindow2End = [bool]$Payload.acShadowsAbsentWindow2End
  $evidence.facts.acShadowsAbsentAfter = [bool]$Payload.acShadowsAbsentAfter
  $evidence.exactCommit = [string]$Payload.actualCommitBefore
  $evidence.logicalProcessorCount = $Payload.logicalProcessorCount

  if (-not [bool]$Payload.noConcurrentBenchmarkConfirmed) {
    return Complete-AdmissionEvidence $evidence "fail" "benchmark_confirmation_missing" 10
  }
  if (-not [bool]$Payload.gitCleanBefore) {
    return Complete-AdmissionEvidence $evidence "fail" "git_dirty_before" 10
  }
  if (-not [bool]$Payload.acShadowsAbsentBefore) {
    return Complete-AdmissionEvidence $evidence "fail" "acshadows_present_before" 10
  }
  if (-not [string]::Equals([string]$Payload.expectedCommit, [string]$Payload.actualCommitBefore, [StringComparison]::OrdinalIgnoreCase)) {
    return Complete-AdmissionEvidence $evidence "fail" "commit_mismatch" 10
  }

  $windows = @($Payload.windows)
  foreach ($window in $windows) {
    if ($null -ne $window -and -not ($window -is [System.Array])) {
      foreach ($field in @("elapsedSeconds", "hostBusyPct", "maxProcessHostPct", "maxProcessId")) {
        if (Test-HasProperty $window $field) {
          $window.$field = Convert-SyntheticNumber $window.$field
        }
      }
    }
  }

  $shape = Test-WindowShape -Windows $windows -LogicalProcessorCount $Payload.logicalProcessorCount
  if (-not $shape.ok) {
    return Complete-AdmissionEvidence $evidence "fail" "evidence_shape_invalid" 20 $shape.reason
  }
  $evidence.logicalProcessorCount = [int]$Payload.logicalProcessorCount
  Set-ValidatedWindows -Evidence $evidence -Windows $windows

  if (-not [bool]$Payload.gitCleanAfter) {
    return Complete-AdmissionEvidence $evidence "fail" "git_dirty_after" 40
  }
  if (-not [bool]$Payload.acShadowsAbsentWindow1End -or -not [bool]$Payload.acShadowsAbsentWindow2End -or -not [bool]$Payload.acShadowsAbsentAfter) {
    return Complete-AdmissionEvidence $evidence "fail" "acshadows_present_during_or_after" 40
  }
  if (-not [string]::Equals([string]$Payload.actualCommitBefore, [string]$Payload.actualCommitAfter, [StringComparison]::OrdinalIgnoreCase)) {
    return Complete-AdmissionEvidence $evidence "fail" "commit_changed_after" 40
  }
  if (Test-ThresholdsExceeded $windows) {
    return Complete-AdmissionEvidence $evidence "fail" "threshold_exceeded" 30
  }

  return Complete-AdmissionEvidence $evidence "pass" "admission_passed" 0
}

function Invoke-MeasuredAdmission {
  param([object[]]$Tokens)

  $evidence = New-AdmissionEvidence -EvidenceKind "measured"
  if ($PSVersionTable.PSVersion.Major -lt 5) {
    return Complete-AdmissionEvidence $evidence "fail" "runtime_incompatible" 2
  }

  $parsed = Parse-AdmissionArguments $Tokens
  if (-not $parsed.ok) {
    return Complete-AdmissionEvidence $evidence "fail" "invalid_invocation" 2 $parsed.reason
  }

  $evidence.facts.repositoryRoot = $parsed.repositoryRoot
  $evidence.facts.expectedCommit = $parsed.expectedCommit
  $evidence.facts.noConcurrentBenchmarkConfirmed = [bool]$parsed.noConcurrentBenchmarkConfirmed

  if (-not $evidence.facts.noConcurrentBenchmarkConfirmed) {
    return Complete-AdmissionEvidence $evidence "fail" "benchmark_confirmation_missing" 10
  }

  $before = Get-GitFacts $parsed.repositoryRoot
  if (-not $before.ok) {
    return Complete-AdmissionEvidence $evidence "fail" "repository_precondition_failed" 10 $before.reason
  }
  $evidence.facts.repositoryRoot = $before.repositoryRoot
  $evidence.facts.actualCommitBefore = $before.commit
  $evidence.facts.gitCleanBefore = [bool]$before.clean
  $evidence.exactCommit = $before.commit

  if (-not $before.clean) {
    return Complete-AdmissionEvidence $evidence "fail" "git_dirty_before" 10
  }
  if (-not [string]::Equals($parsed.expectedCommit, $before.commit, [StringComparison]::OrdinalIgnoreCase)) {
    return Complete-AdmissionEvidence $evidence "fail" "commit_mismatch" 10
  }
  $evidence.facts.acShadowsAbsentBefore = Test-AcShadowsAbsent
  if (-not $evidence.facts.acShadowsAbsentBefore) {
    return Complete-AdmissionEvidence $evidence "fail" "acshadows_present_before" 10
  }

  $logicalProcessorCount = [Environment]::ProcessorCount
  $evidence.logicalProcessorCount = $logicalProcessorCount
  if ($logicalProcessorCount -le 0) {
    return Complete-AdmissionEvidence $evidence "fail" "logical_processor_count_invalid" 20
  }

  $window1 = Measure-CpuWindow -WindowIndex 1 -LogicalProcessorCount $logicalProcessorCount
  $window2 = Measure-CpuWindow -WindowIndex 2 -LogicalProcessorCount $logicalProcessorCount
  $windows = @($window1, $window2)
  $shape = Test-WindowShape -Windows $windows -LogicalProcessorCount $logicalProcessorCount
  if (-not $shape.ok) {
    return Complete-AdmissionEvidence $evidence "fail" "evidence_shape_invalid" 20 $shape.reason
  }
  Set-ValidatedWindows -Evidence $evidence -Windows $windows
  $evidence.facts.acShadowsAbsentWindow1End = [bool]$window1.acShadowsAbsentAtEnd
  $evidence.facts.acShadowsAbsentWindow2End = [bool]$window2.acShadowsAbsentAtEnd

  $after = Get-GitFacts $before.repositoryRoot
  if (-not $after.ok) {
    return Complete-AdmissionEvidence $evidence "fail" "repository_postcondition_failed" 40 $after.reason
  }
  $evidence.facts.actualCommitAfter = $after.commit
  $evidence.facts.gitCleanAfter = [bool]$after.clean
  $evidence.facts.acShadowsAbsentAfter = Test-AcShadowsAbsent

  if (-not $after.clean) {
    return Complete-AdmissionEvidence $evidence "fail" "git_dirty_after" 40
  }
  if (-not [string]::Equals($before.commit, $after.commit, [StringComparison]::OrdinalIgnoreCase)) {
    return Complete-AdmissionEvidence $evidence "fail" "commit_changed_after" 40
  }
  if (-not $window1.acShadowsAbsentAtStart -or -not $window1.acShadowsAbsentAtEnd -or -not $window2.acShadowsAbsentAtStart -or -not $window2.acShadowsAbsentAtEnd -or -not $evidence.facts.acShadowsAbsentAfter) {
    return Complete-AdmissionEvidence $evidence "fail" "acshadows_present_during_or_after" 40
  }
  if (Test-ThresholdsExceeded $windows) {
    return Complete-AdmissionEvidence $evidence "fail" "threshold_exceeded" 30
  }

  return Complete-AdmissionEvidence $evidence "pass" "admission_passed" 0
}

function Invoke-AdmissionEntrypoint {
  param([object[]]$Tokens)

  if ([Environment]::GetEnvironmentVariable($script:SelfTestModeVariable) -eq "1") {
    $encoded = [Environment]::GetEnvironmentVariable($script:SelfTestPayloadVariable)
    if ([string]::IsNullOrWhiteSpace($encoded)) {
      return Invoke-SyntheticAdmission $null
    }
    $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded))
    $payload = $json | ConvertFrom-Json
    return Invoke-SyntheticAdmission $payload
  }

  return Invoke-MeasuredAdmission $Tokens
}

$finalEvidence = $null
$finalExitCode = 70
try {
  $finalEvidence = Invoke-AdmissionEntrypoint -Tokens @($args)
  if ($null -eq $finalEvidence -or $finalEvidence -is [System.Array] -or -not (Test-HasProperty $finalEvidence "exitCode")) {
    throw "entrypoint_result_invalid"
  }
  $finalExitCode = [int]$finalEvidence.exitCode
} catch {
  $finalEvidence = New-AdmissionEvidence -EvidenceKind $(if ([Environment]::GetEnvironmentVariable($script:SelfTestModeVariable) -eq "1") { "synthetic" } else { "measured" })
  $finalEvidence = Complete-AdmissionEvidence $finalEvidence "fail" "unexpected_exception" 70 $_.Exception.GetType().FullName
  $finalExitCode = 70
}

try {
  $jsonLine = $finalEvidence | ConvertTo-Json -Depth 10 -Compress
  if ([string]::IsNullOrWhiteSpace($jsonLine) -or $jsonLine.Contains("`r") -or $jsonLine.Contains("`n")) {
    throw "json_not_single_line"
  }
} catch {
  $jsonLine = '{"schemaVersion":1,"evidenceKind":"measured","status":"fail","reasonCode":"unexpected_exception","reasonDetail":"json_serialization_failed","exitCode":70}'
  $finalExitCode = 70
}

[Console]::Out.WriteLine($jsonLine)
exit $finalExitCode
