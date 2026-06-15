# Schedules a weekly Facebook discovery run via Windows Task Scheduler.
#
# Run as Administrator the first time, then forget about it. To disable
# later, open Task Scheduler and disable "Card Cloud - FB Group Discovery".
#
# The task runs in HEADED mode (visible browser window). Default time is
# 6 PM, which matches normal FB usage hours — running at an odd time like
# 3 AM, especially with no prior history of FB activity at that hour, can
# look anomalous to FB's risk detection. Adjust -StartHour and -DayOfWeek
# below if you want a different cadence.
#
# Usage (PowerShell as Administrator):
#   .\scripts\social-discovery\schedule-discovery.ps1                       # 6 PM Sunday (default)
#   .\scripts\social-discovery\schedule-discovery.ps1 -StartHour 19         # 7 PM Sunday
#   .\scripts\social-discovery\schedule-discovery.ps1 -DayOfWeek WEDNESDAY  # 6 PM Wednesday

param(
    [int]$StartHour = 18,
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
