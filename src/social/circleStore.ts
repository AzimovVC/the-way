import type { Circle, CircleInvite } from './circles'

/**
 * Где лежат кружки, пока их нет на сервере.
 *
 * Свой ключ и своя версия — по тем же двум причинам, по которым они есть у людей
 * ([socialStore.ts](./socialStore.ts)): в файл резервной копии уезжает конверт дороги, и кружок,
 * приехавший в нём на новый телефон месяц спустя, был бы записью о договоре, который вторая
 * сторона давно закрыла; а пока `AppState` не знает о кружках ни одного поля, ни одно правило
 * дороги не может их прочитать.
 *
 * Непрочитанная запись начинается заново, а не уезжает в карантин: это копия чужого ответа, а не
 * единственная копия истории. Спросить заново будет у кого — в части 8.
 */
const CIRCLES_KEY = 'the-way:circles'

/** Версия формы. Поднимать её нечем: непонятная запись тут просто заменяется пустой. */
const CIRCLES_VERSION = 1

export interface CircleSnapshot {
  circles: Circle[]
  incoming: CircleInvite[]
  outgoing: CircleInvite[]
}

export function emptyCircles(): CircleSnapshot {
  return { circles: [], incoming: [], outgoing: [] }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function loadCircles(): CircleSnapshot {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(CIRCLES_KEY)
  } catch {
    return emptyCircles()
  }
  if (raw === null) return emptyCircles()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed) || parsed.version !== CIRCLES_VERSION) return emptyCircles()
    const data = parsed.data
    if (!isObject(data)) return emptyCircles()
    if (!Array.isArray(data.circles) || !Array.isArray(data.incoming) || !Array.isArray(data.outgoing)) {
      return emptyCircles()
    }
    return {
      circles: data.circles as Circle[],
      incoming: data.incoming as CircleInvite[],
      outgoing: data.outgoing as CircleInvite[],
    }
  } catch {
    return emptyCircles()
  }
}

export function saveCircles(data: CircleSnapshot): void {
  try {
    localStorage.setItem(CIRCLES_KEY, JSON.stringify({ version: CIRCLES_VERSION, data }))
  } catch {
    // Переполненное хранилище не должно ронять день: дорога пишется своим кодом и своим ключом.
  }
}

export function clearCircles(): void {
  try {
    localStorage.removeItem(CIRCLES_KEY)
  } catch {
    // см. saveCircles
  }
}
