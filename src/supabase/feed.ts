import type { SharedEvent } from '../domain/feed'
import { supabase } from './client'

/**
 * Своя неделя — наружу, чтобы друг увидел строку и мог сказать ей сердце.
 *
 * Уезжает **ровно то, что уже видно на витрине**: название привычки, её дни и ступень. Ни одного
 * дня по числам, ни одной отметки, ни процента — дороги на сервере нет и здесь не появляется.
 *
 * И главный запрет: наружу не едет ничто, что называет пропуск. Ни красных дней, ни оборванных
 * серий, ни возвращения — отбор стоит в `feedEventId`, который отдаёт `null` всему, чему на чужом
 * экране не место. Здесь этот отбор не повторяется: второе такое же правило рядом с первым однажды
 * разошлось бы с ним, и разошлось бы молча.
 *
 * Работает как полка (`shelf.ts`): что есть — кладём, чего больше нет — убираем. Второе обязательно
 * и по той же причине — событие, выпавшее из окна недели, иначе жило бы на чужих экранах вечно.
 */
export interface FeedEventRow {
  user_id: string
  event_id: string
  happened_on: string
  /** Момент, если он записан. `null` у всего, что выведено из истории: там есть день, но нет минуты. */
  happened_at: string | null
  kind: 'rank' | 'goal' | 'calendar'
  title: string | null
  rank: string | null
  days: number | null
  mark: string | null
}

export function toFeedRows(userId: string, events: SharedEvent[]): FeedEventRow[] {
  return events.map(({ id, date, event, at }) => {
    const row: FeedEventRow = {
      user_id: userId,
      event_id: id,
      happened_on: date,
      happened_at: at ?? null,
      // Род сужен на берегу: `feedEventId` отдаёт имя только этим трём, и событие с другим родом
      // сюда не доезжает вовсе.
      kind: event.kind as 'rank' | 'goal' | 'calendar',
      title: null,
      rank: null,
      days: null,
      mark: null,
    }
    if (event.kind === 'rank') {
      row.title = event.title
      row.rank = event.rank
      row.days = event.days
    } else if (event.kind === 'goal') {
      row.title = event.title
    } else if (event.kind === 'calendar') {
      row.mark = event.mark
    }
    return row
  })
}

export async function saveFeedEvents(userId: string, events: SharedEvent[]): Promise<void> {
  if (!supabase) return

  if (events.length > 0) {
    // Цель конфликта названа вслух, хотя ключ таблицы и так этот: умолчание разрешается на той
    // стороне, и день, когда оно разрешится иначе, выглядит как «duplicate key» у живых людей.
    const { error } = await supabase
      .from('feed_events')
      .upsert(toFeedRows(userId, events), { onConflict: 'user_id,event_id' })
    if (error) throw error
  }

  const keep = events.map((event) => event.id)
  // Пустая неделя — это «убрать всё», и отдельная ветка нужна ей потому, что `not in ()` не значит
  // ничего: список условий, из которого убрали последнее условие, перестаёт быть условием.
  const query = supabase.from('feed_events').delete().eq('user_id', userId)
  const { error } = await (keep.length === 0 ? query : query.not('event_id', 'in', asList(keep)))
  if (error) throw error
}

/**
 * Список для `not in`. Собирается руками, потому что `in` у PostgREST — часть строки запроса, а не
 * параметр. Имя события мы выводим сами (`feedEventId`), и свободного текста в нём нет — только
 * дата, род и ключ, — но полагаться здесь на это нельзя: ключ мог приехать из восстановленной
 * копии, которую правили руками, и одна запятая разобрала бы условие на два.
 */
function asList(values: string[]): string {
  return `(${values.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')})`
}
