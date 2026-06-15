$ErrorActionPreference = "Stop"

# Appends the latest fb-discovery-YYYY-MM-DD.csv to the Communities workbook
# as a new "Facebook (Discovered)" sheet (or replaces it if it already exists).
# Run after discover-facebook.ts finishes.

$here          = Split-Path -Parent $MyInvocation.MyCommand.Definition
$resultsDir    = Join-Path $here "results"
$workbookPath  = "C:\Users\mikea\OneDrive\Desktop\CardCloud_Communities_Template.xlsx"

if (-not (Test-Path $workbookPath)) {
    throw "Communities workbook not found at: $workbookPath"
}

# Find the most recent passing-threshold CSV (excludes the -raw.csv variant)
$latest = Get-ChildItem -Path $resultsDir -Filter "fb-discovery-*.csv" |
          Where-Object { $_.Name -notmatch "-raw\.csv$" } |
          Sort-Object LastWriteTime -Descending |
          Select-Object -First 1

if (-not $latest) {
    throw "No fb-discovery-*.csv found in $resultsDir. Run the discovery script first: npm run discover:facebook"
}

Write-Host "Reading: $($latest.FullName)"
$rows = Import-Csv -Path $latest.FullName

if ($rows.Count -eq 0) {
    Write-Host "CSV is empty - nothing to write."
    exit 0
}

Write-Host "Loaded $($rows.Count) groups from CSV."

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

try {
    $wb = $excel.Workbooks.Open($workbookPath)

    # Remove existing "Facebook (Discovered)" sheet if present
    foreach ($s in $wb.Worksheets) {
        if ($s.Name -eq "Facebook (Discovered)") {
            $s.Delete()
            break
        }
    }

    # Add new sheet at the end
    $missing = [System.Reflection.Missing]::Value
    $last    = $wb.Worksheets.Item($wb.Worksheets.Count)
    $sheet   = $wb.Worksheets.Add($missing, $last, $missing, $missing)
    $sheet.Name = "Facebook (Discovered)"

    # Title
    $sheet.Cells.Item(1,1).Value2 = "Facebook Groups - Auto-discovered ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
    $sheet.Cells.Item(1,1).Font.Bold = $true
    $sheet.Cells.Item(1,1).Font.Size = 14
    $sheet.Range($sheet.Cells.Item(1,1), $sheet.Cells.Item(1,7)).Merge() | Out-Null

    # Instructions
    $sheet.Cells.Item(2,1).Value2 = "Review the rows below. Copy approved entries into the main Facebook tab. Sorted by score (members + activity bonus) descending."
    $sheet.Cells.Item(2,1).Font.Italic = $true
    $sheet.Cells.Item(2,1).Font.Color = 6710886
    $sheet.Range($sheet.Cells.Item(2,1), $sheet.Cells.Item(2,7)).Merge() | Out-Null
    $sheet.Rows.Item(2).RowHeight = 32
    $sheet.Cells.Item(2,1).WrapText = $true

    # Headers (row 4)
    $headers = @("Score", "Group Name", "Members", "Activity", "Privacy", "URL", "Description")
    for ($i = 0; $i -lt $headers.Count; $i++) {
        $c = $sheet.Cells.Item(4, $i+1)
        $c.Value2 = $headers[$i]
        $c.Font.Bold = $true
        $c.Interior.Color = 15986394
    }

    # Data rows starting at row 5
    $row = 5
    foreach ($r in $rows) {
        $sheet.Cells.Item($row, 1).Value2 = [int]$r.score
        $sheet.Cells.Item($row, 2).Value2 = $r.name
        $sheet.Cells.Item($row, 3).Value2 = [int]$r.members
        $sheet.Cells.Item($row, 4).Value2 = $r.activity
        $sheet.Cells.Item($row, 5).Value2 = $r.privacy
        $sheet.Cells.Item($row, 6).Value2 = $r.url
        $sheet.Cells.Item($row, 7).Value2 = $r.description
        $row++
    }

    # Freeze top 4 rows + auto-fit
    $sheet.Activate()
    $excel.ActiveWindow.SplitRow = 4
    $excel.ActiveWindow.FreezePanes = $true
    $sheet.Columns.AutoFit() | Out-Null
    for ($i = 1; $i -le 7; $i++) {
        $col = $sheet.Columns.Item($i)
        if ($col.ColumnWidth -lt 12) { $col.ColumnWidth = 12 }
        if ($col.ColumnWidth -gt 60) { $col.ColumnWidth = 60 }
    }

    $wb.Save()
    $wb.Close()
    Write-Host "Wrote $($rows.Count) rows to 'Facebook (Discovered)' sheet in the workbook."
}
finally {
    $excel.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Host "Done."
