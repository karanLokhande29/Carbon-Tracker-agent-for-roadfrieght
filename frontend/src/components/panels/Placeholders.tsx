import { MapPin, TrendingUp, Truck, BrainCircuit, Settings2 } from 'lucide-react'

export function MapPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
      <MapPin className="w-12 h-12" />
      <p className="text-sm font-medium">India Lane Map</p>
      <p className="text-xs">D3 interactive visualization — Phase 4</p>
    </div>
  )
}

export function ForecastPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
      <TrendingUp className="w-12 h-12" />
      <p className="text-sm font-medium">TFT Forecast</p>
      <p className="text-xs">Quantile forecast chart — Phase 5</p>
    </div>
  )
}

export function FleetPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
      <Truck className="w-12 h-12" />
      <p className="text-sm font-medium">Fleet Planner</p>
      <p className="text-xs">Multi-lane fleet analysis — Phase 6</p>
    </div>
  )
}

export function ExplainabilityPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
      <BrainCircuit className="w-12 h-12" />
      <p className="text-sm font-medium">SHAP Explainability</p>
      <p className="text-xs">Attribution waterfall — Phase 6</p>
    </div>
  )
}

export function AdvancedPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-3">
      <Settings2 className="w-12 h-12" />
      <p className="text-sm font-medium">Advanced Analytics</p>
      <p className="text-xs">UMAP · anomalies · model metrics — Phase 7</p>
    </div>
  )
}
