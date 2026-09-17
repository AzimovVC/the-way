import { PLINTH_MIN_BASE_RATIO, PLINTH_TAPER_RATIO } from './config'

/**
 * Основание тела — радиус там, где круг стоит на дороге.
 *
 * Выделено отдельно, потому что на него смотрит и тест, и сам путь: это то самое число, которое
 * обязано быть не больше радиуса лица, иначе силуэт снова разваливается на два диска.
 */
export function plinthBaseRadius(radius: number, depth: number): number {
  return Math.max(radius - PLINTH_TAPER_RATIO * depth, radius * PLINTH_MIN_BASE_RATIO)
}

/**
 * Контур тела круга: от лица наверху вниз к основанию, боками внутрь.
 *
 * Рисуется одной фигурой, а не двумя кругами со сдвигом. Два круга дают контур, который у земли
 * шире, чем у лица, и предмет распадается на диск и его копию — особенно заметно, когда лифт
 * фокуса (focusLift.ts) поднимает лицо и расстояние между ними растёт.
 *
 * Верхняя дуга — полный радиус лица: лицо ложится на неё ровно и закрывает её целиком, так что шва
 * не видно ни при какой высоте.
 */
export function plinthBodyPath(cx: number, cy: number, radius: number, depth: number): string {
  const base = plinthBaseRadius(radius, depth)
  const groundY = cy + depth
  return [
    `M ${cx - radius} ${cy}`,
    `L ${cx - base} ${groundY}`,
    `A ${base} ${base} 0 0 0 ${cx + base} ${groundY}`,
    `L ${cx + radius} ${cy}`,
    `A ${radius} ${radius} 0 0 1 ${cx - radius} ${cy}`,
    'Z',
  ].join(' ')
}
