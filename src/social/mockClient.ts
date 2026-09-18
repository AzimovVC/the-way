import type { Acquaintance, FriendsView, SocialClient } from './client'
import { MOCK_PEOPLE } from './mockPeople'
import { loadSocial, saveSocial } from './socialStore'
import type { FriendState, Person, SocialSnapshot } from './types'

/**
 * Заглушка вместо сервера: выдуманные люди, настоящие задержки.
 *
 * Задержка здесь не для красоты. Экран, написанный на мгновенном ответе, не показывает ожидания,
 * и первым, кто увидит его без спиннера, будет живой человек на метро — то есть в день, когда
 * чинить поздно. Двести миллисекунд — это уже «не мгновенно» и ещё «не раздражает».
 *
 * Связи заглушка пишет в то же хранилище, что и будущий клиент, поэтому отправленная заявка
 * переживает перезагрузку. Выдуманные люди в снимок **не** попадают, пока с ними ничего не
 * связано: снимок — это память о людях, которых ты встретил, а не каталог.
 */
const LATENCY_MS = 200

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createMockClient(latencyMs: number = LATENCY_MS): SocialClient {
  let snapshot: SocialSnapshot = loadSocial()

  function commit(next: SocialSnapshot): void {
    snapshot = next
    saveSocial(next)
  }

  function stateOf(id: string): FriendState {
    return snapshot.links[id] ?? 'none'
  }

  /** Человек из памяти, а если его там нет — из каталога выдуманных. */
  function personOf(id: string): Person | null {
    return snapshot.people[id] ?? MOCK_PEOPLE.find((p) => p.id === id) ?? null
  }

  function view(): FriendsView {
    const bucket = (want: FriendState): Person[] =>
      Object.keys(snapshot.links)
        .filter((id) => stateOf(id) === want)
        .map((id) => personOf(id))
        .filter((p): p is Person => p !== null)

    return { friends: bucket('friends'), incoming: bucket('incoming'), outgoing: bucket('outgoing') }
  }

  /** Записать отношение и запомнить самого человека: без него список друзей — это список id. */
  function link(id: string, state: FriendState): FriendsView {
    const person = personOf(id)
    const links = { ...snapshot.links }
    const people = { ...snapshot.people }

    if (state === 'none') delete links[id]
    else links[id] = state

    if (person !== null) people[id] = person
    commit({ people, links })
    return view()
  }

  function acquaintance(person: Person): Acquaintance {
    return { person, state: stateOf(person.id) }
  }

  return {
    async load() {
      await wait(latencyMs)
      return view()
    },

    /**
     * Ищут **по нику, а не по имени** — имя в найденной строке стоит, но по нему не совпадают.
     *
     * Различителей у нас нет: в строке будут имя и число дней, и семь «Марин» на запрос «марина»
     * неразличимы, а цена ошибки — заявка чужому человеку. Имя в поисковом индексе вдобавок значит,
     * что тебя находит каждый, кто знает, как тебя зовут; ник — это то, что ты сам кому-то дал.
     * Не знающего ника закрывает ссылка-приглашение, и закрывает лучше: она передаёт ровно того
     * человека, без выбора из семи.
     *
     * Совпадение — по началу ника, потому что ник и набирают с начала.
     */
    async search(query) {
      await wait(latencyMs)
      const needle = query.trim().toLowerCase().replace(/^@/, '')
      // Пустой запрос отдаёт пусто, а не всех: список, появившийся до того, как что-то набрали,
      // читается как «вот твои друзья».
      if (needle.length === 0) return []
      return MOCK_PEOPLE.filter((person) => person.handle.startsWith(needle)).map(acquaintance)
    },

    async suggestions() {
      await wait(latencyMs)
      // Настоящие предложения требуют графа: «его знает твой друг» — утверждение о чужих связях,
      // и посчитать его может только та сторона. Здесь — просто те, с кем ты ещё не связан.
      return MOCK_PEOPLE.filter((person) => stateOf(person.id) === 'none')
        .slice(0, 4)
        .map(acquaintance)
    },

    async profile(handle) {
      await wait(latencyMs)
      const needle = handle.trim().toLowerCase().replace(/^@/, '')
      const known = Object.values(snapshot.people).find((p) => p.handle === needle)
      const person = known ?? MOCK_PEOPLE.find((p) => p.handle === needle)
      return person === undefined ? null : acquaintance(person)
    },

    async request(id) {
      await wait(latencyMs)
      // Ответ той стороны на твою заявку человеку, который уже позвал тебя, — «вы друзья», а не
      // вторая встречная заявка. Это правило сервера, и заглушка обязана знать его тоже: иначе
      // экран, написанный на ней, не переживёт первого настоящего совпадения.
      return link(id, stateOf(id) === 'incoming' ? 'friends' : 'outgoing')
    },

    async cancel(id) {
      await wait(latencyMs)
      return link(id, 'none')
    },

    async accept(id) {
      await wait(latencyMs)
      return link(id, 'friends')
    },

    async decline(id) {
      await wait(latencyMs)
      return link(id, 'none')
    },

    async remove(id) {
      await wait(latencyMs)
      return link(id, 'none')
    },
  }
}

/**
 * Посадить связи, которых человек не делал: входящую заявку и друга.
 *
 * Такого метода у настоящего клиента не будет и быть не может — входящая заявка приходит оттуда,
 * а не отсюда. Здесь он ровно затем, чтобы экран заявок можно было увидеть до сервера: из DevPanel
 * и из тестов. Пишет он в то же хранилище, что и клиент, поэтому посаженное видно после перезапуска.
 */
export function seedMockLinks(entries: Array<{ personId: string; state: Exclude<FriendState, 'none'> }>): void {
  const snapshot = loadSocial()
  const people = { ...snapshot.people }
  const links = { ...snapshot.links }

  for (const { personId, state } of entries) {
    const person = MOCK_PEOPLE.find((p) => p.id === personId)
    if (person === undefined) continue
    people[personId] = person
    links[personId] = state
  }

  saveSocial({ people, links })
}
