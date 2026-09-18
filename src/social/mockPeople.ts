import type { Person, PersonHabit } from './types'

/**
 * Их привычки: значок, название, набранные дни. Ступень отсюда не хранится — её считает лестница.
 *
 * Дни подобраны так, чтобы на витрине встретилась каждая ступень и **пустая медаль тоже**: у Даши
 * четвёртый день пути, и ни одна её привычка ещё не взяла первую. Полка человека, начавшего вчера,
 * — это то, что увидит первый же приглашённый друг, и выглядеть она должна не как поломка.
 */
const MOCK_HABITS: Record<string, [icon: string, title: string, days: number][]> = {
  'p-lena': [
    ['🏃', 'Бег 5 км', 188],
    ['🧘', 'Медитация', 96],
    ['📘', 'Английский', 40],
    ['✍️', 'Дневник', 12],
  ],
  'p-anton': [['💪', 'Зарядка', 12]],
  'p-marina': [
    ['📘', 'Английский', 366],
    ['🤸', 'Растяжка', 210],
    ['📚', 'Чтение', 180],
    ['💧', 'Вода', 120],
    ['🏃', 'Бег', 64],
    ['🌅', 'Ранний подъём', 9],
  ],
  'p-oleg': [
    ['🏃', 'Пробежка', 68],
    ['🤸', 'Турник', 30],
  ],
  'p-dasha': [
    ['💧', 'Вода', 4],
    ['📚', 'Читать', 4],
    ['🌙', 'Телефон не в кровать', 3],
  ],
  'p-kirill': [
    ['🎸', 'Гитара', 97],
    ['💪', 'Пресс', 21],
  ],
  'p-nastya': [
    ['🧘', 'Медитация', 33],
    ['📘', 'Английский', 28],
    ['🤸', 'Планка', 21],
    ['💧', 'Вода', 14],
    ['✍️', 'Дневник', 5],
  ],
  'p-timur': [
    ['🏊', 'Плавание', 151],
    ['📚', 'Чтение', 90],
    ['🇩🇪', 'Немецкий', 44],
  ],
}

function habitsOf(personId: string): PersonHabit[] {
  return (MOCK_HABITS[personId] ?? []).map(([icon, title, days], i) => ({
    id: `${personId}-h${i + 1}`,
    icon,
    title,
    days,
  }))
}

/**
 * Выдуманные люди, на которых стоят экраны, пока нет сервера.
 *
 * Числа у них разные нарочно: карточка друга обязана выглядеть по-разному у того, кто идёт
 * четвёртый день, и у того, кто идёт год, — иначе верстку проверяют на одном случае из десяти.
 * Здесь же единственный человек с нулевой серией: строка «серия прервана» на чужом профиле — это
 * то, что приложение **не** должно говорить осуждающе, и увидеть её надо заранее.
 */
// `habitCount` считается по самому списку, а не пишется рядом с ним: два места, отвечающие на
// «сколько у него привычек», однажды разойдутся — и плитка скажет «4», пока на полке стоит три.
export const MOCK_PEOPLE: Person[] = (
  [
    { id: 'p-lena', handle: 'lena_k', name: 'Лена', daysOnRoad: 214, currentStreak: 31 },
    { id: 'p-anton', handle: 'anton', name: 'Антон Кузнецов', daysOnRoad: 12, currentStreak: 12 },
    { id: 'p-marina', handle: 'marina_dev', name: 'Марина', daysOnRoad: 366, currentStreak: 0 },
    { id: 'p-oleg', handle: 'oleg_run', name: 'Олег', daysOnRoad: 68, currentStreak: 9 },
    { id: 'p-dasha', handle: 'dasha', name: 'Даша', daysOnRoad: 4, currentStreak: 4 },
    { id: 'p-kirill', handle: 'kirill_p', name: 'Кирилл', daysOnRoad: 97, currentStreak: 21 },
    { id: 'p-nastya', handle: 'nastya_way', name: 'Настя', daysOnRoad: 33, currentStreak: 3 },
    { id: 'p-timur', handle: 'timur', name: 'Тимур', daysOnRoad: 151, currentStreak: 44 },
  ] satisfies Person[]
).map((person) => {
  const habits = habitsOf(person.id)
  return { ...person, habitCount: habits.length, habits }
})

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
