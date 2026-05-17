$path = "components/UserValidation.jsx"
$lines = Get-Content $path
# Fix line 244 (index 243) - restore the banner text
$lines[243] = "              <strong>{invited.length} invitation{invited.length > 1 ? 's' : ''} envoy\u00e9e{invited.length > 1 ? 's' : ''}</strong> &mdash; Ces utilisateurs n&apos;ont pas encore termin\u00e9 leur inscription. Aucune action requise pour l&apos;instant."
$lines | Set-Content $path
Write-Host "Restored banner line 244"
