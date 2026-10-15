# Watchdog for one headless test Edge (started by cdp.mjs; not meant to be run by hand).
# It checks every 2 seconds. When the test script is gone (even if it was killed outright, so its
# own cleanup never ran) or the time limit is up, it kills Edge's whole process tree.
# Once Edge is gone it deletes the test profile folder and exits. It never runs past the limit + 2 min.
param(
    [Parameter(Mandatory)][int]$ParentPid,
    [Parameter(Mandatory)][int]$EdgePid,
    [Parameter(Mandatory)][string]$ProfileDir,
    [string]$LockFile = "",
    [double]$MaxMinutes = 11
)

# Process IDs get reused, so remember when each process started and only trust a PID with that start time.
function StartOf([int]$id) {
    try { return (Get-Process -Id $id -ErrorAction Stop).StartTime } catch { return $null }
}
function IsSame([int]$id, $start) {
    if ($null -eq $start) { return $false }
    $now = StartOf $id
    return ($null -ne $now) -and ($now -eq $start)
}
# Safety: only ever touch folders made by cdp.mjs
if ((Split-Path $ProfileDir -Leaf) -notlike "schmoll-edge-*") { exit 1 }

$parentStart = StartOf $ParentPid
$edgeStart = StartOf $EdgePid
$deadline = (Get-Date).AddMinutes($MaxMinutes)
$hardStop = $deadline.AddMinutes(2)

function KillEdge {
    if (IsSame $EdgePid $edgeStart) { & taskkill.exe /PID $EdgePid /T /F *> $null }
    # anything still using this profile (a helper process whose parent already died)
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($ProfileDir) } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

while ((Get-Date) -lt $hardStop) {
    $edgeAlive = IsSame $EdgePid $edgeStart
    if (-not $edgeAlive) { break }
    $parentAlive = IsSame $ParentPid $parentStart
    if (-not $parentAlive -or (Get-Date) -gt $deadline) { KillEdge; break }
    Start-Sleep -Seconds 2
}
KillEdge
# Edge may hold its files for a moment after it's killed
for ($i = 0; $i -lt 10 -and (Test-Path -LiteralPath $ProfileDir); $i++) {
    Start-Sleep -Seconds 1
    Remove-Item -LiteralPath $ProfileDir -Recurse -Force -ErrorAction SilentlyContinue
}
if ($LockFile -and (Test-Path -LiteralPath $LockFile)) {
    $owner = (Get-Content -LiteralPath $LockFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($owner -eq "$ParentPid" -and -not (IsSame $ParentPid $parentStart)) {
        Remove-Item -LiteralPath $LockFile -Force -ErrorAction SilentlyContinue
    }
}
