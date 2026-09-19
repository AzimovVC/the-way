import type { AppState } from '../domain/models'
import { supabase } from '../supabase/client'
import { CURRENT_VERSION, readEnvelope, serializeEnvelope, type LoadOutcome } from './migrate'
import { fingerprintOf, type RoadStamp } from './roadPlan'

/**
 * Дорога в аккаунте — **копия, а не переезд** (docs/circle.md). Источник правды остаётся в
 * localStorage: приложение PWA, и день, отмеченный без сети, не имеет права потеряться. Здесь
 * только три вещи — спросить, что лежит в аккаунте, забрать это и отправить своё.
 */

/**
 * Не чаще раза в две минуты — но **первая** правка после тишины уезжает сразу. Это окно, а не
 * debounce, и разница несущая: debounce сбрасывался на каждой правке, поэтому человек, который
 * отмечает задачи по одной раз в минуту, не выгружался вообще — таймер не доживал до срабатывания
 * ни разу за весь вечер. Копия, уходящая на каждый тап, стоит батареи и трафика (это конверт
 * целиком, а не пять чисел профиля), а копия, не ушедшая никогда, не стоит ничего.
 */
const UPLOAD_WINDOW_MS = 120_000

/**
 * С каким аккаунтом на этом устройстве уже договорились, чью дорогу оставить. Факт про устройство,
 * поэтому свой ключ, а не поле состояния: внутри конверта он уехал бы в файл резервной копии и
 * приехал бы на новый телефон готовым ответом на вопрос, которого там ещё не задавали.
 */
const ACCOUNT_KEY = 'the-way:road-account'
/** Отпечаток последней уехавшей копии — чтобы запуск без правок не выгружал то же самое заново. */
const PUSHED_KEY = 'the-way:road-pushed'

export async function fetchRoadStamp(userId: string): Promise<RoadStamp | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('roads')
    .select('version, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (data === null) return null
  return { version: data.version as number, updatedAt: data.updated_at as string }
}

/**
 * Забрать дорогу из аккаунта. Разбирается она **тем же** `readEnvelope`, что и файл копии: запись
 * в базе сделана старой сборкой ровно так же, как файл, и вторая, «серверная» проверка формы
 * разошлась бы с первой в день, когда цепочка миграций подрастёт.
 *
 * `jsonb` приезжает уже разобранным, и обратная сборка в строку здесь — цена этого единственного
 * входа. Она платится один раз за восстановление.
 */
export async function downloadRoad(userId: string): Promise<LoadOutcome> {
  if (!supabase) return { kind: 'empty' }
  const { data, error } = await supabase.from('roads').select('state').eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (data === null) return { kind: 'empty' }
  return readEnvelope(JSON.stringify(data.state))
}

/** Отправить свою дорогу. Ровно то же, что уезжает в файл, — та же функция сериализации. */
export async function uploadRoad(userId: string, state: AppState): Promise<void> {
  if (!supabase) return
  const text = serializeEnvelope(state)
  const { error } = await supabase
    .from('roads')
    .upsert({ user_id: userId, version: CURRENT_VERSION, state: JSON.parse(text) as unknown })
  if (error) throw error
  rememberPushed(userId, fingerprintOf(text))
  // Выгрузивший и есть тот, чья дорога теперь в аккаунте: спрашивать его на следующем запуске
  // «чью историю оставить» значило бы спрашивать про две копии одной и той же.
  markRoadAgreement(userId)
}

let pending: { userId: string; state: AppState } | null = null
let timer: ReturnType<typeof setTimeout> | null = null
/** Когда в последний раз **начали** отправлять. Ноль — окна нет, следующая правка уедет сразу. */
let windowOpenedAt = 0

function push(): void {
  if (pending === null) return
  const { userId, state } = pending
  pending = null
  const text = serializeEnvelope(state)
  // Ничего не поменялось с прошлой выгрузки — чаще всего это просто второй запуск подряд.
  // Договорённость подтверждается всё равно: в аккаунте лежит ровно эта дорога, и повода
  // спрашивать «чью оставить» нет, сколько бы раз приложение ни открывали.
  if (fingerprintOf(text) === readPushed(userId)) {
    markRoadAgreement(userId)
    return
  }
  // Окно открывает сама отправка, а не попытка: запуск без правок доходит до строки выше и уходит
  // ни с чем, и закрытое им окно задержало бы первую настоящую отметку на две минуты ни за что.
  windowOpenedAt = Date.now()
  uploadRoad(userId, state).catch(() => {
    // Копия, не уехавшая сейчас, уедет со следующей правкой или на следующем запуске: отпечаток
    // не записан, значит эта история всё ещё считается неотправленной. Экран об этом не говорит —
    // это не действие человека, и жаловаться ему не на что.
  })
}

/**
 * Поставить выгрузку в очередь. Зовётся на каждую правку состояния. Первая после тишины уезжает
 * немедленно, остальные — концом начатого ею окна, и окно **не продлевается**: продлеваемое окно и
 * есть тот debounce, при котором непрерывно работающий человек не выгружался ни разу.
 */
export function queueRoadUpload(userId: string, state: AppState): void {
  pending = { userId, state }
  if (timer !== null) return
  const wait = windowOpenedAt === 0 ? 0 : Math.max(0, UPLOAD_WINDOW_MS - (Date.now() - windowOpenedAt))
  if (wait === 0) {
    push()
    return
  }
  timer = setTimeout(() => {
    timer = null
    push()
  }, wait)
}

/**
 * Отправить немедленно — там же, где `flushPendingSave` дожимает localStorage.
 *
 * Оговорка честная: запрос, начатый на `pagehide`, браузер имеет право не довезти, и это не
 * чинится — дорога в 150 КБ не лезет в `keepalive`. Цена ограничена: местная запись сделана, а
 * неотправленное видно по отпечатку и уедет на следующем запуске.
 */
export function flushRoadUpload(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
  push()
}

/** Выход из аккаунта: всё, что не уехало, не уедет туда уже никогда — там другой человек. */
export function cancelRoadUpload(): void {
  pending = null
  // Окно принадлежало прошлому аккаунту: у нового первая правка обязана уехать сразу.
  windowOpenedAt = 0
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

export function readRoadAgreement(): string | null {
  return localStorage.getItem(ACCOUNT_KEY)
}

export function markRoadAgreement(userId: string): void {
  try {
    localStorage.setItem(ACCOUNT_KEY, userId)
  } catch {
    // Полное хранилище стоит повторного вопроса на следующем запуске, а не потерянной истории.
  }
}

function readPushed(userId: string): string | null {
  const raw = localStorage.getItem(PUSHED_KEY)
  if (raw === null) return null
  // Отпечаток лежит вместе с тем, **чей** он: вошедший другим аккаунтом иначе прочитал бы чужой
  // и решил, что его дорога уже выгружена.
  const [owner, fingerprint] = raw.split(':')
  return owner === userId ? (fingerprint ?? null) : null
}

function rememberPushed(userId: string, fingerprint: string): void {
  try {
    localStorage.setItem(PUSHED_KEY, `${userId}:${fingerprint}`)
  } catch {
    // То же самое: цена — лишняя выгрузка, а не потеря.
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushRoadUpload)
  window.addEventListener('pagehide', flushRoadUpload)
  // Главный момент — этот, а не два верхних. Телефон приложения не закрывает: его сворачивают, и
  // на iOS `pagehide` может не прийти вовсе, а до `beforeunload` дело доходит разве что на
  // десктопе. `visibilitychange` приходит в ту секунду, когда человек ушёл в другое приложение, и
  // страница в этот момент ещё жива — запрос успевает уйти по-настоящему.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushRoadUpload()
  })
}
