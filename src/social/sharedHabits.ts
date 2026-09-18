import type { AppState } from '../domain/models'
import type { PersonHabit } from './types'

/**
 * То, что вы держите оба, — одной строкой и **без единого числа**.
 *
 * Это первая вещь на чужом профиле, которая говорит «вы», а не «он», и ради неё стоило заводить
 * друзей вообще: «Бег» в этом списке — повод написать, а не повод посчитаться. Здесь же будущий
 * кружок: общая привычка, которую закрывают вдвоём, вырастет ровно из этого места.
 *
 * Чего тут нет намеренно — **дней**. «У него 188, у тебя 41» про одну и ту же привычку — это лига
 * на двоих в чистом виде, а линейка из ideas.md отвечает на неё «да, чужое существование делает
 * тебе хуже про уже прожитый день». Его дни, если они кому-то нужны, стоят выше, на его полке, — и
 * стоят одни.
 *
 * Совпадение — **по названию**, и только точное. «Бег 5 км» и «Пробежка» — одна привычка для
 * человека и разные строки для нас, но угадывать здесь дороже, чем промолчать: приложение, сказавшее
 * «вы оба» про две разные вещи, сказало это доверительным голосом и ошиблось. Промах просто не
 * показывает строку, и никто не узнал, что она могла быть.
 */
export interface SharedHabit {
  /** Ключ списка. Берётся у него: список строится по его привычкам. */
  id: string
  /** **Твоё** название и твой значок: своё слово человек узнаёт, чужое читает. */
  title: string
  icon?: string
}

function normalize(title: string): string {
  return title.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ')
}

export function sharedHabits(state: AppState, theirs: PersonHabit[] | undefined): SharedHabit[] {
  if (theirs === undefined || theirs.length === 0) return []

  const mine = new Map<string, { title: string; icon?: string }>()
  for (const goal of state.user.goals) {
    if (goal.archived) continue
    for (const task of goal.tasks) mine.set(normalize(task.title), { title: task.title, icon: task.icon })
  }

  const out: SharedHabit[] = []
  for (const habit of theirs) {
    const match = mine.get(normalize(habit.title))
    if (match !== undefined) out.push({ id: habit.id, title: match.title, icon: match.icon ?? habit.icon })
  }
  return out
}
