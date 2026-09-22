import { beforeEach, describe, expect, it } from 'vitest'
import { clearCircles, loadCircles } from './circleStore'
import { createStubCircles, seedStubCircle, togglePartnerMark } from './mockCircles'
import { MOCK_PEOPLE } from './mockPeople'

/** Как и у соцслоя: хранилища в тестовой среде нет, и оно подставляется руками. */
function installStorage(): void {
  const data = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    },
  })
}

const now = () => Promise.resolve()
const client = () => createStubCircles(now, 0)
const LENA = MOCK_PEOPLE[0]

describe('заглушка кружка', () => {
  beforeEach(() => {
    installStorage()
    clearCircles()
  })

  it('на пустом устройстве кружков нет', async () => {
    expect(await client().circles()).toEqual({ circles: [], incoming: [], outgoing: [] })
  })

  it('приглашение уходит в отправленные и помнит, какой привычкой зовут', async () => {
    const view = await client().circleInvite({
      id: 'i1',
      personId: LENA.id,
      taskId: 't-run',
      title: 'Бег',
      weekdays: [0, 2, 4],
      timezone: 'Europe/Kyiv',
    })
    expect(view.outgoing).toHaveLength(1)
    expect(view.outgoing[0].person.id).toBe(LENA.id)
    expect(view.outgoing[0].taskId).toBe('t-run')
    expect(view.outgoing[0].weekdays).toEqual([0, 2, 4])
  })

  it('отменённое приглашение исчезает', async () => {
    const c = client()
    await c.circleInvite({ id: 'i1', personId: LENA.id, taskId: 't', title: 'Бег', timezone: 'UTC' })
    expect((await c.circleCancel('i1')).outgoing).toHaveLength(0)
  })

  it('принятое приглашение становится кружком со **своей** привычкой', async () => {
    seedStubCircle('t-run', '2026-09-19', 'Europe/Kyiv')
    const c = client()
    const invite = (await c.circles()).incoming[0]
    // Ключ привычки чеканит принимающий: она завелась у него обычным путём, через `applyAction`,
    // и в кружок приезжает уже готовой.
    const view = await c.circleAccept(invite.id, 'c-new', 'my-own-task')
    expect(view.incoming).toHaveLength(0)
    const made = view.circles.find((circle) => circle.id === 'c-new')
    expect(made?.taskId).toBe('my-own-task')
    expect(made?.title).toBe(invite.title)
    expect(made?.partner.person.id).toBe(invite.person.id)
  })

  it('отказ ничего не оставляет', async () => {
    seedStubCircle('t-run', '2026-09-19', 'Europe/Kyiv')
    const c = client()
    const invite = (await c.circles()).incoming[0]
    const view = await c.circleDecline(invite.id)
    expect(view.incoming).toHaveLength(0)
    expect(view.circles.some((circle) => circle.id === invite.id)).toBe(false)
  })

  it('своя отметка публикуется и снимается', async () => {
    seedStubCircle('t-run', '2026-09-19', 'Europe/Kyiv')
    const c = client()
    const marked = await c.circleMark('c-stub', '2026-09-19', '2026-09-19T09:00:00.000Z')
    const mine = marked.circles[0].marks.filter((mark) => mark.personId === 'me')
    expect(mine).toHaveLength(1)

    const cleared = await c.circleUnmark('c-stub', '2026-09-19')
    expect(cleared.circles[0].marks.some((mark) => mark.personId === 'me')).toBe(false)
  })

  it('дважды отмеченный день остаётся одной отметкой', async () => {
    seedStubCircle('t-run', '2026-09-19', 'Europe/Kyiv')
    const c = client()
    await c.circleMark('c-stub', '2026-09-19', '2026-09-19T09:00:00.000Z')
    const twice = await c.circleMark('c-stub', '2026-09-19', '2026-09-19T21:00:00.000Z')
    expect(twice.circles[0].marks.filter((mark) => mark.personId === 'me')).toHaveLength(1)
  })

  it('выход убирает кружок и ничего не трогает в привычке', async () => {
    seedStubCircle('t-run', '2026-09-19', 'Europe/Kyiv')
    const view = await client().circleLeave('c-stub')
    expect(view.circles).toHaveLength(0)
    // Приглашение рядом при этом стоит на месте: выход из одного кружка не ответ на другое.
    expect(view.incoming).toHaveLength(1)
  })

  it('посев даёт её пропуск и её заморозку — иначе два числа неразличимы', () => {
    seedStubCircle('t-run', '2026-09-19', 'Europe/Kyiv')
    const circle = loadCircles().circles[0]
    expect(circle.partner.excused).toHaveLength(1)
    // Четырнадцать дней от начала, минус её пропуск и минус день заморозки.
    expect(circle.marks).toHaveLength(12)
  })

  it('её галочка переставляется туда и обратно', () => {
    seedStubCircle('t-run', '2026-09-19', 'Europe/Kyiv')
    const them = loadCircles().circles[0].partner.person.id
    const has = () =>
      loadCircles().circles[0].marks.some((mark) => mark.personId === them && mark.date === '2026-09-19')
    expect(has()).toBe(true)
    togglePartnerMark('c-stub', '2026-09-19')
    expect(has()).toBe(false)
    togglePartnerMark('c-stub', '2026-09-19')
    expect(has()).toBe(true)
  })
})
