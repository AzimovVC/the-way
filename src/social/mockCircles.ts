import type { Circle, CircleInvite, CircleMark, CircleMethods, CirclesView } from './circles'
import { loadCircles, saveCircles, type CircleSnapshot } from './circleStore'
import { MOCK_PEOPLE } from './mockPeople'
import type { Person } from './types'

/**
 * Кружок на заглушке: выдуманная вторая половина, настоящая форма двери.
 *
 * Стоит **отдельно от `mockClient`** и подмешивается в обоих клиентов, живого и выдуманного,
 * потому что сейчас именно здесь проходит граница сделанного: дружбы уже на сервере
 * ([supabaseClient.ts](./supabaseClient.ts)), кружки ещё нет. Часть 8 выкинет этот файл целиком и
 * поставит на его место восемь вызовов — ровно так же, как это уже случилось с друзьями, и ни один
 * экран об этом не узнает.
 *
 * Оттуда же и хранилище: кружок лежит на **этом** устройстве ([circleStore.ts](./circleStore.ts)),
 * и «я нажал — она видит» здесь физически не существует. Ради этого всё и затевалось, и заглушка
 * этого не даст; она даёт другое — четыре состояния строки, парную серию и приглашение, то есть
 * ровно то, что надо увидеть глазами прежде, чем писать схему.
 */

/** Кто на той стороне у посаженного кружка. Лена — она же первая в друзьях у `seedPeople`. */
const STUB_PARTNER = 'p-lena'

function personOf(personId: string): Person {
  return MOCK_PEOPLE.find((person) => person.id === personId) ?? MOCK_PEOPLE[0]
}

function view(snapshot: CircleSnapshot): CirclesView {
  return { circles: snapshot.circles, incoming: snapshot.incoming, outgoing: snapshot.outgoing }
}

function commit(next: CircleSnapshot): CirclesView {
  saveCircles(next)
  return view(next)
}

export function createStubCircles(wait: (ms: number) => Promise<void>, latencyMs: number): CircleMethods {
  const pause = () => wait(latencyMs)

  return {
    async circles() {
      await pause()
      return view(loadCircles())
    },

    /**
     * Опубликовать свою отметку. Твоя строка дня к этому моменту уже закрыта — её закрыл
     * `applyAction` на твоей дороге, — и ждать ответа сети внутри собственной галочки нечего:
     * это лаг там, где его быть не должно.
     */
    async circleMark(circleId, date, doneAt) {
      await pause()
      const snapshot = loadCircles()
      return commit({
        ...snapshot,
        circles: snapshot.circles.map((circle) => {
          if (circle.id !== circleId) return circle
          const mine = { circleId, personId: 'me', date, doneAt }
          const rest = circle.marks.filter((mark) => !(mark.personId === 'me' && mark.date === date))
          return { ...circle, marks: [...rest, mine] }
        }),
      })
    },

    /** Снятая галочка — исправление, а не событие. Отметка уходит, как будто её не было. */
    async circleUnmark(circleId, date) {
      await pause()
      const snapshot = loadCircles()
      return commit({
        ...snapshot,
        circles: snapshot.circles.map((circle) =>
          circle.id === circleId
            ? { ...circle, marks: circle.marks.filter((mark) => !(mark.personId === 'me' && mark.date === date)) }
            : circle,
        ),
      })
    },

    async circleInvite(input) {
      await pause()
      const snapshot = loadCircles()
      const invite: CircleInvite = {
        id: input.id,
        person: personOf(input.personId),
        title: input.title,
        icon: input.icon,
        weekdays: input.weekdays,
        timezone: input.timezone,
        taskId: input.taskId,
      }
      return commit({ ...snapshot, outgoing: [...snapshot.outgoing, invite] })
    },

    async circleCancel(inviteId) {
      await pause()
      const snapshot = loadCircles()
      return commit({ ...snapshot, outgoing: snapshot.outgoing.filter((invite) => invite.id !== inviteId) })
    },

    /**
     * Принять. Привычка у себя к этому моменту уже заведена — обычным путём, через `applyAction`,
     * — и её ключ приезжает сюда готовым: в состояние попал **результат твоего согласия**, а не
     * чужие данные. Слово подсказала она, завёл привычку ты.
     */
    async circleAccept(inviteId, circleId, taskId) {
      await pause()
      const snapshot = loadCircles()
      const invite = snapshot.incoming.find((item) => item.id === inviteId)
      if (invite === undefined) return view(snapshot)

      const circle: Circle = {
        id: circleId,
        title: invite.title,
        icon: invite.icon,
        weekdays: invite.weekdays,
        taskId,
        partner: { person: invite.person, excused: [] },
        // Раньше согласия пары не было, и считать там нечего: чужие дни до кружка — его жизнь.
        startedOn: new Date().toISOString().slice(0, 10),
        timezone: invite.timezone,
        marks: [],
      }
      return commit({
        ...snapshot,
        circles: [...snapshot.circles, circle],
        incoming: snapshot.incoming.filter((item) => item.id !== inviteId),
      })
    },

    /** Отказ ничего не сообщает сверх «не сейчас» и нигде не записывается. */
    async circleDecline(inviteId) {
      await pause()
      const snapshot = loadCircles()
      return commit({ ...snapshot, incoming: snapshot.incoming.filter((item) => item.id !== inviteId) })
    },

    /**
     * Выйти. Привычка у обоих остаётся обычной привычкой и **сохраняет все свои дни**: чужой уход
     * не имеет права отобрать у человека его же жизнь. Здесь уходит только запись о паре — на
     * сервере оставшийся получит об этом сообщение, а не пропажу второй кнопки.
     */
    async circleLeave(circleId) {
      await pause()
      const snapshot = loadCircles()
      return commit({ ...snapshot, circles: snapshot.circles.filter((circle) => circle.id !== circleId) })
    },

  }
}

/**
 * Посадить кружок, которого человек не заводил, — как `seedPeople` сажает входящую заявку.
 *
 * Такого метода у настоящего клиента не будет: согласие второго приходит **оттуда**. Здесь он
 * ровно затем, чтобы строку кружка и парную серию можно было увидеть до сервера, — и сеется не
 * ровная история, а та, в которой парная серия уже один раз рвалась: серия, ни разу не
 * оборвавшаяся, не показывает второе число («вместе N дней») работающим.
 *
 * `taskId` — настоящая привычка с этого устройства: кружок встаёт **в неё**, а не рядом с ней.
 */
export function seedStubCircle(taskId: string, today: string, timezone: string): void {
  const partner = personOf(STUB_PARTNER)
  const day = (back: number): string =>
    new Date(Date.parse(`${today}T00:00:00Z`) - back * 86_400_000).toISOString().slice(0, 10)

  const startedOn = day(13)
  // Её пропуск на восьмой день назад — там серия и рвалась; её заморозка на третий — там она шла
  // дальше. Оба случая нужны глазами: правило про заморозку иначе живёт только в тесте.
  const missed = day(8)
  const excused = day(3)
  const marks: CircleMark[] = []
  for (let back = 13; back >= 0; back--) {
    const date = day(back)
    if (date === missed || date === excused) continue
    marks.push({ circleId: 'c-stub', personId: partner.id, date, doneAt: `${date}T08:20:00.000Z` })
  }

  const circle: Circle = {
    id: 'c-stub',
    title: 'Бег 5 км',
    icon: '🏃',
    taskId,
    partner: { person: partner, excused: [excused] },
    startedOn,
    timezone,
    marks,
  }

  const invite: CircleInvite = {
    id: 'ci-stub',
    person: personOf('p-oleg'),
    title: 'Турник',
    icon: '🤸',
    weekdays: [0, 2, 4],
    timezone,
  }

  saveCircles({ circles: [circle], incoming: [invite], outgoing: [] })
}

/**
 * Переставить её сегодняшнюю галочку. Кнопка DevPanel и больше ничто: «она нажала» приходит
 * оттуда, и местного способа это устроить у настоящего клиента не будет.
 */
export function togglePartnerMark(circleId: string, date: string): void {
  const snapshot = loadCircles()
  saveCircles({
    ...snapshot,
    circles: snapshot.circles.map((circle) => {
      if (circle.id !== circleId) return circle
      const theirs = circle.partner.person.id
      const has = circle.marks.some((mark) => mark.personId === theirs && mark.date === date)
      return {
        ...circle,
        marks: has
          ? circle.marks.filter((mark) => !(mark.personId === theirs && mark.date === date))
          : [...circle.marks, { circleId, personId: theirs, date, doneAt: new Date().toISOString() }],
      }
    }),
  })
}
