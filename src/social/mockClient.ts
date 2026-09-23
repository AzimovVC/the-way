import type { Acquaintance, FriendsView, SocialClient } from './client'
import { createStubCircles } from './mockCircles'
import { MOCK_PEOPLE, circleOf, shelfIsOpen } from './mockPeople'
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

    return {
      friends: bucket('friends'),
      incoming: bucket('incoming'),
      outgoing: bucket('outgoing'),
      blocked: bucket('blocked'),
    }
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

  /**
   * С кем дружите вы оба. Пересечение его круга с твоим — и именно в таком порядке: список твоих
   * друзей есть у нас, его круг приходит оттуда, и своих чисел про чужие связи мы не считаем.
   */
  function mutualWith(person: Person): Person[] {
    const mine = new Set(Object.keys(snapshot.links).filter((id) => stateOf(id) === 'friends'))
    return circleOf(person.id)
      .filter((id) => mine.has(id))
      .map((id) => personOf(id))
      .filter((p): p is Person => p !== null)
  }

  return {
    // Кружки лежат отдельным файлом и отдельным хранилищем: дружбы уже на сервере, кружки ещё нет,
    // и граница сделанного проходит ровно здесь. Часть 8 заменит эту строку вызовами.
    ...createStubCircles(wait, latencyMs),

    /**
     * Сообщений у выдуманного мира нет и взяться им неоткуда: чеканит их сервер, а здесь его нет.
     * Пустой список — честный ответ, а не заглушка: выдумать «Лена вышла из кружка» значило бы
     * показать новость о событии, которого не было.
     */
    async notices() {
      return []
    },

    async noticeDismiss() {
      return []
    },

    /**
     * Слушать здесь нечего: вторая половина выдумана, и нажать у неё некому. Отписка пустая —
     * тихий `noop` честнее, чем отсутствие метода: экран не должен знать, какой он клиент.
     */
    watch() {
      return () => {}
    },

    /**
     * The made-up world has nobody to send a GIF, and nobody to receive one: a GIF from «Лена» that
     * she never sent would be news about something that did not happen. Sending succeeds and goes
     * nowhere, which is what sending to a made-up person is.
     */
    async messages() {
      return []
    },

    async messageSend() {
      await wait(latencyMs)
    },

    async messagesDismiss() {
      return []
    },

    /**
     * Ленты у выдуманного мира нет, и выдумать её нельзя.
     *
     * Событие друга — это запись о чужой прожитой неделе, и сочинённая «Лена взяла Ученика» была бы
     * новостью о том, чего не было, — то же самое, чего не делает и `notices`. Пустая лента при
     * этом не врёт: своя половина на экране всё равно стоит, её выводит дорога.
     */
    async feed() {
      return { events: [], hearts: [] }
    },

    async heart() {
      return { events: [], hearts: [] }
    },

    async unheart() {
      return { events: [], hearts: [] }
    },
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
      // Заблокированный в поиске не всплывает: блокировка, оставляющая человека в выдаче, —
      // это блокировка, не сделавшая ровно того, о чём её просили.
      return MOCK_PEOPLE.filter(
        (person) => person.handle.startsWith(needle) && stateOf(person.id) !== 'blocked',
      ).map(acquaintance)
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
      if (person === undefined) return null
      // Про заблокированного не приходит ничего, кроме имени: полка и числа — это то, что он
      // показывает тебе, а блокировка ровно это и отменила. Экран, спрятавший их у себя, оставил
      // бы их приехавшими — и «скрыто» держалось бы на честном слове клиента.
      if (stateOf(person.id) === 'blocked') {
        return { person: { id: person.id, handle: person.handle, name: person.name }, state: 'blocked' }
      }
      // Полка уезжает только друзьям, если человек не открыл её всем. Снимает её **эта сторона**:
      // прислать и не нарисовать — это утечка, до которой один тап в инструментах разработчика.
      // `habitCount` при этом остаётся: число ничего не называет, а без него плитка «сколько у
      // него привычек» врала бы нулём там, где их четыре.
      const seen = acquaintance(person)
      const open = seen.state === 'friends' || shelfIsOpen(person.id)
      const shown = open ? seen.person : { ...seen.person, habits: undefined }
      return { ...seen, person: shown, mutual: mutualWith(person) }
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

    async block(id) {
      await wait(latencyMs)
      return link(id, 'blocked')
    },

    async unblock(id) {
      await wait(latencyMs)
      // Разблокировка возвращает в «никто», а не в друзья. Дружбу складывали вдвоём, и вернуть её
      // односторонним нажатием значило бы записать второго обратно без его ведома.
      return link(id, 'none')
    },

    async report() {
      await wait(latencyMs)
      // Заглушка не записывает жалобу **никуда**, и это не лень: «я пожаловался» — факт, который
      // знает та сторона, и местная копия начала бы жить своей жизнью. После перезагрузки экран
      // снова покажет обычную кнопку — так и должно быть, пока сервера нет.
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
