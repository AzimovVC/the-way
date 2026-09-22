/** Сколько раз за день и в чём они меряются. `undefined` — привычку не считают, её просто делают. */
export type TargetValue = { count: number; unit: string } | undefined

/** Слово человека чистится от пробелов, а «0 раз» не бывает — это выключенный счётчик. */
export function cleanTarget(target: TargetValue): TargetValue {
  if (!target || target.count < 1) return undefined
  return { count: target.count, unit: target.unit.trim() }
}
