# Stops the game's local server (mvn spring-boot:run), including a copy left running by a closed
# terminal or an ended Claude session. spring-boot:run starts the server as a separate Java program,
# so stopping Maven alone can leave it running on port 8080.
#   powershell -NoProfile -File tools/stop-server.ps1          # stop it
#   powershell -NoProfile -File tools/stop-server.ps1 -List    # only show it
param([switch]$List)

$servers = @(Get-CimInstance Win32_Process -Filter "Name='java.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains('com.crossword.WebApp') })

if ($servers.Count -eq 0) { "The server isn't running."; exit 0 }
foreach ($s in $servers) {
    if ($List) { "Server running: PID {0} (parent {1})" -f $s.ProcessId, $s.ParentProcessId; continue }
    & taskkill.exe /PID $s.ProcessId /T /F *> $null
    "Stopped the server (PID {0})." -f $s.ProcessId
}
# Maven exits on its own once the server is gone.
