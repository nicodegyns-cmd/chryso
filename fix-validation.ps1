$path = "components/UserValidation.jsx"
$lines = Get-Content $path
$changed = 0
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "!u\.never_connected && u\.onboarding_status === 'pending_validation'") {
        $lines[$i] = "    !u.never_connected && u.onboarding_status === 'pending_validation' && !!u.telephone"
        $changed++
        Write-Host "Line $($i+1) updated [pending]"
    }
    if ($lines[$i] -match "u\.never_connected \|\| u\.onboarding_status === 'pending_signup'") {
        $lines[$i] = "    u.never_connected || u.onboarding_status === 'pending_signup' || (u.onboarding_status === 'pending_validation' && !u.telephone)"
        $changed++
        Write-Host "Line $($i+1) updated [invited]"
    }
}
$lines | Set-Content $path
Write-Host "Done. $changed lines changed."
