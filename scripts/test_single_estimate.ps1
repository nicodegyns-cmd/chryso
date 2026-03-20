param(
  [int]$garde_hours=0,
  [int]$sortie_hours=0,
  [int]$overtime_hours=0,
  [int]$hours_actual=0,
  [string]$pay_type='Permanence',
  [int]$analytic_id=1,
  [string]$email='testuser@gmail.com'
)
$base='http://localhost:3000'
$body = @{ garde_hours=$garde_hours; sortie_hours=$sortie_hours; overtime_hours=$overtime_hours; hours_actual=$hours_actual; pay_type=$pay_type; analytic_id=$analytic_id; user_email=$email } | ConvertTo-Json
Write-Host "Posting: $body"
try{
  $r = Invoke-RestMethod -Uri "$base/api/prestations/estimate" -Method Post -Body $body -ContentType 'application/json'
  Write-Host "Response:`n" ($r | ConvertTo-Json -Depth 5)
}catch{
  Write-Host 'Failed:' $_.Exception.Message
  if ($_.Exception.Response) { $stream = $_.Exception.Response.GetResponseStream(); $sr = New-Object System.IO.StreamReader($stream); Write-Host 'Body:' $sr.ReadToEnd() }
}
