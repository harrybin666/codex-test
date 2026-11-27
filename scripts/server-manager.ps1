param(
    [ValidateSet('Install', 'Start', 'Stop', 'Status', 'Uninstall', 'Watch')]
    [string]$Action = 'Status',
    [string]$NodePath
)

$ErrorActionPreference = 'Stop'
$projectDir = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$scriptFile = Join-Path $PSScriptRoot 'server-manager.ps1'
$viteFile = Join-Path $projectDir 'node_modules\vite\bin\vite.js'
$runtimeDir = Join-Path $projectDir '.server'
$configFile = Join-Path $runtimeDir 'config.json'
$stateFile = Join-Path $runtimeDir 'state.json'
$stopFile = Join-Path $runtimeDir 'stopped'
$logFile = Join-Path $runtimeDir 'supervisor.log'
$port = 5173
$windowsPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $projectId = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($projectDir.ToLowerInvariant())))).Replace('-', '').Substring(0, 12)
} finally { $sha.Dispose() }
$taskName = "MiaomiaoWageServer-$projectId"
$mutexName = "Local\MiaomiaoWageServer-$projectId"
$startupFile = Join-Path ([Environment]::GetFolderPath('Startup')) "$taskName.lnk"
$watchArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -Action Watch' -f $scriptFile

function Ensure-Runtime {
    New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null
}

function Write-ServerLog([string]$Message) {
    # Bound the lifecycle log; child stdout/stderr are separate per restart.
    if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 1MB) {
        Move-Item -LiteralPath $logFile -Destination "$logFile.previous" -Force
    }
    Add-Content -LiteralPath $logFile -Value ('{0} {1}' -f (Get-Date -Format o), $Message) -Encoding UTF8
}

function Get-WatchProcesses {
    @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
        $_.CommandLine -and $_.CommandLine.Contains($scriptFile) -and $_.CommandLine -match '-Action\s+Watch\b'
    })
}

function Get-ProjectServer([int]$ProcessId) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
    if ($processInfo -and $processInfo.Name -eq 'node.exe' -and $processInfo.CommandLine -and $processInfo.CommandLine.Contains($viteFile)) {
        return $processInfo
    }
    return $null
}

function Get-Listener {
    @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Save-State([int]$ServerId, [string]$Phase) {
    $state = [ordered]@{
        watchdogPid = $PID
        serverPid = $ServerId
        phase = $Phase
        checkedAt = (Get-Date -Format o)
        port = $port
    }
    $temporaryFile = "$stateFile.$PID.tmp"
    $state | ConvertTo-Json | Set-Content -LiteralPath $temporaryFile -Encoding UTF8
    Move-Item -LiteralPath $temporaryFile -Destination $stateFile -Force
}

function Start-Watch {
    Ensure-Runtime
    if (Test-Path -LiteralPath $stopFile) { Remove-Item -LiteralPath $stopFile }
    $watchers = @(Get-WatchProcesses)
    if ($watchers.Count -gt 0) {
        Write-Output "Watchdog already running: $($watchers[0].ProcessId)"
        return
    }
    # Let the user's desktop shell launch the hidden process. Verify a fresh
    # heartbeat rather than reporting success merely because launch returned.
    $startedAt = Get-Date
    $desktopShell = New-Object -ComObject Shell.Application
    $desktopShell.ShellExecute($windowsPowerShell, $watchArguments, $projectDir, 'open', 0)
    for ($attempt = 0; $attempt -lt 15; $attempt++) {
        Start-Sleep -Milliseconds 500
        $watchers = @(Get-WatchProcesses)
        if ($watchers.Count -gt 0 -and (Test-Path -LiteralPath $stateFile)) {
            try {
                $currentState = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
                if ($currentState.watchdogPid -in $watchers.ProcessId -and [DateTimeOffset]::Parse($currentState.checkedAt).LocalDateTime -ge $startedAt) {
                    Write-Output "Watchdog started: $($currentState.watchdogPid)"
                    return
                }
            } catch { # A startup heartbeat may not be available yet.
            }
        }
    }
    throw "Watchdog did not produce a startup heartbeat. See $logFile"
}

function Stop-Watch {
    Ensure-Runtime
    Set-Content -LiteralPath $stopFile -Value 'Stopped by server-manager' -Encoding UTF8
    # Verify the full script path before ending a watchdog, and the Vite path
    # before ending a server. Never kill all node.exe or powershell.exe processes.
    foreach ($watcher in @(Get-WatchProcesses)) {
        Stop-Process -Id $watcher.ProcessId -ErrorAction SilentlyContinue
    }
    foreach ($listener in @(Get-Listener)) {
        $owned = Get-ProjectServer -ProcessId $listener.OwningProcess
        if ($owned) { Stop-Process -Id $owned.ProcessId -ErrorAction SilentlyContinue }
    }
    if (Test-Path -LiteralPath $stateFile) {
        try {
            $oldState = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
            if ($oldState.serverPid) {
                $owned = Get-ProjectServer -ProcessId $oldState.serverPid
                if ($owned) { Stop-Process -Id $owned.ProcessId -ErrorAction SilentlyContinue }
            }
        } catch { Write-Warning $_.Exception.Message }
    }
    Write-Output 'Server stopped. Automatic starts remain paused until Start or Install.'
}

function Show-Status {
    $watchers = @(Get-WatchProcesses)
    $listeners = @(Get-Listener)
    $ownListeners = @($listeners | Where-Object { Get-ProjectServer -ProcessId $_.OwningProcess })
    $mode = 'none'
    try { if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { $mode = 'scheduled-task' } } catch {}
    if ($mode -eq 'none' -and (Test-Path -LiteralPath $startupFile)) { $mode = 'startup-shortcut' }
    [pscustomobject]@{
        WatchdogRunning = ($watchers.Count -gt 0)
        ServerRunning = ($ownListeners.Count -gt 0)
        ServerPids = ($ownListeners.OwningProcess -join ',')
        Paused = (Test-Path -LiteralPath $stopFile)
        AutoStart = $mode
        Url = "http://127.0.0.1:$port/"
        Log = $logFile
    } | Format-List
}

switch ($Action) {
    'Install' {
        Ensure-Runtime
        if (-not $NodePath) { $NodePath = (Get-Command node -ErrorAction Stop).Source }
        $NodePath = [IO.Path]::GetFullPath($NodePath)
        if (-not (Test-Path -LiteralPath $NodePath -PathType Leaf)) { throw "Node does not exist: $NodePath" }
        if (-not (Test-Path -LiteralPath $viteFile -PathType Leaf)) { throw 'Vite is missing. No dependencies have been installed.' }
        $conflicts = @(Get-Listener | Where-Object { -not (Get-ProjectServer -ProcessId $_.OwningProcess) })
        if ($conflicts.Count -gt 0) { throw "Port $port belongs to another program. Nothing has been terminated." }
        @{ nodePath = $NodePath; port = $port } | ConvertTo-Json | Set-Content -LiteralPath $configFile -Encoding UTF8
        $scheduled = $false
        try {
            $identity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
            $taskAction = New-ScheduledTaskAction -Execute $windowsPowerShell -Argument $watchArguments -WorkingDirectory $projectDir
            $loginTrigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
            $minuteTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
            $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
            $principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
            Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger @($loginTrigger, $minuteTrigger) -Settings $settings -Principal $principal -Description 'Restart this project Vite server and restore the watchdog at login or every minute.' -Force | Out-Null
            $scheduled = $true
            if (Test-Path -LiteralPath $startupFile) { Remove-Item -LiteralPath $startupFile }
            Write-ServerLog 'Installed scheduled task (current user, no administrator or stored password).'
        } catch {
            Write-ServerLog "Scheduled task unavailable: $($_.Exception.Message)"
        }
        if (-not $scheduled) {
            # Current-user startup is the fallback when Task Scheduler ACLs deny
            # registration. It restores at login, not after killing the watchdog.
            $shell = New-Object -ComObject WScript.Shell
            $shortcut = $shell.CreateShortcut($startupFile)
            $shortcut.TargetPath = $windowsPowerShell
            $shortcut.Arguments = $watchArguments
            $shortcut.WorkingDirectory = $projectDir
            $shortcut.WindowStyle = 7
            $shortcut.Description = 'Keep the local Miaomiao wage webpage running.'
            $shortcut.Save()
            Write-ServerLog 'Installed current-user startup shortcut as fallback.'
            Write-Warning 'Task registration was unavailable. Login auto-start is installed; if the watchdog itself is terminated, run Start or log in again.'
        }
        Start-Watch
        Show-Status
    }
    'Start' {
        if (-not (Test-Path -LiteralPath $configFile)) { throw 'Run Install once before Start.' }
        Start-Watch
        Show-Status
    }
    'Stop' { Stop-Watch }
    'Status' { Show-Status }
    'Uninstall' {
        Stop-Watch
        try {
            if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
                Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
            }
        } catch { Write-Warning $_.Exception.Message }
        if (Test-Path -LiteralPath $startupFile) { Remove-Item -LiteralPath $startupFile }
        Write-Output 'Autostart removed. Project files and runtime logs are retained.'
    }
    'Watch' {
        Ensure-Runtime
        $mutex = New-Object Threading.Mutex($false, $mutexName)
        $ownsMutex = $false
        try {
            try { $ownsMutex = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
            if (-not $ownsMutex -or (Test-Path -LiteralPath $stopFile)) { return }
            $config = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
            if (-not (Test-Path -LiteralPath $config.nodePath -PathType Leaf)) { throw 'Configured Node executable is missing. Run Install with a valid NodePath.' }
            if (-not (Test-Path -LiteralPath $viteFile -PathType Leaf)) { throw 'Vite dependency is missing.' }
            $serverId = 0
            Write-ServerLog "Watchdog started pid=$PID; checking every 5 seconds."
            while (-not (Test-Path -LiteralPath $stopFile)) {
                try {
                $listeners = @(Get-Listener)
                $ownedListeners = @($listeners | Where-Object { Get-ProjectServer -ProcessId $_.OwningProcess })
                if ($ownedListeners.Count -gt 0) {
                    $foundId = [int]$ownedListeners[0].OwningProcess
                    if ($serverId -ne $foundId) { Write-ServerLog "Monitoring Vite pid=$foundId on port $port." }
                    $serverId = $foundId
                    Save-State -ServerId $serverId -Phase 'listening'
                } elseif ($listeners.Count -gt 0) {
                    Write-ServerLog "Port $port is owned by another program; waiting without terminating it."
                    Save-State -ServerId 0 -Phase 'port-in-use'
                } elseif ($serverId -and (Get-ProjectServer -ProcessId $serverId)) {
                    # A live process can take time to bind. Do not spawn a second
                    # copy merely because startup is slower than the poll interval.
                    Save-State -ServerId $serverId -Phase 'starting'
                } else {
                    if ($serverId) { Write-ServerLog "Vite pid=$serverId exited; restarting." }
                    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
                    # Retain at most 20 stdout/stderr log pairs in this folder.
                    Get-ChildItem -LiteralPath $runtimeDir -Filter 'vite-*.log' -File | Sort-Object LastWriteTime -Descending | Select-Object -Skip 38 | Remove-Item -Force
                    $child = Start-Process -FilePath $config.nodePath -ArgumentList @("`"$viteFile`"", '--host', '0.0.0.0', '--port', "$port", '--strictPort') -WorkingDirectory $projectDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimeDir "vite-$stamp.stdout.log") -RedirectStandardError (Join-Path $runtimeDir "vite-$stamp.stderr.log") -PassThru
                    $serverId = $child.Id
                    Write-ServerLog "Started Vite pid=$serverId."
                    Save-State -ServerId $serverId -Phase 'starting'
                }
                } catch {
                    # A temporary file lock or spawn error must not permanently
                    # end the watchdog. Retry on the next poll without a tight loop.
                    Write-ServerLog "Check failed; retrying: $($_.Exception.Message)"
                }
                Start-Sleep -Seconds 5
            }
            Write-ServerLog 'Watchdog stopped by pause marker.'
        } catch {
            Write-ServerLog "Watchdog error: $($_.Exception.Message)"
            throw
        } finally {
            if ($ownsMutex) { $mutex.ReleaseMutex() }
            $mutex.Dispose()
        }
    }
}
