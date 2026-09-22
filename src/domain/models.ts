import type { PartOfDay } from './partOfDay'
import type { RankId } from './ranks'

export interface User {
  id: string
  name: string
  /**
   * Имя для чужих глаз — `@ник`, см. [handle.ts](./handle.ts). Необязательное: у записей,
   * сделанных до друзей, его нет, и до тех пор им отвечает подсказка, подобранная по имени.
   * Занятость ника проверить некому, пока нет сервера, поэтому здесь лежит только форма.
   */
  handle?: string
  timezone: string
  /**
   * Видит ли витрину привычек тот, кто тебе ещё не друг.
   *
   * Отсутствует — значит «нет», и умолчание выбрано в эту сторону нарочно: название привычки —
   * самое личное, что в этом приложении есть («Не пить», «Таблетки»), а ник человек даёт один раз,
   * и ссылку с ним пересылают дальше без него. Умолчание, о котором не подумали, обязано быть тем,
   * о чём потом не жалеют.
   *
   * Правило держит **та сторона**: она не присылает полку, а не экран её прячет. Присланная и
   * ненарисованная полка — это утечка, до которой один тап в инструментах разработчика.
   */
  habitsPublic?: boolean
  notificationsEnabled: boolean
  freezesRemaining: number
  /** YYYY-MM of the last monthly freeze top-up, so it only happens once per month. */
  freezesRefilledMonth: string
  goals: Goal[]
}

export interface Goal {
  id: string
  title: string
  tasks: TaskTemplate[]
  archived: boolean
  /**
   * The moment the person made this — a real instant, not a date, and that is the whole point.
   *
   * It is what lets the feed say «2 часа назад» under a habit instead of «Сегодня». Absent on
   * every goal made before this existed, and the feed falls back to days for those, which is also
   * what it does for events nobody authored: a rung, a road mark and a return are **derived** from
   * history and have a day but never a minute. Optional, so no migration step — same as `weekdays`.
   */
  createdAt?: string
}

export interface TaskTemplate {
  id: string
  goalId: string
  title: string
  /**
   * Monday-first weekday indices (0..6) the task is asked for. Absent or empty means every day,
   * which is what every task created before schedules existed must keep meaning.
   */
  weekdays?: number[]
  /**
   * How long the person guessed they would keep this up, from `PREDICTION_CHOICES`. Absent when
   * they skipped the question, and for every habit made before it existed.
   *
   * It is a word given at a moment, not a setting: the editor does not offer it for a habit that
   * is already running, because a guess revised halfway is no longer a guess. Reaching it is never
   * required and can never fail — the day count only ever gets there late, never not at all.
   */
  predictedDays?: number
  /**
   * When inside the day this is meant to happen — see `partOfDay.ts`. Absent means «когда угодно»,
   * which is what every habit made before this existed must keep meaning.
   *
   * It orders the day's list and nothing else. Nothing that judges a day — its colour, its angle,
   * the rank, the streak — is allowed to read it, for the reason written over the type.
   */
  partOfDay?: PartOfDay
  /**
   * One emoji the person picked for this habit. Absent means the app keeps guessing a glyph from
   * the title (`taskIcon.ts`), which is what it did before and what a habit made in ten seconds
   * still gets.
   */
  icon?: string
  /**
   * True when the habit is something the person is **quitting** — «Не курить», «Без сахара» —
   * rather than something they do. The mark then means «сегодня удержался».
   *
   * This is a word, not a second set of rules. The day asks for it, counts it and walks it exactly
   * like any other habit: one binary mark, one row in `completionRate`, the same ladder. Nothing
   * that judges a day reads this field, and nothing may start to — a habit that counted differently
   * would put two kinds of gold day on one road.
   *
   * It does decide what the form stops asking. Weekdays and a part of the day are questions about
   * **when you do a thing**, and there is no such moment here: you can slip on any day and at any
   * hour. So a quitting habit is every day, with no time inside it, and the form does not offer a
   * choice that has only one honest answer.
   */
  quit?: boolean
  /**
   * True when this habit never leaves the phone — no feed event about it, no card on the shelf,
   * nothing about it in the numbers friends can see.
   *
   * Absent means shared, and that default is deliberate the other way round from `habitsPublic`:
   * the shelf is a part of the profile people arrive at on purpose, while a friend is someone the
   * person already chose. What this exists for is the handful of habits whose **name** is the
   * private thing — «Таблетки», «Не пить» — and for those one switch is cheaper than keeping the
   * whole social half of the app turned off.
   *
   * It says nothing about the day. The road, the colour, the rank and the streak never read it:
   * a quiet habit is asked for, counted and walked exactly like any other, and the only thing that
   * changes is who else hears about it.
   */
  private?: boolean
  /**
   * Where the habit sits in the day's list, inside its part of the day. One flat scale across every
   * goal, because the list a person reorders is the list they see in the day — and that one is not
   * grouped by goal.
   *
   * Absent on everything made before ordering existed; `taskOrder.ts` falls back to natural
   * position and writes real numbers onto all of them the first time anything is moved.
   */
  order?: number
  /** Date the day count starts from — the day the task was created. It never restarts. */
  cycleStartDate: string
}

/**
 * 'gray' means nothing was ever recorded for this day; 'rest' means the day asked nothing of you
 * — a planned day off or a spent freeze. Keeping them apart is the whole point: one is a hole in
 * the record, the other is the record saying everything is fine.
 */
export type ColorTier = 'gold' | 'green' | 'red' | 'gray' | 'rest'

/**
 * A change to what the day *asks of you*, stamped on the day it happened. The title is a
 * snapshot, not a lookup: a removed task's template is gone from the goal, so nothing else
 * in the state can still say what it was called.
 *
 * `rescheduled` is here for the same reason `added` is: narrowing «Пн Ср Пт» to «Пн Пт» moves the
 * bar every following day is judged against, and without the mark the stretch after it is
 * unreadable — a Wednesday that stopped being asked looks exactly like a Wednesday that was
 * skipped. A rename leaves no mark on purpose: it changes what the habit is called, not what the
 * day asks, and each past day already holds the name it was judged under right here.
 */
export interface TaskChange {
  taskId: string
  goalId: string
  title: string
  kind: 'added' | 'removed' | 'rescheduled'
  /** The moment it was done, for the feed's age line. See `Goal.createdAt`. */
  at?: string
}

export interface Day {
  id: string
  date: string
  tasks: DayTask[]
  completionRate: number
  pathAngleDelta: number
  columnDriftX: number
  colorTier: ColorTier
  frozen: boolean
  /** True when nothing was scheduled for this day at all — a planned day off, not a miss. */
  rest?: boolean
  /** Ids of goals that started contributing to the path as of this day, for the permanent "new goal appeared here" marker. */
  newGoalIds?: string[]
  /**
   * Ranks taken on this day, for the permanent mark on the road and for the shelf. `days` is the
   * rung that was crossed, which is what makes «Легенда · 3 года» readable years later without
   * asking the ladder to keep a name for every year. `at` is the moment the person was told, for
   * the feed's age line — see `Goal.createdAt`.
   */
  milestonesReached?: { taskId: string; goalId: string; rank: RankId; days: number; at?: string }[]
  /**
   * Guesses walked out on this day — «ты говорил, что продержишься месяц, и вот он». Stamped so it
   * is said once and never again: the day count can dip back under the number after a break, and
   * saying it a second time on the way back up would turn a warm moment into a loop.
   */
  predictionsMet?: { taskId: string; goalId: string; days: number }[]
  /** Tasks added to or dropped from the daily set on this day, for the permanent "the rules changed here" marker. */
  taskChanges?: TaskChange[]
}

/**
 * Строка дня: привычка, попавшая на день, и что с ней стало.
 *
 * Своего ключа у неё нет, и это не экономия поля. Строка дня — не вещь, которую человек назвал,
 * а производная: она появляется сама, когда привычка попала на день, и опознают её везде — в
 * вехах, во времени суток, в правке расписания — по паре «день + привычка». Случайный ключ рядом
 * с этой парой был бы вторым ответом на один вопрос, и второй ответ однажды разошёлся бы с первым:
 * два устройства, сделав из одной операции две строки, назвали бы их по-разному, а по паре это
 * одна и та же строка. То же правило, по которому ключ дня — его дата.
 */
export interface DayTask {
  taskTemplateId: string
  /** Ссылка на день, к которому строка принадлежит; переписывается вместе с его ключом. */
  dayId: string
  isDone: boolean
  skipped: boolean
  completedAt: string | null
  /**
   * Local wall-clock time of the mark, 'HH:mm' — the clock the person actually looked at.
   *
   * Optional, so nothing older breaks: completedAt alone is still readable, just in whatever zone
   * the browser is in now rather than the one the mark was made in. Recorded from here on because
   * a zone that was never written down cannot be recovered afterwards — a move or a trip would
   * quietly shift a whole history by hours.
   */
  completedLocal?: string
}

export interface AppState {
  user: User
  days: Day[]
}
