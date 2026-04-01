@echo off
REM Deploy eBrigade Code Mapping Restructuring to Production
REM This script: 1) Commits changes, 2) Pushes to GitHub, 3) Runs cleanup

setlocal enabledelayedexpansion

cd /d C:\xampp\htdocs\chryso

if errorlevel 1 (
    echo ❌ Failed to change directory to project root
    exit /b 1
)

echo.
echo ========================================
echo eBrigade Mapping Deployment
echo ========================================
echo.

REM Check git status
echo 📊 Current git status:
git status

echo.
echo Press any key to continue deployment to production...
pause

REM Add all changes
echo.
echo 📝 Staging all changes...
git add -A
if errorlevel 1 (
    echo ❌ Failed to stage changes
    exit /b 1
)

REM Commit if there are changes
git diff --cached --quiet
if errorlevel 1 (
    echo 📌 Committing changes...
    git commit -m "Deploy: eBrigade Code Mapping Restructuring"
    if errorlevel 1 (
        echo ❌ Commit failed
        exit /b 1
    )
) else (
    echo ℹ️  No new changes to commit
)

REM Push to GitHub
echo.
echo 🚀 Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo ❌ Push failed
    exit /b 1
)
echo ✅ Pushed successfully!

REM Run cleanup
echo.
echo 🧹 Running database cleanup...
node scripts/run-cleanup-mappings.js
if errorlevel 1 (
    echo ⚠️  Cleanup might have failed - check the output above
    echo.
    echo You can retry manually:
    echo   node scripts/run-cleanup-mappings.js
) else (
    echo ✅ Cleanup completed!
)

echo.
echo ========================================
echo ✨ Deployment phase 1 complete!
echo ========================================
echo.
echo Next steps:
echo   1. Deploy to production server: git pull ^& pm2 restart chryso
echo   2. Test with "Permanence INFI | 14h -21h" prestation
echo   3. Expected estimate: 281.75€ (not fallback)
echo.

pause
