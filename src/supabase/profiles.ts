import { supabase } from './client'

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

interface ProfileRow {
  id: string
  handle: string
  name: string
  days_on_road: number
  current_streak: number
  habit_count: number
  habits_public: boolean
}

const COLUMNS = 'id, handle, name, days_on_road, current_streak, habit_count, habits_public'

function toProfile(row: ProfileRow): Profile {
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

function toRow(id: string, handle: string, projection: ProfileProjection): ProfileRow {
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

/** Уникальный индекс на `handle`. Поймать его — единственный честный ответ «ник заняли». */
const UNIQUE_VIOLATION = '23505'

/**
 * Внешний ключ на `auth.users`. Приходит в одном случае: сессия на этом устройстве жива, а
 * человека, которому она выдана, больше нет — аккаунт удалён отсюда или с другого телефона,
 * проект сброшен. Токен при этом ещё не истёк, поэтому сам по себе он никого не разбудит.
 */
const MISSING_USER = '23503'

/**
 * Это тот самый случай? Отдельной функцией, потому что отвечать на него надо **выходом**, а не
 * сообщением: «не получилось, проверь связь» над аккаунтом, которого нет, — совет, по которому
 * нечего сделать, и человек будет пробовать снова, пока не истечёт токен.
 */
export function isDeletedAccount(failure: unknown): boolean {
  return (
    typeof failure === 'object' &&
    failure !== null &&
    (failure as { code?: unknown }).code === MISSING_USER
  )
}

/** Свой профиль, или `null`, если ник ещё не занят — то есть профиля ещё нет. */
export async function fetchProfile(id: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data === null ? null : toProfile(data as ProfileRow)
}

/**
 * Свободен ли ник. Спрашивается у функции на сервере, а не запросом в таблицу: политика на чтение
 * профилей однажды сузится блокировками, и тогда ник заблокированного человека выглядел бы
 * свободным — см. комментарий над `handle_available` в миграции.
 *
 * Ответ **устаревает в ту же секунду**, и держать его за истину нельзя: между проверкой и записью
 * ник может занять кто угодно. Настоящая проверка — уникальный индекс, а это подсказка, чтобы
 * человек узнал про занятый ник раньше, чем нажмёт «Сохранить».
 */
export async function isHandleFree(candidate: string): Promise<boolean> {
  if (!supabase) return true
  const { data, error } = await supabase.rpc('handle_available', { candidate })
  if (error) throw error
  return data === true
}

export type SaveOutcome = { kind: 'saved'; profile: Profile } | { kind: 'taken' }

/**
 * Занять ник и записать профиль целиком. Один запрос на оба: профиля без ника не бывает —
 * по нику человека и зовут, — поэтому «завести профиль» и «выбрать ник» это одно действие.
 */
export async function saveProfile(
  id: string,
  handle: string,
  projection: ProfileProjection,
): Promise<SaveOutcome> {
  if (!supabase) throw new Error('Сервер не настроен')
  const { data, error } = await supabase
    .from('profiles')
    .upsert(toRow(id, handle, projection))
    .select(COLUMNS)
    .single()
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { kind: 'taken' }
    throw error
  }
  return { kind: 'saved', profile: toProfile(data as ProfileRow) }
}

/**
 * Обновить одни числа, не трогая ник. Строки может и не быть — человек вошёл, но ника ещё не
 * выбрал; тогда это тихо ничего не делает, и так и надо: числа без ника некому показать.
 */
export async function saveProjection(id: string, projection: ProfileProjection): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('profiles')
    .update({
      name: projection.name,
      days_on_road: projection.daysOnRoad,
      current_streak: projection.currentStreak,
      habit_count: projection.habitCount,
      habits_public: projection.habitsPublic,
    })
    .eq('id', id)
  if (error) throw error
}
