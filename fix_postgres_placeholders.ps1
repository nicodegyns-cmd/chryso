#!/usr/bin/env pwsh
# Fix PostgreSQL placeholders in all API files
# Changes MySQL placeholders (?) to PostgreSQL placeholders ($1, $2, etc)

$apiFiles = @(
    'pages/api/prestations.js',
    'pages/api/admin/users.js',
    'pages/api/admin/analytics/[id].js',
    'pages/api/admin/activities/[id].js',
    'pages/api/admin/activities/[id]/send.js',
    'pages/api/prestations/estimate.js',
    'pages/api/prestations/generate_invoice_number.js',
    'pages/api/admin/prestations/[id].js'
)

function Fix-PostgreSQLPlaceholders {
    param([string]$filePath)
    
    if (-not (Test-Path $filePath)) {
        Write-Host "⚠️  File not found: $filePath" -ForegroundColor Yellow
        return
    }
    
    $content = Get-Content -Path $filePath -Raw
    $originalContent = $content
    
    # Replace pool.execute with pool.query
    $content = $content -replace 'pool\.execute\(', 'pool.query('
    
    # Count the number of replacements needed
    $lines = $content -split "`n"
    $fileModified = $false
    
    foreach ($i in 0..($lines.Count - 1)) {
        $line = $lines[$i]
        
        # Only process lines with SQL queries
        if ($line -match "(INSERT|SELECT|UPDATE|DELETE|WHERE|VALUES)" -and $line -match '\?') {
            $matches = [regex]::Matches($line, '\?')
            $newLine = $line
            
            for ($j = $matches.Count; $j -ge 1; $j--) {
                $newLine = $newLine -replace '\?', "`$$j", 1
            }
            
            if ($newLine -ne $line) {
                $lines[$i] = $newLine
                $fileModified = $true
            }
        }
    }
    
    if ($fileModified -or $content -ne $originalContent) {
        $newContent = $lines -join "`n"
        Set-Content -Path $filePath -Value $newContent -NoNewline
        Write-Host "✅ Modified: $filePath" -ForegroundColor Green
        return $true
    } else {
        Write-Host "⏭️  No changes needed: $filePath" -ForegroundColor Gray
        return $false
    }
}

Write-Host "Fixing PostgreSQL placeholders in API files..." -ForegroundColor Cyan
Write-Host ""

$modifiedCount = 0
foreach ($file in $apiFiles) {
    $fullPath = Join-Path $PSScriptRoot $file
    if (Fix-PostgreSQLPlaceholders $fullPath) {
        $modifiedCount++
    }
}

Write-Host ""
Write-Host "Summary: Modified $modifiedCount files" -ForegroundColor Cyan
