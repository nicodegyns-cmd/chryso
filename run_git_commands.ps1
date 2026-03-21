#!/usr/bin/env powershell

Set-Location C:\xampp\htdocs\chryso

# Fichier de sortie
$outputFile = "C:\xampp\htdocs\chryso\git_commands_output.txt"

# Créer le fichier de sortie
"=== GIT STATUS ===" | Out-File -FilePath $outputFile -Encoding utf8
git --no-pager status 2>&1 | Out-File -FilePath $outputFile -Encoding utf8 -Append

"`n`n=== GIT LOG (5 derniers commits) ===" | Out-File -FilePath $outputFile -Encoding utf8 -Append
git --no-pager log --oneline -n 5 2>&1 | Out-File -FilePath $outputFile -Encoding utf8 -Append

"`n`n=== ATTEMPTING GIT PUSH ===" | Out-File -FilePath $outputFile -Encoding utf8 -Append
git --no-pager push origin main --force-with-lease 2>&1 | Out-File -FilePath $outputFile -Encoding utf8 -Append

Write-Host "Résultats sauvegardés dans: $outputFile"
