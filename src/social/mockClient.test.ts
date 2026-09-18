import { beforeEach, describe, expect, it } from 'vitest'
import { createMockClient, seedMockLinks } from './mockClient'
import { MOCK_PEOPLE } from './mockPeople'
import { clearSocial, loadSocial } from './socialStore'
import { inviteLink } from './client'

/**
 * Хранилища в тестовой среде нет — слой обязан это пережить, поэтому половина проверок здесь идёт
 * без диска. Там, где проверяется сама запись, диск подставляется вручную.
 */
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

const LENA = MOCK_PEOPLE[0].id

describe('заглушка соцслоя', () => {
  beforeEach(() => {
    installStorage()
    clearSocial()
  })

  it('начинает без друзей и без заявок', async () => {
    const client = createMockClient(0)
    expect(await client.load()).toEqual({ friends: [], incoming: [], outgoing: [] })
  })

  it('отправленная заявка встаёт в исходящие, а не в друзья', async () => {
    const client = createMockClient(0)
    const view = await client.request(LENA)
    expect(view.outgoing.map((p) => p.id)).toEqual([LENA])
    expect(view.friends).toEqual([])
  })

  it('заявка навстречу пришедшей сразу даёт дружбу, а не вторую заявку', async () => {
    seedMockLinks([{ personId: LENA, state: 'incoming' }])
    const client = createMockClient(0)
    const view = await client.request(LENA)
    expect(view.friends.map((p) => p.id)).toEqual([LENA])
    expect(view.outgoing).toEqual([])
  })

  it('принятая заявка делает друга, удаление уводит его совсем', async () => {
    const client = createMockClient(0)
    expect((await client.accept(LENA)).friends.map((p) => p.id)).toEqual([LENA])
    expect((await client.remove(LENA)).friends).toEqual([])
  })

  it('переживает перезапуск: связи лежат на диске', async () => {
    await createMockClient(0).request(LENA)
    const fresh = createMockClient(0)
    expect((await fresh.load()).outgoing.map((p) => p.id)).toEqual([LENA])
    expect(loadSocial().people[LENA].name).toBe('Лена')
  })

  it('ищет по началу ника и на пустой запрос молчит', async () => {
    const client = createMockClient(0)
    expect(await client.search('')).toEqual([])
    expect((await client.search('@lena_k')).map((a) => a.person.id)).toEqual([LENA])
    expect((await client.search('len')).map((a) => a.person.id)).toEqual([LENA])
  })

  it('по имени не ищет вовсе: имя узнают, а не набирают', async () => {
    const client = createMockClient(0)
    expect(await client.search('Лена')).toEqual([])
  })

  it('отдаёт поиску не только человека, но и отношение к нему', async () => {
    const client = createMockClient(0)
    await client.request(LENA)
    expect((await client.search('lena_k'))[0].state).toBe('outgoing')
  })

  it('не предлагает тех, с кем уже связан', async () => {
    const client = createMockClient(0)
    await client.request(LENA)
    expect((await client.suggestions()).some((a) => a.person.id === LENA)).toBe(false)
  })

  it('чужой профиль ищется по нику, незнакомый ник даёт null', async () => {
    const client = createMockClient(0)
    expect((await client.profile('oleg_run'))?.person.name).toBe('Олег')
    expect(await client.profile('никого')).toBeNull()
  })

  it('общими считает только тех, с кем дружите оба', async () => {
    const client = createMockClient(0)
    // Олег есть в круге Лены, Настя — нет. Пока с Олегом не дружишь ты, общего друга нет.
    expect((await client.profile('lena_k'))?.mutual).toEqual([])

    await client.accept('p-oleg')
    await client.accept('p-nastya')

    const mutual = (await client.profile('lena_k'))?.mutual ?? []
    expect(mutual.map((p) => p.id)).toEqual(['p-oleg'])
  })

  it('число привычек считается по самой полке', async () => {
    const client = createMockClient(0)
    const person = (await client.profile('lena_k'))!.person
    // Два места, отвечающих на «сколько у него привычек», однажды разъедутся: плитка скажет «4»,
    // пока на полке стоит три. Здесь второе место выведено из первого, и тест держит это свойство.
    expect(person.habits?.length).toBe(person.habitCount)
  })
})

describe('ссылка-приглашение', () => {
  it('несёт ник и ничего не спрашивает у сети', () => {
    expect(inviteLink('sergey')).toMatch(/\/u\/sergey$/)
  })
})
