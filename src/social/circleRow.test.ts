import { describe, expect, it } from 'vitest'
import { toCircle, toCircleInvite, toCirclesView, toNotice, toNotices } from './circleRow'

/**
 * Разбор ответа сервера про пару. Проверяется не «как раскладываются колонки» — это видно
 * глазами, — а то, что происходит с ответом, в котором чего-то нет: миграция уезжает раньше
 * сборки, а сборка живёт на телефоне неделями.
 *
 * Отдельно и главное: **строка, которую нельзя показать, выбрасывается целиком**. Кружок без
 * второго человека, отметка без дня, сообщение незнакомого рода — всё это не «почти данные», а
 * приглашение нарисовать пустую строку там, где человек ждёт новость.
 */

const LENA = { id: 'u1', handle: 'lena', name: 'Лена' }

const CIRCLE = {
  id: 'c1',
  title: 'Пробежка',
  icon: '🏃',
  weekdays: [0, 2, 4],
  timezone: 'Europe/Kyiv',
  started_on: '2026-09-01',
  task_id: 'task-mine',
  partner: { person: LENA, excused: ['2026-09-03'] },
  marks: [
    { circle_id: 'c1', person_id: 'u1', date: '2026-09-02', done_at: '2026-09-02T07:10:00.000Z' },
    { circle_id: 'c1', person_id: 'me', date: '2026-09-02', done_at: '2026-09-02T06:00:00.000Z' },
  ],
}

describe('toCircle', () => {
  it('раскладывает колонки в поля', () => {
    const circle = toCircle(CIRCLE)
    expect(circle).not.toBeNull()
    expect(circle?.title).toBe('Пробежка')
    expect(circle?.taskId).toBe('task-mine')
    expect(circle?.weekdays).toEqual([0, 2, 4])
    expect(circle?.partner.person.handle).toBe('lena')
    expect(circle?.partner.excused).toEqual(['2026-09-03'])
    expect(circle?.marks).toHaveLength(2)
  })

  it('живой кружок приезжает без даты выхода', () => {
    expect(toCircle(CIRCLE)?.leftAt).toBeUndefined()
  })

  it('закрытый приезжает вместе с живыми и несёт дату выхода', () => {
    const circle = toCircle({ ...CIRCLE, left_at: '2026-09-20T10:00:00.000Z' })
    expect(circle?.leftAt).toBe('2026-09-20T10:00:00.000Z')
    // Отметки при этом на месте: без них прощальной карточке нечего считать.
    expect(circle?.marks).toHaveLength(2)
  })

  it('без второго человека кружка нет: строка «кружок с кем-то» хуже её отсутствия', () => {
    expect(toCircle({ ...CIRCLE, partner: { excused: [] } })).toBeNull()
  })

  it('без ключа привычки кружка нет: его нечем привязать к строке дня', () => {
    expect(toCircle({ ...CIRCLE, task_id: null })).toBeNull()
  })

  it('пустое расписание — это «каждый день», а не пустой список', () => {
    expect(toCircle({ ...CIRCLE, weekdays: [] })?.weekdays).toBeUndefined()
    expect(toCircle({ ...CIRCLE, weekdays: null })?.weekdays).toBeUndefined()
  })

  it('день недели вне недели выбрасывается, а кружок остаётся', () => {
    expect(toCircle({ ...CIRCLE, weekdays: [0, 9, 4] })?.weekdays).toEqual([0, 4])
  })

  it('отметка без дня выбрасывается, остальные остаются', () => {
    const circle = toCircle({
      ...CIRCLE,
      marks: [{ person_id: 'u1', date: 'позавчера' }, { person_id: 'u1', date: '2026-09-02' }],
    })
    expect(circle?.marks).toHaveLength(1)
  })

  it('отметка без часа остаётся: день важнее часа, и час ничего не судит', () => {
    const circle = toCircle({ ...CIRCLE, marks: [{ person_id: 'u1', date: '2026-09-02' }] })
    expect(circle?.marks).toHaveLength(1)
    expect(circle?.marks[0].doneAt).toContain('2026-09-02')
  })

  it('мусор среди освобождённых дней не уносит остальные', () => {
    const circle = toCircle({
      ...CIRCLE,
      partner: { person: LENA, excused: ['2026-09-03', 42, 'вчера'] },
    })
    expect(circle?.partner.excused).toEqual(['2026-09-03'])
  })
})

describe('toCircleInvite', () => {
  const INVITE = {
    id: 'i1',
    title: 'Пробежка',
    weekdays: [0, 2, 4],
    timezone: 'Europe/Kyiv',
    person: LENA,
  }

  it('пришедшее приглашение приезжает без ключа привычки', () => {
    const invite = toCircleInvite(INVITE)
    expect(invite?.title).toBe('Пробежка')
    expect(invite?.taskId).toBeUndefined()
  })

  it('отправленное несёт ключ своей привычки: зовут своей, а не выдуманным названием', () => {
    expect(toCircleInvite({ ...INVITE, task_id: 'task-mine' })?.taskId).toBe('task-mine')
  })

  it('без человека приглашения нет: обе кнопки под безымянной строкой ведут в никуда', () => {
    expect(toCircleInvite({ ...INVITE, person: null })).toBeNull()
  })
})

describe('toCirclesView', () => {
  it('пропавший список — это пустой список, а не запертый экран', () => {
    expect(toCirclesView(null)).toEqual({ circles: [], incoming: [], outgoing: [] })
    expect(toCirclesView({ circles: 'нет' })).toEqual({ circles: [], incoming: [], outgoing: [] })
  })

  it('испорченный кружок выбрасывается, соседний остаётся', () => {
    const view = toCirclesView({ circles: [CIRCLE, { id: 'c2' }] })
    expect(view.circles).toHaveLength(1)
  })
})

describe('toNotice', () => {
  const LEFT = {
    id: 'n1',
    kind: 'circle_left',
    payload: { circle_id: 'c1', title: 'Пробежка', partner_name: 'Лена' },
    created_at: '2026-09-20T10:00:00.000Z',
  }

  it('раскладывает сообщение о выходе', () => {
    const notice = toNotice(LEFT)
    expect(notice?.kind).toBe('circle_left')
    expect(notice?.title).toBe('Пробежка')
    expect(notice?.partnerName).toBe('Лена')
  })

  it('незнакомый род выбрасывается: нарисовать его нечем', () => {
    expect(toNotice({ ...LEFT, kind: 'что-то новое' })).toBeNull()
  })

  it('без названия сообщения нет: прощаться с безымянной привычкой не о чем', () => {
    expect(toNotice({ ...LEFT, payload: { circle_id: 'c1' } })).toBeNull()
  })

  it('пустое имя — законный ответ: человек вправе не называть себя', () => {
    expect(toNotice({ ...LEFT, payload: { ...LEFT.payload, partner_name: null } })?.partnerName).toBe('')
  })

  it('список переживает испорченную строку', () => {
    expect(toNotices([LEFT, { id: 'n2' }, null])).toHaveLength(1)
  })
})
