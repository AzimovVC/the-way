import type { AppState } from './models'
import type { PartOfDay } from './partOfDay'
import { getLogicalToday } from './pathEngine'

/**
 * Разовое дело — то, что делают один раз: забрать посылку, позвонить в банк, вынести ёлку.
 *
 * **Дело не касается дороги. Ни при каких обстоятельствах.** Оно не попадает в `day.tasks`, не
 * входит в `completionRate`, не двигает цвет дня, угол, серию, ранг и веху. Причина простая: если
 * бы входило, то человек, добавивший в среду «забрать посылку» и не забравший, увидел бы, что
 * дорога пошла вниз. Приложение осудило бы его за почту. Дорога — запись о привычках, и чужому
 * делу в этой записи места нет.
 *
 * Отсюда же и то, чего у дела **нет**: очков, уровня, валюты. Награда за дело — сама вычеркнутая
 * строка и маленький знак на круге дня: «в этот день ты ещё и разобрался с чем-то». Это запись, а
 * не счёт, и накрутить её нечем — десять выдуманных дел дадут ровно один знак. Любая валюта здесь
 * была бы второй лестницей рядом с уровнем привычки, причём лестницей, чьи ступени печатает сам
 * пользователь, — а лицензия уровня ровно в том, что его валюта время и время не обманешь.
 */
export interface Chore {
  id: string
  title: string
  /** Эмодзи, выбранная руками. Без неё значок подбирается по названию, как у привычки. */
  icon?: string
  /** День, на который дело поставлено, YYYY-MM-DD. */
  date: string
  partOfDay?: PartOfDay
  /**
   * Логический день, в который дело сделано, и точный момент. День — для знака на круге; момент
   * оставлен по той же причине, по какой он есть у отметки привычки: из ISO в чужой зоне день
   * потом не восстановить.
   */
  doneOn: string | null
  doneAt: string | null
}

export interface NewChoreInput {
  title: string
  date: string
  icon?: string
  partOfDay?: PartOfDay
}

const choresOf = (state: AppState): Chore[] => state.chores ?? []

/**
 * Дела, которые видит карточка **сегодняшнего** дня.
 *
 * Невыполненное дело из прошлого остаётся в списке и показывается здесь — с датой, на которую его
 * ставили. Это список, а не приговор: дело, тихо утонувшее во вчера, потеряно, а показанное —
 * просто ещё не сделано. Никакого счёта «просрочено» при этом нет и быть не может, иначе список
 * начнёт делать ровно то, от чего дорога закрыта.
 */
export function choresForToday(state: AppState, today: string): Chore[] {
  return choresOf(state)
    .filter((chore) => (chore.doneOn === null ? chore.date <= today : chore.doneOn === today))
    .sort(byDateThenTitle)
}

/**
 * Дела, которые видит вкладка привычек: всё несделанное, включая поставленное на будущее, и
 * сделанное сегодня.
 *
 * Будущее тут обязано быть видно, и это прямое следствие того, что дело можно поставить на любой
 * день. Дело, назначенное в понедельник на субботу, в карточке дня появится только в субботу, и
 * пять дней человек не видел бы вещь, которую сам записал. Дорога от этого списка по-прежнему
 * ничего не узнаёт.
 *
 * Сделанное показывается только сегодняшнее: вчерашнее вычеркнутое дело — это уже запись о
 * прожитом дне, и её место на дороге, а не в списке того, что предстоит.
 */
export function upcomingChores(state: AppState, today: string): Chore[] {
  return choresOf(state)
    .filter((chore) => (chore.doneOn === null ? true : chore.doneOn === today))
    .sort(byDateThenTitle)
}

/** Дела, привязанные к этому дню или сделанные в нём, — то, что показывает карточка прошлого дня. */
export function choresOnDay(state: AppState, date: string): Chore[] {
  return choresOf(state)
    .filter((chore) => chore.date === date || chore.doneOn === date)
    .sort(byDateThenTitle)
}

function byDateThenTitle(a: Chore, b: Chore): number {
  return a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
}

/** Дни, в которые хоть одно дело было сделано, — для знака на круге. */
export function daysWithDoneChores(state: AppState): Set<string> {
  const dates = new Set<string>()
  for (const chore of choresOf(state)) if (chore.doneOn) dates.add(chore.doneOn)
  return dates
}

export function addChore(state: AppState, input: NewChoreInput): AppState {
  const title = input.title.trim()
  if (!title) return state
  const chore: Chore = {
    id: crypto.randomUUID(),
    title,
    icon: input.icon,
    date: input.date,
    partOfDay: input.partOfDay,
    doneOn: null,
    doneAt: null,
  }
  // `days` не трогается и applyPathGeometry не зовётся: дело ничего не меняет в том, о чём день
  // спрашивает, — значит и пересчитывать геометрию не из чего.
  return { ...state, chores: [...choresOf(state), chore] }
}

/**
 * Отмечает дело сделанным — или снимает отметку.
 *
 * Сделанное записывается на **сегодня**, а не на тот день, на который дело ставили: знак на круге
 * означает «в этот день ты разобрался с делом», и поставить его во вчера значило бы дорисовать
 * событие в день, который уже прожит.
 */
export function toggleChore(state: AppState, choreId: string, now: Date = new Date()): AppState {
  const today = getLogicalToday(now)
  const chores = choresOf(state).map((chore) => {
    if (chore.id !== choreId) return chore
    return chore.doneOn === null
      ? { ...chore, doneOn: today, doneAt: now.toISOString() }
      : { ...chore, doneOn: null, doneAt: null }
  })
  return { ...state, chores }
}

export function removeChore(state: AppState, choreId: string): AppState {
  return { ...state, chores: choresOf(state).filter((chore) => chore.id !== choreId) }
}
