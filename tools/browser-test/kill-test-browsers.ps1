# Closes every hidden (headless) test Edge left by this project's browser tests, and nothing else.
# Your own Edge is never touched: a test Edge always runs with --headless AND a profile folder that is
# either a cdp.mjs one (schmoll-edge-...) or inside Claude's temp folder (the old test scripts).
#   powershell -NoProfile -File tools/browser-test/kill-test-browsers.ps1          # close them
#   powershell -NoProfile -File tools/browser-test/kill-test-browsers.ps1 -List    # only list them
param([switch]$List)

function IsTestEdge([string]$cmd) {
    if (-not $cmd) { return $false }
    $c = $cmd.Replace('/', '\').ToLower()
    return $c.Contains('--headless') -and ($c.Contains('schmoll-edge-') -or $c.Contains('\temp\claude\'))
}

$all = @(Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" -ErrorAction SilentlyContinue)
$tests = @($all | Where-Object { IsTestEdge $_.CommandLine })
# helper processes of a test Edge (they don't all repeat --headless on their command line)
$ids = @($tests | ForEach-Object { $_.ProcessId })
$helpers = @($all | Where-Object { $ids -contains $_.ParentProcessId -and -not ($ids -contains $_.ProcessId) })
$browsers = @($tests | Where-Object { $_.CommandLine -notmatch '--type=' })

if ($tests.Count -eq 0) {
    "No test browsers running."
} elseif ($List) {
    "{0} test browser(s), {1} processes in all:" -f $browsers.Count, ($tests.Count + $helpers.Count)
    $browsers | ForEach-Object { "  PID {0}" -f $_.ProcessId }
} else {
    foreach ($b in $browsers) { & taskkill.exe /PID $b.ProcessId /T /F *> $null }
    foreach ($p in $tests + $helpers) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    "Closed {0} test browser(s) ({1} processes)." -f $browsers.Count, ($tests.Count + $helpers.Count)
}

# a lock and profile folders left by a test that died (only when no test is running)
$lock = Join-Path $env:TEMP 'schmoll-edge.lock'
$owner = $null
if (Test-Path -LiteralPath $lock) { $owner = Get-Content -LiteralPath $lock -ErrorAction SilentlyContinue | Select-Object -First 1 }
$testRunning = $owner -and (Get-Process -Id $owner -ErrorAction SilentlyContinue)
$old = @(Get-ChildItem -LiteralPath $env:TEMP -Filter 'schmoll-edge-*' -Directory -ErrorAction SilentlyContinue)
if ($List) {
    if ($old.Count) { "{0} test profile folder(s) in Temp." -f $old.Count }
} elseif (-not $testRunning) {
    if (Test-Path -LiteralPath $lock) { Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue; "Removed a stale lock." }
    foreach ($d in $old) { Remove-Item -LiteralPath $d.FullName -Recurse -Force -ErrorAction SilentlyContinue }
    if ($old.Count) { "Removed {0} old test profile folder(s)." -f $old.Count }
}
