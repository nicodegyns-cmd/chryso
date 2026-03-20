param([string]$email='testuser@gmail.com')
$base='http://localhost:3000'
$body = @{ garde_hours=5; sortie_hours=5; overtime_hours=2; hours_actual=0; pay_type='Garde'; analytic_id=1; user_email=$email } | ConvertTo-Json
Write-Host "Posting to $base/api/prestations/estimate with body:" $body
try{
  $r = Invoke-WebRequest -Uri "$base/api/prestations/estimate" -Method Post -Body $body -ContentType 'application/json' -UseBasicParsing
  Write-Host 'Status:' $r.StatusCode
  Write-Host 'Body:' $r.Content
}catch{
  Write-Host 'Request failed'
  if ($_.Exception.Response){
    try{
      $resp = $_.Exception.Response
      $stream = $resp.GetResponseStream()
      $sr = New-Object System.IO.StreamReader($stream)
      $text = $sr.ReadToEnd()
      Write-Host 'Response body:'
      Write-Host $text
    }catch{
      Write-Host 'Could not read response body'
    }
  } else {
    Write-Host $_
  }
}
