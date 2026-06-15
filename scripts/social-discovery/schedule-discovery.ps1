# Schedules a weekly Facebook discovery run via Windows Task Scheduler.
#
# Run as Administrator the first time, then forget about it. To disable
# later, open Task Scheduler and disable "Card Cloud - FB Group Discovery".
#
# The task runs in HEADED mode (visible browser window) — picks a time when
# you're not actively using the computer. Adjust -StartHour below if you
# want a different time of day.
#
# Usage (PowerShell as Administrator):
#   .\scripts\social-discovery\schedule-discovery.ps1 -StartHour 3  # 3 AM weekly

param(
    [int]$StartHour = 3,
    [string]$DayOfWeek = "SUNDAY"
)

$ErrorActionPreference = "Stop"

$projectRoot = (Get-Item (Join-Path $PSScriptRoot "..\..")).FullName
$discoverCmd = "cd `"$projectRoot`" && npm run discover:facebook:full"

# We use cmd.exe as the actual program so chaining works on all Windows hosts
$action  = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c $discoverCmd"
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $DayOfWeek -At ([DateTime]::Today.AddHours($StartHour))
$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RunOnlyIfNetworkAvailable

$taskName = "Card Cloud - FB Group Discovery"

# Remove existing task if any
Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Weekly Facebook group discovery using Playwright. Runs in headed mode at $($StartHour):00 every $DayOfWeek. Output writes to scripts/social-discovery/results/ and appends to the Communities workbook."

Write-Host "Scheduled task '$taskName' created."
Write-Host "  Runs: every $DayOfWeek at $($StartHour):00"
Write-Host "  Command: $discoverCmd"
Write-Host ""
Write-Host "To run NOW manually for testing:"
Write-Host "  Start-ScheduledTask -TaskName '$taskName'"
Write-Host ""
Write-Host "To remove later:"
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
