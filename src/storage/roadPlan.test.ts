import { describe, expect, it } from 'vitest'
import type { AppState, Day, TaskTemplate } from '../domain/models'
import { serializeEnvelope } from './migrate'
import { fingerprintOf, isEmptyRoad, localDateOf, planSync, roadSummary, type RoadStamp } from './roadPlan'

function makeState({ days = 0, tasks = 0 }: { days?: number; tasks?: number }): AppState {
  const templates: TaskTemplate[] = Array.from({ length: tasks }, (_, i) => ({
    id: `t${i}`,
    goalId: 'g1',
    title: `Привычка ${i}`,
    icon: '🏃',
    createdDate: '2026-09-01',
    cycleStartDate: '2026-09-01',
    milestonesReached: [],
  }) as unknown as TaskTemplate)

  const history: Day[] = Array.from({ length: days }, (_, i) => ({
    id: `2026-09-${String(i + 1).padStart(2, '0')}`,
    date: `2026-09-${String(i + 1).padStart(2, '0')}`,
    tasks: [],
    completionRate: 1,
    pathAngleDelta: 0,
    columnDriftX: 0,
    colorTier: 'gold',
    frozen: false,
  }) as unknown as Day)

  return {
    user: {
      id: 'u1',
      name: 'Сергей',
      timezone: 'Europe/Moscow',
      notificationsEnabled: true,
      freezesRemaining: 2,
      freezesRefilledMonth: '2026-09',
      goals: [{ id: 'g1', title: 'Цель', tasks: templates, archived: false }],
    },
    days: history,
  } as unknown as AppState
}

const REMOTE: RoadStamp = { version: 5, updatedAt: '2026-09-18T12:00:00Z' }

describe('пустое устройство', () => {
  it('пусто — это и без дней, и без привычек', () => {
    expect(isEmptyRoad(makeState({}))).toBe(true)
  })

  it('заведённая привычка делает устройство непустым, даже если дней ещё нет', () => {
    // Онбординг заводит привычку раньше, чем на дороге появится первый день. Если считать такое
    // устройство пустым, человек, только что расписавший себе путь, получил бы вместо него
    // молча скачанную чужую историю.
    expect(isEmptyRoad(makeState({ tasks: 1 }))).toBe(false)
  })

  it('дни делают устройство непустым сами по себе', () => {
    expect(isEmptyRoad(makeState({ days: 3 }))).toBe(false)
  })
})

describe('план синхронизации', () => {
  it('в аккаунте пусто, дома история — выгрузить', () => {
    expect(planSync({ localEmpty: false, remote: null, agreed: false })).toEqual({ kind: 'upload' })
  })

  it('пусто с обеих сторон — не делать ничего', () => {
    expect(planSync({ localEmpty: true, remote: null, agreed: false })).toEqual({ kind: 'idle' })
  })

  it('устройство пустое — забрать молча, даже не договариваясь', () => {
    expect(planSync({ localEmpty: true, remote: REMOTE, agreed: false })).toEqual({ kind: 'download' })
  })

  it('истории с обеих сторон — спросить, а не выбрать', () => {
    // Главное правило всего файла: «последняя запись побеждает» молча — это способ однажды
    // стереть человеку месяц. Ни `download`, ни `upload` здесь не годятся.
    expect(planSync({ localEmpty: false, remote: REMOTE, agreed: false })).toEqual({ kind: 'ask' })
  })

  it('после ответа человека дорога уходит сама', () => {
    expect(planSync({ localEmpty: false, remote: REMOTE, agreed: true })).toEqual({ kind: 'upload' })
  })

  it('запись новее сборки останавливает обе стороны', () => {
    const newer = planSync({ localEmpty: false, remote: { version: 9, updatedAt: REMOTE.updatedAt }, agreed: true, currentVersion: 5 })
    // Не `ask`: предложить «оставить мою» значило бы предложить стереть запись, которую эта
    // сборка не умеет прочитать, — то же правило, по которому `readEnvelope` отказывается читать
    // запись из будущего, а не сбрасывает её.
    expect(newer.kind).toBe('blocked')
  })

  it('на пустом устройстве запись из будущего тоже не скачивается', () => {
    const newer = planSync({ localEmpty: true, remote: { version: 9, updatedAt: REMOTE.updatedAt }, agreed: false, currentVersion: 5 })
    expect(newer.kind).toBe('blocked')
  })

  it('договорённость не отменяет вопроса, когда устройство опустело', () => {
    // Данные сайта очистили, а согласие осталось: это ровно тот случай, ради которого всё
    // затевалось, и история должна приехать обратно.
    expect(planSync({ localEmpty: true, remote: REMOTE, agreed: true })).toEqual({ kind: 'download' })
  })
})

describe('чем историю называют в вопросе', () => {
  it('считает дни и последнее число', () => {
    expect(roadSummary(makeState({ days: 3 }))).toEqual({ dayCount: 3, lastDate: '2026-09-03' })
  })

  it('у пустой истории последнего числа нет', () => {
    expect(roadSummary(makeState({}))).toEqual({ dayCount: 0, lastDate: null })
  })
})

describe('отпечаток уехавшей копии', () => {
  it('у той же истории тот же', () => {
    const text = serializeEnvelope(makeState({ days: 3, tasks: 2 }))
    expect(fingerprintOf(text)).toBe(fingerprintOf(text))
  })

  it('меняется от одной правки', () => {
    // Иначе запуск после правки решил бы, что выгружать нечего, и копия осталась бы вчерашней.
    const before = serializeEnvelope(makeState({ days: 3, tasks: 2 }))
    const after = serializeEnvelope(makeState({ days: 4, tasks: 2 }))
    expect(fingerprintOf(after)).not.toBe(fingerprintOf(before))
  })

  it('различает даже перестановку двух букв', () => {
    expect(fingerprintOf('{"a":1,"b":2}')).not.toBe(fingerprintOf('{"b":1,"a":2}'))
  })
})

describe('дата копии', () => {
  it('читается в зоне того, кто смотрит', () => {
    // Полдень UTC — единственное время, которое в любой зоне остаётся тем же числом; сам порок,
    // от которого стоит эта функция, виден на вечерних отметках: `toISOString` назвал бы их вчера.
    expect(localDateOf('2026-09-18T12:00:00Z')).toBe('2026-09-18')
  })
})
