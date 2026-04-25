/**
 * Custom hook: d3.geoMercator projection centred on India.
 * Returns project(lon, lat) → [x, y]  and the raw projection object.
 */
import { useMemo } from 'react'
import * as d3 from 'd3'

interface ProjectionResult {
  /** Convert (longitude, latitude) → SVG (x, y) */
  project: (lon: number, lat: number) => [number, number]
  /** Convert SVG (x, y) → (longitude, latitude) */
  unproject: (x: number, y: number) => [number, number]
  /** Raw d3 projection (for d3.geoPath) */
  projection: d3.GeoProjection
  /** d3.geoPath generator using this projection */
  pathGen: d3.GeoPath
}

export function useProjection(width: number, height: number): ProjectionResult {
  return useMemo(() => {
    const scale = Math.min(width, height) * 1.45
    const projection = d3.geoMercator()
      .center([82, 22])
      .scale(scale)
      .translate([width * 0.48, height * 0.52])

    const pathGen = d3.geoPath(projection)

    const project = (lon: number, lat: number): [number, number] => {
      const p = projection([lon, lat])
      return p ? [p[0], p[1]] : [0, 0]
    }

    const unproject = (x: number, y: number): [number, number] => {
      const p = projection.invert?.([x, y])
      return p ? [p[0], p[1]] : [0, 0]
    }

    return { project, unproject, projection, pathGen }
  }, [width, height])
}
