/**
 * VehicleTile — selectable vehicle type card with icon, label, and emission badge.
 */
import { cn, vehicleTypeLabel, getEmissionColor, formatCO2e } from '@/lib/utils'
import { Truck, Package, Zap, Fuel } from 'lucide-react'
import type { VehicleType } from '@/types'

interface VehicleTileProps {
  vehicleType: VehicleType
  selected: boolean
  onClick: () => void
  avgCo2e?: number
}

const VEHICLE_ICONS: Record<VehicleType, React.ReactNode> = {
  road_articulated_diesel: <Truck className="w-5 h-5" />,
  road_rigid_diesel: <Truck className="w-4.5 h-4.5" />,
  road_lcv_diesel: <Package className="w-4.5 h-4.5" />,
  road_cng: <Fuel className="w-4.5 h-4.5" />,
  road_rigid_electric: <Zap className="w-4.5 h-4.5" />,
}

const VEHICLE_SHORT: Record<VehicleType, string> = {
  road_articulated_diesel: 'Articulated',
  road_rigid_diesel: 'Rigid',
  road_lcv_diesel: 'LCV',
  road_cng: 'CNG',
  road_rigid_electric: 'Electric',
}

export function VehicleTile({ vehicleType, selected, onClick, avgCo2e }: VehicleTileProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-1 px-2.5 py-2.5 rounded-lg border transition-all duration-150 cursor-pointer group',
        selected
          ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
          : 'bg-white/3 border-white/8 hover:bg-white/6 hover:border-white/15',
      )}
    >
      {/* Icon */}
      <span className={cn(
        'transition-colors',
        selected ? 'text-emerald-400' : 'text-white/40 group-hover:text-white/60',
      )}>
        {VEHICLE_ICONS[vehicleType]}
      </span>

      {/* Label */}
      <span className={cn(
        'text-[10px] font-medium leading-tight',
        selected ? 'text-emerald-300' : 'text-white/50',
      )}>
        {VEHICLE_SHORT[vehicleType]}
      </span>

      {/* Emission badge */}
      {avgCo2e != null && (
        <span
          className="absolute -top-1 -right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `${getEmissionColor(avgCo2e)}20`,
            color: getEmissionColor(avgCo2e),
          }}
        >
          {formatCO2e(avgCo2e)}
        </span>
      )}
    </button>
  )
}
