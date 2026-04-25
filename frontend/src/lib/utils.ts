import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  Truck,
  Zap,
  Wind,
  Package,
  type LucideIcon,
} from 'lucide-react'
import type { ConfidenceLevel, ReliabilityLevel, VehicleType } from '@/types'

// ─── Class Merger ─────────────────────────────────────────────────────────────

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── CO₂e Formatters ─────────────────────────────────────────────────────────

export function formatCO2e(kg: number): string {
  if (kg >= 1_000_000) return `${(kg / 1_000_000).toFixed(1)} kt`
  if (kg >= 1_000) return `${(kg / 1_000).toFixed(1)} t`
  return `${Math.round(kg).toLocaleString('en-IN')} kg`
}

export function formatDelta(deltaKg: number, deltaPct: number): string {
  const sign = deltaKg <= 0 ? '−' : '+'
  const absKg = Math.abs(deltaKg)
  const absPct = Math.abs(deltaPct)
  return `${sign}${formatCO2e(absKg)} (${sign}${absPct.toFixed(1)}%)`
}

export function formatCurrency(inr: number): string {
  return `₹${Math.round(inr).toLocaleString('en-IN')}`
}

// ─── Color Utilities ──────────────────────────────────────────────────────────

/** Returns a hex color on the green→amber→red emission scale. */
export function getEmissionColor(kg: number): string {
  // Scale: 0–1500 green, 1500–4000 amber, 4000+ red
  if (kg < 1500) return '#22c55e'
  if (kg < 4000) {
    // lerp green→amber in 1500–4000
    const t = (kg - 1500) / 2500
    return lerpColor('#22c55e', '#f59e0b', t)
  }
  // lerp amber→red in 4000–8000
  const t = Math.min((kg - 4000) / 4000, 1)
  return lerpColor('#f59e0b', '#ef4444', t)
}

function lerpColor(hex1: string, hex2: string, t: number): string {
  const r1 = parseInt(hex1.slice(1, 3), 16)
  const g1 = parseInt(hex1.slice(3, 5), 16)
  const b1 = parseInt(hex1.slice(5, 7), 16)
  const r2 = parseInt(hex2.slice(1, 3), 16)
  const g2 = parseInt(hex2.slice(3, 5), 16)
  const b2 = parseInt(hex2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function getReliabilityColor(level: ReliabilityLevel): string {
  return { good: '#22c55e', medium: '#f59e0b', low: '#ef4444' }[level]
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  return { high: '#22c55e', medium: '#f59e0b', low: '#ef4444' }[level]
}

// ─── Vehicle Labels ───────────────────────────────────────────────────────────

export function vehicleTypeLabel(vt: VehicleType): string {
  const labels: Record<VehicleType, string> = {
    road_articulated_diesel: 'Articulated Diesel',
    road_rigid_diesel: 'Rigid Diesel',
    road_lcv_diesel: 'LCV Diesel',
    road_cng: 'CNG',
    road_rigid_electric: 'Electric',
  }
  return labels[vt]
}

export function vehicleTypeIcon(vt: VehicleType): LucideIcon {
  const icons: Record<VehicleType, LucideIcon> = {
    road_articulated_diesel: Truck,
    road_rigid_diesel: Truck,
    road_lcv_diesel: Package,
    road_cng: Wind,
    road_rigid_electric: Zap,
  }
  return icons[vt]
}

// ─── Week of Year ─────────────────────────────────────────────────────────────

export function getCurrentWeekOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const diff = now.getTime() - start.getTime()
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
}
