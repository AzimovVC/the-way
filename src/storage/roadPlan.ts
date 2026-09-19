import type { AppState } from '../domain/models'
import { CURRENT_VERSION } from './migrate'

/**
 * Что лежит в аккаунте, **не выкачивая саму дорогу**. Полмегабайта ради вопроса «а есть ли там
 * что-нибудь» — это трафик на каждом запуске; конверт скачивается только тогда, когда решено, что
 * он нужен.
 */
export interface RoadStamp {
  version: number
  /** Время сервера, а не телефона: часы на телефоне переводит кто угодно. */
  updatedAt: string
}

/**
 * Что делать с двумя историями. `ask` здесь — не «мы не додумали», а решение: «последняя запись
 * побеждает» молча — это способ однажды стереть человеку месяц, причём молча (docs/circle.md,
 * «Дорога в аккаунте»).
 */
export type SyncPlan =
  | { kind: 'idle' }
  | { kind: 'upload' }
  | { kind: 'download' }
  | { kind: 'ask' }
  | { kind: 'blocked'; reason: string }

/**
 * Пустое ли устройство. Пусто — это **и** нет дней, **и** нет ни одной привычки: человек, успевший
 * завести привычку, уже начал путь, и молча заменить его сервером нельзя, даже если дней в нём
 * пока ноль.
 */
export function isEmptyRoad(state: AppState): boolean {
  return state.days.length === 0 && !state.user.goals.some((goal) => goal.tasks.length > 0)
}

export interface RoadSummary {
  dayCount: number
  /** Последний день истории, `null` у пустой. */
  lastDate: string | null
}

/** Чем историю называют в вопросе человеку: сколько дней и по какое число. */
export function roadSummary(state: AppState): RoadSummary {
  return { dayCount: state.days.length, lastDate: state.days.at(-1)?.date ?? null }
}

export interface PlanInput {
  localEmpty: boolean
  remote: RoadStamp | null
  /**
   * Договорились ли уже на этом устройстве с этим аккаунтом. Без этого вопрос «чью дорогу
   * оставить» задавался бы каждый запуск: ответ человека — факт про устройство, и живёт он рядом
   * с самой записью, в localStorage.
   */
  agreed: boolean
  /** Шов для тестов; рабочие вызовы ничего не передают. */
  currentVersion?: number
}

export function planSync({ localEmpty, remote, agreed, currentVersion = CURRENT_VERSION }: PlanInput): SyncPlan {
  // Запись сделана сборкой новее этой. Скачивать её нельзя — прочитать нечем; и **записывать
  // поверх тоже нельзя**, поэтому это не `ask`: предложить «оставить мою» значило бы предложить
  // стереть запись, которую эта сборка просто не понимает. То же правило, что у `readEnvelope`.
  if (remote && remote.version > currentVersion) {
    return { kind: 'blocked', reason: `запись в аккаунте новее этой сборки: v${remote.version} против v${currentVersion}` }
  }

  // В аккаунте пусто: этот телефон и есть источник. Пустое заливать поверх пустого незачем.
  if (remote === null) return localEmpty ? { kind: 'idle' } : { kind: 'upload' }

  // Пустое устройство — единственный случай, когда история приезжает молча. Терять здесь нечего:
  // это новый телефон, очищённые данные или выселенная PWA, и ровно ради этого всё затевалось.
  if (localEmpty) return { kind: 'download' }

  // Истории с обеих сторон. Пока человек не ответил, наружу не уходит ничего: выгрузка «просто
  // так» — это та же тихая замена, только в другую сторону.
  return agreed ? { kind: 'upload' } : { kind: 'ask' }
}

/**
 * Дата из времени сервера — в той зоне, где человек на неё смотрит. `toISOString().slice(0, 10)`
 * дал бы UTC: у того, кто отметился вечером в Москве, копия называлась бы вчерашним числом.
 */
export function localDateOf(iso: string): string {
  const at = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/**
 * Отпечаток уехавшей копии. Нужен ровно для одного: не выгружать при каждом запуске полмегабайта,
 * в котором ничего не поменялось. FNV-1a, 32 бита — это не защита от подделки, а ответ на вопрос
 * «то же самое или другое», и совпадение двух разных историй здесь стоит одной пропущенной
 * выгрузки, которая уедет со следующей правкой.
 */
export function fingerprintOf(serialized: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
