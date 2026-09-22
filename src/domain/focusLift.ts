import { FOCUS_LIFT_FALLOFF_DAYS, FOCUS_LIFT_PX, FOCUS_LIFT_WAKE_DAYS } from './config'

/**
 * Насколько лифт вообще разбужен, долей от полной силы: 0 на сегодня, 1 в двух днях от него.
 *
 * Лифт — курсор по дороге, а не украшение. В покое дорога стоит на сегодня, и там подъёма быть
 * не должно: сегодня уже помечено ярче — единственный неприглушённый круг, да ещё с кольцом, — и
 * второй меткой об одном и том же они бы только спорили.
 *
 * Считается по модулю: вперёд, за сегодня, курсор ходит так же, как назад. Дни впереди — такие же
 * круги дороги, и день, на котором стоит скролл, поднимается независимо от того, с какой стороны
 * от сегодня он лежит; иначе половина дороги отвечает на палец, а половина молчит.
 */
export function focusLiftWake(daysBack: number, wakeDays: number = FOCUS_LIFT_WAKE_DAYS): number {
  const away = Math.abs(daysBack)
  if (wakeDays <= 0) return away > 0 ? 1 : 0
  const t = Math.min(away / wakeDays, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Насколько круг дня приподнят над собственной подставкой, в локальных единицах пути.
 *
 * Приём называется fisheye/Dock: величина — функция расстояния до точки фокуса, а не состояние
 * «выбран». Поэтому активного дня нигде не хранится: скролл уже стоит на дробном индексе
 * (см. focusOn в PathView), и всё, что нужно, — насколько далеко от него этот день.
 *
 * Затухание гладкое (smoothstep), а не линейное: на линейном видно излом ровно в тот момент,
 * когда лифт переходит с круга на круг, и дорога дёргается на каждом дне.
 *
 * Это только рендер. Точка дня остаётся там, где её поставил pathEngine: лифт двигает лицо круга
 * по экрану, а не слот на дороге, иначе поедут и шаг, и посадка чипов вех.
 */
export function focusLift(
  distanceDays: number,
  liftPx: number = FOCUS_LIFT_PX,
  falloffDays: number = FOCUS_LIFT_FALLOFF_DAYS,
): number {
  // A radius of zero is the slider's way of switching the lift off — without this it divides by
  // zero and every day on the road comes back NaN, which reads as the road losing its shadows.
  if (falloffDays <= 0) return 0
  const d = Math.min(Math.abs(distanceDays) / falloffDays, 1)
  const t = 1 - d
  return liftPx * t * t * (3 - 2 * t)
}
