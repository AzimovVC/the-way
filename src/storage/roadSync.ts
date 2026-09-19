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
 * У локальной записи debounce 400 мс, у этой — две минуты. Копия, отставшая на минуту, стоит
 * одной отметки; копия, уходящая на каждый тап, стоит батареи и трафика, и это конверт целиком, а
 * не пять чисел профиля.
 */
const UPLOAD_DEBOUNCE_MS = 120_000

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
  uploadRoad(userId, state).catch(() => {
    // Копия, не уехавшая сейчас, уедет со следующей правкой или на следующем запуске: отпечаток
    // не записан, значит эта история всё ещё считается неотправленной. Экран об этом не говорит —
    // это не действие человека, и жаловаться ему не на что.
  })
}

/** Поставить выгрузку в очередь. Зовётся на каждую правку состояния; уходит раз в две минуты. */
export function queueRoadUpload(userId: string, state: AppState): void {
  pending = { userId, state }
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    timer = null
    push()
  }, UPLOAD_DEBOUNCE_MS)
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
}
