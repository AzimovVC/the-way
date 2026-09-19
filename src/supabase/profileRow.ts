/**
 * Строка таблицы `profiles` и всё, что про неё можно сказать, **не спрашивая сервер**: как
 * колонки ложатся в поля и как читаются коды, которыми Postgres отвечает на отказ.
 *
 * Отдельным файлом, потому что это единственная часть работы с профилем, у которой есть
 * правильный ответ на берегу. Всё остальное в `profiles.ts` — запрос, и проверяется он только
 * живым прогоном. Здесь же — чистый TypeScript, как в `src/domain/`, и тест рядом.
 */

/**
 * Профиль, каким он лежит на сервере: имя, ник и **проекция** пути — те несколько чисел, которые
 * и так видны по нику. Дороги здесь нет ни в каком виде, и это то же правило, что держит
 * `src/social/types.ts` с другой стороны: сервер не становится вторым источником правды про путь.
 */
export interface Profile {
  id: string
  handle: string
  name: string
  daysOnRoad: number
  currentStreak: number
  habitCount: number
  habitsPublic: boolean
}

/** Что про себя рассказывает состояние. Ник сюда не входит: его меняют руками, а не выводят. */
export interface ProfileProjection {
  name: string
  daysOnRoad: number
  currentStreak: number
  habitCount: number
  habitsPublic: boolean
}

export interface ProfileRow {
  id: string
  handle: string
  name: string
  days_on_road: number
  current_streak: number
  habit_count: number
  habits_public: boolean
}

export const COLUMNS = 'id, handle, name, days_on_road, current_streak, habit_count, habits_public'

export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    daysOnRoad: row.days_on_road,
    currentStreak: row.current_streak,
    habitCount: row.habit_count,
    habitsPublic: row.habits_public,
  }
}

export function toRow(id: string, handle: string, projection: ProfileProjection): ProfileRow {
  return {
    id,
    handle,
    name: projection.name,
    days_on_road: projection.daysOnRoad,
    current_streak: projection.currentStreak,
    habit_count: projection.habitCount,
    habits_public: projection.habitsPublic,
  }
}

/**
 * Обновление одних чисел. Ни `id`, ни `handle` сюда не попадают, и это не экономия: ник
 * принадлежит серверу — его занимают уникальным индексом и проверяют формой, — а проекция
 * уходит наверх каждые полминуты из фонового таймера. Ник, приехавший вместе с числами, однажды
 * уехал бы тот, что лежал в памяти вкладки, и затёр бы выбранный на другом устройстве.
 */
export function toProjectionPatch(projection: ProfileProjection): Omit<ProfileRow, 'id' | 'handle'> {
  return {
    name: projection.name,
    days_on_road: projection.daysOnRoad,
    current_streak: projection.currentStreak,
    habit_count: projection.habitCount,
    habits_public: projection.habitsPublic,
  }
}

/** Уникальный индекс на `handle`. Поймать его — единственный честный ответ «ник заняли». */
const UNIQUE_VIOLATION = '23505'

/**
 * Внешний ключ на `auth.users`. Приходит в одном случае: сессия на этом устройстве жива, а
 * человека, которому она выдана, больше нет — аккаунт удалён отсюда или с другого телефона,
 * проект сброшен. Токен при этом ещё не истёк, поэтому сам по себе он никого не разбудит.
 */
const MISSING_USER = '23503'

function codeOf(failure: unknown): string | null {
  if (typeof failure !== 'object' || failure === null) return null
  const code = (failure as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

/** Ник заняли между проверкой и записью — то есть сработал индекс, а не наша подсказка. */
export function isHandleTaken(failure: unknown): boolean {
  return codeOf(failure) === UNIQUE_VIOLATION
}

/**
 * Это тот самый случай? Отдельной функцией, потому что отвечать на него надо **выходом**, а не
 * сообщением: «не получилось, проверь связь» над аккаунтом, которого нет, — совет, по которому
 * нечего сделать, и человек будет пробовать снова, пока не истечёт токен.
 */
export function isDeletedAccount(failure: unknown): boolean {
  return codeOf(failure) === MISSING_USER
}
