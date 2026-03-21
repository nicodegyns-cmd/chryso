@echo off
cd /d C:\xampp\htdocs\chryso
(
echo === GIT STATUS ===
git --no-pager status
echo.
echo === GIT LOG ===
git --no-pager log --oneline -n 5
echo.
echo === GIT PUSH ===
git --no-pager push origin main --force-with-lease
) > C:\xampp\htdocs\chryso\git_output.txt 2>&1
type C:\xampp\htdocs\chryso\git_output.txt
pause
