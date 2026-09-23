import { supabase } from '../supabase/client'
import type { Acquaintance, FriendsView, ReportReason, SocialClient } from './client'
import type { CirclesView } from './circles'
import type { SocialFeed } from './feed'
import { toCirclesView, toNotices } from './circleRow'
import { toAcquaintance, toAcquaintances, toFriendsView } from './friendRow'
import { toSocialFeed } from './feedRow'
import { toMessages } from './messageRow'

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

/** И то же для ленты: сердце возвращает её целиком, потому что кто его сказал, знает та сторона. */
async function feedCall(name: string, args: Record<string, unknown>): Promise<SocialFeed> {
  return toSocialFeed(await call(name, args))
}

/** То же самое для пары: каждая правка возвращает кружки целиком, а не «ок». */
async function editCircles(name: string, args: Record<string, unknown> = {}): Promise<CirclesView> {
  return toCirclesView(await call(name, args))
}

export function createSupabaseSocial(): SocialClient {
  return {
    circles: () => editCircles('circles_view'),

    /**
     * Опубликовать свою отметку — или объявить день освобождённым.
     *
     * Дату присылает **тот, кто нажал**, и сервер сверяет её со своим ответом (триггер
     * `circle_marks_today` в миграции 0007). Обе половины правила несущие: без проверки парная
     * серия накручивается из консоли — ключ публичный и лежит в бандле; а посчитай сервер день
     * целиком, отметка, нажатая в 02:59 и доехавшая в 03:01, легла бы у пары в завтра, а на твоей
     * дороге во вчера — одно нажатие с двумя разными днями.
     *
     * Заморозка приезжает этой же ручкой (`kind`): на сервере это одна и та же новость про один и
     * тот же день — «этот день с меня не спросит».
     */
    circleMark: (circleId, date, doneAt, kind = 'done') =>
      editCircles('circle_mark', { circle: circleId, on_date: date, at: doneAt, mark_kind: kind }),

    circleUnmark: (circleId, date) => editCircles('circle_unmark', { circle: circleId, on_date: date }),

    circleInvite: (input) =>
      editCircles('circle_invite', {
        invite_id: input.id,
        target: input.personId,
        invite_title: input.title,
        invite_icon: input.icon ?? null,
        // Пусто и «каждый день» — одно и то же, и на сервере это `null`, а не пустой массив:
        // расписание из нуля дней означало бы привычку, которую не спрашивают никогда.
        invite_weekdays: input.weekdays === undefined || input.weekdays.length === 0 ? null : input.weekdays,
        invite_timezone: input.timezone,
        habit_id: input.taskId,
      }),

    // Отозвать своё и отказать чужому — одна операция: приглашения больше нет. Разные слова живут
    // на экране, где они и правда разные; два вызова означали бы два места, где разойдутся правила.
    circleCancel: (inviteId) => editCircles('circle_drop_invite', { invite_id: inviteId }),
    circleDecline: (inviteId) => editCircles('circle_drop_invite', { invite_id: inviteId }),

    /**
     * Принять. Привычка у себя к этому моменту уже заведена — обычным путём, через `applyAction`, —
     * и сюда приезжает только её ключ: в состояние попал **результат твоего согласия**, а не чужие
     * данные. Ключ пары приезжает оттуда же, снаружи, по тому же правилу, что и все остальные.
     */
    circleAccept: (inviteId, circleId, taskId) =>
      editCircles('circle_accept', { invite_id: inviteId, circle_id: circleId, habit_id: taskId }),

    /**
     * Выйти. Привычка у обоих остаётся обычной привычкой **со всеми своими днями**: чужой уход не
     * имеет права отобрать у человека его же жизнь. Сервер её и не видит — дороги там нет.
     *
     * Оставшийся узнаёт об этом **сообщением**, а не пропажей второй кнопки, и чеканит его сервер:
     * написать человеку отсюда нельзя ничем (`notices` в миграции 0007).
     */
    circleLeave: (circleId) => editCircles('circle_leave', { circle: circleId }),

    /**
     * Подписка на то, что делает вторая половина. Это и есть «ты нажал — она видит», с той стороны.
     *
     * Слушаются **четыре таблицы**, и каждая по своей причине: отметки — ради самой галочки,
     * кружки — ради выхода (строка закрывается, а не пропадает), приглашения — ради того, чтобы
     * позвавшему не пришлось обновлять экран, чтобы увидеть согласие, сообщения — ради самой
     * прощальной карточки.
     *
     * Последняя стоит в списке не для симметрии. Выход закрывает кружок и чеканит сообщение одной
     * операцией, но на экран это две разные вещи: строка кружка исчезает из `circles_view`, а
     * карточка приходит из `notices_view`. Слушая только `circles`, экран узнавал бы про пропажу
     * и молчал бы про новость — то есть делал бы ровно то, от чего решение 3 и заводило сообщение.
     *
     * Ни одна строка из ответа не читается: пришло событие — экран спрашивает `circles()` и
     * `notices()`. Второй разбор ответа рядом с первым однажды разошёлся бы с ним, а два вида,
     * собранные одной и той же функцией, разойтись не могут. Отсюда же и то, что канал один, а
     * обработчик общий: какая из четырёх таблиц прислала событие — это тоже чтение события.
     *
     * Политики действуют и здесь — таблицы заведены в публикацию отдельной миграцией, — но лишнее
     * событие всё равно ничем не грозит: оно не несёт данных, а вызывает запрос, который защищён
     * теми же политиками, что и всё остальное.
     */
    watch(onChange) {
      const client = supabase
      if (!client) return () => {}

      const channel = client.channel('social')
      // `messages` rides the same channel: a GIF by today's circle is one more thing the other side
      // did while you were looking, and a second channel would be a second way for it to arrive.
      for (const table of ['circle_marks', 'circles', 'circle_invites', 'notices', 'messages']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange())
      }
      void channel.subscribe()

      return () => {
        void client.removeChannel(channel)
      }
    },

    /**
     * Лента друзей и сердца — одним вызовом.
     *
     * Своих событий в ответе нет: их выводит из дороги само устройство. Сердца приезжают и на них,
     * потому что ставит их та сторона.
     */
    feed: (since) => feedCall('feed_view', { since }),
    heart: (ownerId, eventId, since) => feedCall('feed_heart', { owner: ownerId, event: eventId, since }),
    unheart: (ownerId, eventId, since) => feedCall('feed_unheart', { owner: ownerId, event: eventId, since }),

    async notices() {
      return toNotices(await call('notices_view'))
    },

    async noticeDismiss(noticeId: string) {
      return toNotices(await call('notice_dismiss', { notice_id: noticeId }))
    },

    async messages() {
      return toMessages(await call('messages_view'))
    },

    /**
     * Straight into the table, like a report: the policies in 0013 decide whether it may go (a
     * friend, nobody blocked), and the sender is `default auth.uid()`, never sent from here.
     */
    async messageSend({ id, recipientId, gif }) {
      const { error } = await required().from('messages').insert({
        id,
        recipient_id: recipientId,
        kind: 'gif',
        gif_id: gif.id,
        preview_url: gif.preview,
        full_url: gif.full,
        width: gif.width,
        height: gif.height,
      })
      if (error) throw error
    },

    async messagesDismiss(ids) {
      return toMessages(await call('messages_dismiss', { ids }))
    },

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
