import type { Person } from './types'

/**
 * Выдуманные люди, на которых стоят экраны, пока нет сервера.
 *
 * Числа у них разные нарочно: карточка друга обязана выглядеть по-разному у того, кто идёт
 * четвёртый день, и у того, кто идёт год, — иначе верстку проверяют на одном случае из десяти.
 * Здесь же единственный человек с нулевой серией: строка «серия прервана» на чужом профиле — это
 * то, что приложение **не** должно говорить осуждающе, и увидеть её надо заранее.
 */
export const MOCK_PEOPLE: Person[] = [
  { id: 'p-lena', handle: 'lena_k', name: 'Лена', daysOnRoad: 214, habitCount: 4, currentStreak: 31 },
  { id: 'p-anton', handle: 'anton', name: 'Антон Кузнецов', daysOnRoad: 12, habitCount: 1, currentStreak: 12 },
  { id: 'p-marina', handle: 'marina_dev', name: 'Марина', daysOnRoad: 366, habitCount: 6, currentStreak: 0 },
  { id: 'p-oleg', handle: 'oleg_run', name: 'Олег', daysOnRoad: 68, habitCount: 2, currentStreak: 9 },
  { id: 'p-dasha', handle: 'dasha', name: 'Даша', daysOnRoad: 4, habitCount: 3, currentStreak: 4 },
  { id: 'p-kirill', handle: 'kirill_p', name: 'Кирилл', daysOnRoad: 97, habitCount: 2, currentStreak: 21 },
  { id: 'p-nastya', handle: 'nastya_way', name: 'Настя', daysOnRoad: 33, habitCount: 5, currentStreak: 3 },
  { id: 'p-timur', handle: 'timur', name: 'Тимур', daysOnRoad: 151, habitCount: 3, currentStreak: 44 },
]

/**
 * Кто с кем дружит **у них**. Настоящий сервер знает это из своего графа; здесь граф написан
 * руками, потому что без него «общие друзья» нечем посчитать, а строка, которой не бывает видно,
 * не проверена.
 *
 * Связи односторонние в записи, но читаются как взаимные: список для человека — это все, кого он
 * знает. Вторая половина каждой пары здесь не дублируется, чтобы правка не разъезжалась сама с
 * собой; складывает обе стороны `circleOf`.
 */
const MOCK_CIRCLES: Record<string, string[]> = {
  'p-lena': ['p-oleg', 'p-dasha', 'p-timur'],
  'p-anton': ['p-oleg', 'p-kirill'],
  'p-marina': ['p-nastya', 'p-timur', 'p-dasha'],
  'p-oleg': ['p-kirill'],
  'p-dasha': ['p-nastya'],
}

/** Все, кого знает этот человек, с обеих сторон записи. */
export function circleOf(personId: string): string[] {
  const out = new Set(MOCK_CIRCLES[personId] ?? [])
  for (const [id, friends] of Object.entries(MOCK_CIRCLES)) {
    if (friends.includes(personId)) out.add(id)
  }
  return [...out]
}
