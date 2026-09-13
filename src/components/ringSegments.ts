/** Discrete arc-segment ring math shared by the path's today-bead halo and the DayCard badge. */
export function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const rad = (d: number) => ((d - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(rad(startDeg))
  const y1 = cy + r * Math.sin(rad(startDeg))
  const x2 = cx + r * Math.cos(rad(endDeg))
  const y2 = cy + r * Math.sin(rad(endDeg))
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

export function ringSegmentAngles(count: number, gapDeg: number) {
  if (count === 0) return []
  const segDeg = 360 / count - gapDeg
  return Array.from({ length: count }, (_, i) => {
    const start = i * (360 / count) + gapDeg / 2
    return { start, end: start + segDeg }
  })
}
