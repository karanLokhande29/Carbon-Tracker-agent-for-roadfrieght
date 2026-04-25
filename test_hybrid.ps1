$body = @{
    lane_id = "lane_000"
    vehicle_type = "road_articulated_diesel"
    weight_tons = 16
    load_factor = 0.8
    traffic_index = 1.03
    weather_index = 1.0
    fuel_price_index = 1.01
    toll_cost_index = 1.35
    driver_efficiency_index = 0.94
    route_risk_index = 1.08
    month = 4
    week_of_year = 16
    model = "hybrid"
    include_shap = $false
} | ConvertTo-Json

$r = Invoke-RestMethod -Uri "http://localhost:8000/api/predict" -Method POST -Body $body -ContentType "application/json"
Write-Host "model_used: $($r.model_used)"
Write-Host "prediction_kg: $($r.prediction_kg)"
