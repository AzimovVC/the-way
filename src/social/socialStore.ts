import { emptySnapshot, type SocialSnapshot } from './types'

/**
 * Где лежат люди. **Свой ключ, а не конверт дороги** — и это несущее решение, а не привычка к
 * порядку.
 *
 * Причин две. Первая: файл резервной копии. Конверт целиком уезжает в него и возвращается на новом
 * телефоне месяц спустя — с друзьями, которых успели отписать, и заявками, на которые уже ответили.
 * Список друзей знает сервер, и правильный ответ на «кто твои друзья» после восстановления — не
 * старый список, а вопрос заново.
 *
 * Вторая: пока `AppState` не знает о людях **ни одного поля**, ни одно правило дороги не может
 * случайно их прочитать. Обещание «друг не касается дороги» держится формой кода, а не
 * внимательностью того, кто будет править `completionRate` через год.
 *
 * Отсюда же и отношение к сломанной записи: её здесь не откладывают в карантин, а начинают
 * заново. Карантин существует, потому что история — единственная копия; кэш чужого ответа —
 * не копия ничего.
 */
const SOCIAL_KEY = 'the-way:social'

/** Версия формы снимка. Поднимать её нечем: непонятная запись тут просто заменяется пустой. */
const SOCIAL_VERSION = 1

interface SocialEnvelope {
  version: number
  data: SocialSnapshot
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function loadSocial(): SocialSnapshot {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(SOCIAL_KEY)
  } catch {
    // Приватный режим и заблокированное хранилище: слой обязан работать без диска. Друзья
    // приедут с сервера и в этой сессии просто не переживут перезапуск.
    return emptySnapshot()
  }
  if (raw === null) return emptySnapshot()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed) || parsed.version !== SOCIAL_VERSION) return emptySnapshot()
    const data = parsed.data
    if (!isObject(data) || !isObject(data.people) || !isObject(data.links)) return emptySnapshot()
    return { people: data.people as SocialSnapshot['people'], links: data.links as SocialSnapshot['links'] }
  } catch {
    return emptySnapshot()
  }
}

export function saveSocial(data: SocialSnapshot): void {
  const envelope: SocialEnvelope = { version: SOCIAL_VERSION, data }
  try {
    localStorage.setItem(SOCIAL_KEY, JSON.stringify(envelope))
  } catch {
    // Переполненное хранилище не должно ронять экран друзей: дорога пишется своим кодом и
    // своим ключом, и её запись этим не задета.
  }
}

/** Забыть всё про людей — выход из аккаунта, когда он появится, и кнопка в DevPanel до тех пор. */
export function clearSocial(): void {
  try {
    localStorage.removeItem(SOCIAL_KEY)
  } catch {
    // см. saveSocial
  }
}
