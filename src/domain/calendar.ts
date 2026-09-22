import type { Day } from './models'
import { weekdayIndex } from './schedule'

/** «25 августа» — the form a date takes inside a sentence. */
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

/** «25 авг» — the form a date takes in a tight line, beside a number. */
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

/** «Сентябрь» — the form a month takes as a heading, on its own. */
const MONTHS_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

export function formatShortDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

/** «6» — the day alone, for a place where the month is printed beside it and changes on its own. */
export function formatDayNumber(date: string): string {
  return String(Number(date.split('-')[2]))
}

/** «авг» — the month alone, in the form it takes beside a number. */
export function formatShortMonth(date: string): string {
  return MONTHS_SHORT[Number(date.split('-')[1]) - 1]
}

export function formatLongDate(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${d} ${MONTHS_GENITIVE[m - 1]}`
}

/** '2026-09' → «Сентябрь 2026». The year is dropped when it is the one we are standing in. */
export function formatMonthTitle(month: string, currentYear?: number): string {
  const [y, m] = month.split('-').map(Number)
  const name = MONTHS_NOMINATIVE[m - 1]
  return y === currentYear ? name : `${name} ${y}`
}

export interface CalendarCell {
  /** Null in the padding before the 1st and after the last of a month. */
  date: string | null
  dayOfMonth: number
  /** Absent for a date the history does not cover — before the first day, or after today. */
  day?: Day
}

export interface CalendarMonth {
  /** 'YYYY-MM'. */
  key: string
  title: string
  weeks: CalendarCell[][]
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * The given days laid out as calendar months, Monday first.
 *
 * Every date inside the covered stretch gets a cell, not only the ones the history holds: the
 * gaps are half of what a calendar is for, and a grid that silently closed up around them would
 * show a month of misses as a solid run. Whole weeks before the first day and after the last are
 * dropped, though — they are not gaps in the history, they are the time before it started and the
 * time still ahead, and three empty rows say that far louder than it deserves.
 */
export function buildCalendar(days: Day[], currentYear?: number): CalendarMonth[] {
  const byDate = new Map(days.map((d) => [d.date, d]))
  const months = [...new Set(days.map((d) => d.date.slice(0, 7)))].sort()

  return months.map((key) => {
    const [y, m] = key.split('-').map(Number)
    const total = daysInMonth(y, m)
    const cells: CalendarCell[] = []

    const lead = weekdayIndex(`${key}-01`)
    for (let i = 0; i < lead; i++) cells.push({ date: null, dayOfMonth: 0 })
    for (let d = 1; d <= total; d++) {
      const date = `${key}-${String(d).padStart(2, '0')}`
      cells.push({ date, dayOfMonth: d, day: byDate.get(date) })
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, dayOfMonth: 0 })

    const all: CalendarCell[][] = []
    for (let i = 0; i < cells.length; i += 7) all.push(cells.slice(i, i + 7))

    const covered = (week: CalendarCell[]) => week.some((c) => c.day !== undefined)
    const from = all.findIndex(covered)
    const to = all.findLastIndex(covered)
    const weeks = from === -1 ? all : all.slice(from, to + 1)

    return { key, title: formatMonthTitle(key, currentYear), weeks }
  })
}


/**
 * «день / дня / дней» for a count. Russian picks the form by the last digit, except in the teens,
 * where every number takes the third form regardless of how it ends.
 *
 * Here beside the date formatting rather than in whichever component needed it first: a second copy
 * of this is a place for the two to disagree, and the rule is the same wherever days are counted.
 */
export function dayWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'дня'
  return 'дней'
}

/** «2 часа назад» — та же линейка, что у `dayWord`. */
export function hourWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'час'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'часа'
  return 'часов'
}

/** «5 минут назад» — та же линейка, что у `dayWord`. */
export function minuteWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'минуту'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'минуты'
  return 'минут'
}

/** «3 раза» — same plural rule as dayWord, and it lives beside it so there is one place to read. */
export function timesWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'раз'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'раза'
  return 'раз'
}

/** «4 привычки» — та же линейка, что у `dayWord`. */
export function habitWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'привычка'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'привычки'
  return 'привычек'
}

/** «2 заморозки» — та же линейка, что у `dayWord`, и стоит рядом, чтобы правило читалось в одном месте. */
export function freezeWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'заморозка'
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'заморозки'
  return 'заморозок'
}

/**
 * Whole days from one date key to another, negative if `to` is the earlier one.
 *
 * Read at UTC midnight on purpose: these are date keys, not moments, and parsing them in the
 * browser's zone makes the subtraction cross a DST boundary an hour short and round to the
 * neighbouring day.
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/**
 * Следующий календарный день. Читается в UTC по той же причине, что и `daysBetween`: это ключ
 * даты, а не момент, и в зоне браузера прибавление суток на переходе времени промахивается.
 */
export function nextDay(date: string): string {
  const at = new Date(`${date}T12:00:00Z`)
  at.setUTCDate(at.getUTCDate() + 1)
  return at.toISOString().slice(0, 10)
}

