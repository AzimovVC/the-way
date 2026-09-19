import type { AppState } from '../domain/models'
import { clearCircles, loadCircles } from '../social/circleStore'
import { seedMockLinks } from '../social/mockClient'
import { seedStubCircle } from '../social/mockCircles'
import { clearSocial, loadSocial } from '../social/socialStore'

/**
 * Связи, которых человек не делал, — чтобы социальные экраны можно было увидеть до сервера.
 *
 * Набор не случайный: в нём стоит по человеку на каждое состояние ряда, иначе половина экрана
 * живёт только в голове того, кто его писал. Входящая заявка без входящей заявки не проверяется
 * никак, а увидеть её иначе нельзя вовсе — она приходит **оттуда**, и местной кнопки, которая её
 * создаёт, у настоящего клиента не будет и быть не может.
 *
 * Двое остаются ни с кем не связанными нарочно: на них живут поиск, предложения и чужой профиль с
 * кнопкой «Позвать в друзья». Засеянный целиком каталог оставил бы эти три экрана пустыми.
 *
 * У Лены и Марины при этом есть общие с тобой друзья ([mockPeople.ts](../social/mockPeople.ts)),
 * потому что строка общих друзей — единственное число про чужого человека, которое здесь законно,
 * и посмотреть на неё надо на настоящем пересечении, а не на выдуманном одном имени.
 */
const SEED = [
  { personId: 'p-lena', state: 'friends' },
  { personId: 'p-oleg', state: 'friends' },
  { personId: 'p-nastya', state: 'friends' },
  { personId: 'p-dasha', state: 'incoming' },
  { personId: 'p-timur', state: 'incoming' },
  { personId: 'p-kirill', state: 'outgoing' },
] as const

export function seedPeople(): void {
  clearSocial()
  seedMockLinks([...SEED])
}

export function clearPeople(): void {
  clearSocial()
}

/** Что лежит в снимке прямо сейчас — по состояниям, в том же порядке, что и на экране друзей. */
export function countPeople(): { friends: number; incoming: number; outgoing: number; blocked: number } {
  const links = Object.values(loadSocial().links)
  return {
    friends: links.filter((s) => s === 'friends').length,
    incoming: links.filter((s) => s === 'incoming').length,
    outgoing: links.filter((s) => s === 'outgoing').length,
    blocked: links.filter((s) => s === 'blocked').length,
  }
}

/**
 * Посадить кружок на **первую живую привычку** этого устройства.
 *
 * Привычка настоящая нарочно: кружок встаёт в её строку дня, и посаженный рядом с выдуманной
 * привычкой он показал бы карточку дня, в которой строки кружка нет, — то есть ровно ту ошибку,
 * ради которой заглушку и рисуют.
 *
 * Здесь же сеется и входящее приглашение: согласие второго приходит **оттуда**, и местной кнопки,
 * которая его создаёт, у настоящего клиента не будет и быть не может — как не будет её и у
 * входящей заявки в друзья.
 */
export function seedCircle(state: AppState): boolean {
  const task = state.user.goals.find((goal) => !goal.archived)?.tasks[0]
  const today = state.days[state.days.length - 1]?.date
  if (task === undefined || today === undefined) return false
  seedStubCircle(task.id, today, state.user.timezone)
  return true
}

export function clearCirclesSeed(): void {
  clearCircles()
}

/** Что лежит в снимке кружков прямо сейчас. */
export function countCircles(): { circles: number; incoming: number; outgoing: number } {
  const snapshot = loadCircles()
  return {
    circles: snapshot.circles.length,
    incoming: snapshot.incoming.length,
    outgoing: snapshot.outgoing.length,
  }
}
