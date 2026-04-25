$r = Invoke-RestMethod -Uri "http://localhost:8000/api/forecast/lane_000?horizon=8" -Method GET
Write-Host "model_used: $($r.model_used)"
Write-Host "is_tft_fallback: $($r.is_tft_fallback)"
Write-Host "historical points: $($r.historical.Count)"
Write-Host "forecast points: $($r.forecast.Count)"
if ($r.forecast.Count -gt 0) {
    $f = $r.forecast[0]
    Write-Host "First forecast: date=$($f.date) q50=$($f.q50) q10=$($f.q10) q90=$($f.q90)"
}
