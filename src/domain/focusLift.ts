import { FOCUS_LIFT_FALLOFF_DAYS, FOCUS_LIFT_PX } from './config'

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
