import { supabase } from '../supabase/client'
import type { Acquaintance, FriendsView, ReportReason, SocialClient } from './client'
import { toAcquaintance, toAcquaintances, toFriendsView } from './friendRow'
import { createStubCircles } from './mockCircles'

/**
 * Настоящая сеть за интерфейсом `SocialClient` — на месте заглушки и той же формы.
 *
 * Весь файл — двенадцать вызовов и ни одного правила. Правила живут в
 * [supabase/migrations/0004_friends.sql](../../supabase/migrations/0004_friends.sql), и это не
 * вкусовщина: ключ у клиента публичный и лежит в бандле, поэтому правило, записанное **здесь**,
 * для того, кто откроет консоль, не существует вовсе. Отсюда и вид, приходящий целиком после
 * каждой правки: кто кому друг после нажатия, решает та сторона — она одна знает, что человек
 * секунду назад сам позвал тебя.
 *
 * Сервера может не быть — без ключей в `.env.local` это рабочее состояние приложения, — и тогда
 * каждый метод отказывает. Тихий пустой список был бы хуже: «друзей нет» и «спросить некого» —
 * разные новости, и первая из них неправда.
 */

/** Одна причина отказа на весь файл: экран про неё говорит одними и теми же словами. */
function required(): NonNullable<typeof supabase> {
  if (!supabase) throw new Error('Сервер не настроен')
  return supabase
}

async function call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const { data, error } = await required().rpc(name, args)
  if (error) throw error
  return data
}

/** Правка связей: та же функция, что и всякий вызов, только ответ у неё — вид целиком. */
async function edit(name: string, args: Record<string, unknown>): Promise<FriendsView> {
  return toFriendsView(await call(name, args))
}

/** Задержка заглушки кружка: та же, что у всех выдуманных ответов, и по той же причине. */
const STUB_LATENCY_MS = 200

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createSupabaseSocial(): SocialClient {
  return {
    /**
     * Кружки **ещё на заглушке**, и это видно прямо здесь, в живом клиенте, — нарочно. Часть 8
     * заменит эту строку восемью вызовами, как шестнадцатью строками выше это уже случилось с
     * друзьями, и ни один экран об этом не узнает. До тех пор кружок лежит на этом устройстве,
     * и «я нажал — она видит» его не касается: заглушка рисует четыре состояния строки и парную
     * серию, то есть то, что надо увидеть глазами прежде, чем писать схему.
     */
    ...createStubCircles(wait, STUB_LATENCY_MS),

    async load() {
      return toFriendsView(await call('friends_view'))
    },

    async search(query) {
      // Пустой запрос отдаёт пусто, и проверка стоит **дважды** — здесь и в самой функции. Эта
      // экономит запрос на каждую стёртую букву; та отвечает за правило: «отдать всех» — самый
      // дорогой ответ во всём файле, и он не должен зависеть от того, кто спрашивает.
      const needle = query.trim().replace(/^@/, '')
      if (needle.length === 0) return []
      return toAcquaintances(await call('friends_search', { q: needle }))
    },

    async suggestions() {
      return toAcquaintances(await call('friend_suggestions'))
    },

    async profile(handle): Promise<Acquaintance | null> {
      const found = await call('friend_profile', { wanted: handle.trim().replace(/^@/, '') })
      // `null` приходит и на несуществующий ник, и на человека, который тебя закрыл, — и это одно
      // и то же по решению из «Что видно чужим»: заблокированный не видит **ничего**, включая
      // самого факта, что такой ник занят.
      return found === null ? null : toAcquaintance(found)
    },

    request: (personId) => edit('friend_request', { target: personId }),
    accept: (personId) => edit('friend_accept', { other: personId }),

    // Отмена, отказ и удаление из друзей — одна операция на сервере: связи между вами больше нет.
    // Три разных слова живут на экране, где они и правда разные; три разных запроса означали бы
    // три места, где однажды разойдутся правила, и два из них об этом не узнают.
    cancel: (personId) => edit('friend_unlink', { other: personId }),
    decline: (personId) => edit('friend_unlink', { other: personId }),
    remove: (personId) => edit('friend_unlink', { other: personId }),

    block: (personId) => edit('friend_block', { other: personId }),
    unblock: (personId) => edit('friend_unblock', { other: personId }),

    async report(personId: string, reason: ReportReason) {
      // Единственный метод, не возвращающий вид, и единственная запись прямо в таблицу: жалоба
      // ничего не меняет в твоих связях — она уходит людям, которые будут её читать. Читать её
      // отсюда нечем: политики на чтение у таблицы нет ни одной.
      //
      // Кто пожаловался, ставит сервер (`default auth.uid()`): поле, которое присылают, — это
      // поле, которое можно прислать чужим.
      const { error } = await required().from('reports').insert({ target_id: personId, reason })
      if (error) throw error
    },
  }
}
