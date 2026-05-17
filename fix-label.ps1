$path = "components/UserValidation.jsx"
$lines = Get-Content $path
for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "Pas encore connect") {
        $lines[$i] = "                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: '#f3f4f6', color: '#6b7280' }}>{user.telephone ? 'Pas encore connect\u00e9' : (user.onboarding_status === 'pending_validation' ? 'Onboarding incomplet' : 'Pas encore connect\u00e9')}</span>"
        Write-Host "Line $($i+1) updated [label]"
    }
}
$lines | Set-Content $path
Write-Host "Done."
