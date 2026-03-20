param([string]$email = 'testuser@gmail.com')
$base = 'http://localhost:3000'
Write-Host "Using email: $email"
try{
  $prest = Invoke-RestMethod "$base/api/prestations?email=$([uri]::EscapeDataString($email))"
}catch{
  Write-Error "Failed to fetch prestations: $_"
  exit 1
}
$prestations = $prest.prestations
Write-Host "Prestations returned: $($prestations.Count)"
$aggregate = 0
foreach($p in $prestations){
  if (-not $p.invoice_number) { continue }
  $body = @{ 
    garde_hours = ($p.garde_hours -as [double]) -or 0
    sortie_hours = ($p.sortie_hours -as [double]) -or 0
    overtime_hours = ($p.overtime_hours -as [double]) -or 0
    hours_actual = ($p.hours_actual -as [double]) -or 0
    pay_type = $p.pay_type -or ''
    analytic_id = $p.analytic_id -as [int]
    expense_amount = ($p.expense_amount -as [double]) -or 0
    user_email = $email
  } | ConvertTo-Json
  try{
    $est = Invoke-RestMethod -Uri "$base/api/prestations/estimate" -Method Post -Body $body -ContentType 'application/json'
    $et = [decimal]($est.estimated_total -as [double] -or 0)
    Write-Host "ID $($p.id) $($p.request_ref -or $p.invoice_number) -> $([string]::Format('{0:N2}', $et)) EUR (infi:$($est.estimated_infi) med:$($est.estimated_med) expense:$($p.expense_amount -as [double]))"
    $aggregate += $et
  }catch{
    Write-Warning "Estimate failed for $($p.id): $_"
  }
  Start-Sleep -Milliseconds 200
}
Write-Host "Aggregate estimated total for invoices: $([string]::Format('{0:N2}',$aggregate)) EUR"