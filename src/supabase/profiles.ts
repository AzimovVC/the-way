import { supabase } from './client'
import {
  COLUMNS,
  isHandleTaken,
  toProfile,
  toProjectionPatch,
  toRow,
  type Profile,
  type ProfileProjection,
  type ProfileRow,
} from './profileRow'

export { isDeletedAccount } from './profileRow'
export type { Profile, ProfileProjection } from './profileRow'

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
    if (isHandleTaken(error)) return { kind: 'taken' }
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
    .update(toProjectionPatch(projection))
    .eq('id', id)
  if (error) throw error
}

/**
 * Удалить свой аккаунт. Вызов один, а уносит всё: на сервере за этим стоит каскад от `auth.users`
 * — профиль, дорога, снимки, заявки, дружбы, блокировки (см. миграцию `0005_delete_account.sql`).
 *
 * Аргументов у неё нет, и это не экономия: удалить можно только себя, потому что «себя» функция
 * узнаёт из сессии, а не из того, что ей передали.
 */
export async function deleteAccount(): Promise<void> {
  if (!supabase) throw new Error('Сервер не настроен')
  const { error } = await supabase.rpc('delete_account')
  if (error) throw error
}
