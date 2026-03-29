# Deployment script for activities.js
$host = "sirona-consult.be"
$user = "ubuntu"
$remoteDir = "/home/ubuntu/chryso"

Write-Host "📦 Deploying activities.js to $host..." -ForegroundColor Cyan

# Step 1: Copy the file
Write-Host "`n1️⃣  Copying activities.js..." -ForegroundColor Yellow
$file = "c:\xampp\htdocs\chryso\pages\api\activities.js"

if (-not (Test-Path $file)) {
    Write-Host "❌ File not found: $file" -ForegroundColor Red
    exit 1
}

# Using SCP
Write-Host "   Using SCP..." -ForegroundColor Gray
scp -o StrictHostKeyChecking=accept-new -o ConnectTimeout=5 "$file" "${user}@${host}:${remoteDir}/pages/api/activities.js" 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SCP failed. Trying alternative method..." -ForegroundColor Red
    
    # Try using a heredoc approach with PowerShell
    Write-Host "   Trying SSH with heredoc..." -ForegroundColor Gray
    $content = Get-Content $file -Raw
    
    # Escape content for shell
    $escapedContent = $content -replace "'", "'\"'\"'"
    
    ssh -o StrictHostKeyChecking=accept-new "${user}@${host}" @"
cat > ${remoteDir}/pages/api/activities.js << 'EOFJS'
$content
EOFJS
"@
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ SSH heredoc failed too" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ File copied successfully" -ForegroundColor Green

# Step 2: Build and restart
Write-Host "`n2️⃣  Building and restarting..." -ForegroundColor Yellow
ssh -o StrictHostKeyChecking=accept-new "${user}@${host}" @"
cd ${remoteDir}
npm run build
pm2 restart chryso
sleep 3
pm2 logs chryso --lines 50 | grep -E "(activities|error|ERROR)" || echo "No error logs"
"@

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Deployment complete!" -ForegroundColor Green
    Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Refresh your browser" -ForegroundColor Gray
    Write-Host "   2. Check that activites now show DATE, TYPE, ANALYTIQUE" -ForegroundColor Gray
    Write-Host "   3. Click 'Déclarer heures' to test" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Deployment finished with warnings" -ForegroundColor Yellow
}
