import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Avatar from '../components/Avatar'
import HabitGlyph from '../components/icons/HabitGlyph'
import Icon from '../components/Icon'
import PersonRow from '../components/PersonRow'
import SocialUnavailable from '../components/SocialUnavailable'
import { newId } from '../domain/ids'
import { describeSchedule } from '../domain/schedule'
import { pairLine, pairProgress, type Circle, type CircleInvite } from '../social/circles'
import { useSocial } from '../social/socialState'
import { useAppState } from '../state/appState'
import { getLogicalToday } from '../domain/pathEngine'
import CircleFarewell from '../components/CircleFarewell'
import { useAuth } from '../supabase/authState'
import type { Person } from '../social/types'

/**
 * Друзья и заявки.
 *
 * Пришедшие заявки стоят **сверху**: это единственное на экране, что ждёт ответа, а список друзей
 * ничего не просит. Отправленные — внизу и тихо: они тоже ждут, но не тебя.
 *
 * Чужих чисел на этом экране нет — ни серий, ни дней. Список друзей отвечает на «кто здесь», а не
 * «кто лучше»; строка «31 день подряд» рядом с чужим именем превращает его в место в таблице, а
 * рейтингов в этом приложении нет и не будет. Числа друга живут на его собственном профиле, где
 * они — рассказ о нём, а не сравнение с тобой.
 */
export default function FriendsScreen() {
  const { configured } = useAuth()
  const { view, loading, error, reload, circles, notices, dismissNotice } = useSocial()
  const { state } = useAppState()
  const today = getLogicalToday(new Date())
  const empty = view.friends.length === 0 && view.incoming.length === 0 && view.outgoing.length === 0

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Link to="/profile" aria-label="Назад в профиль" className="sk-press sk-focus -ml-2 rounded-[16px] p-2">
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </Link>
          <h1 className="sk-heading flex-1 text-[32px] text-text-primary">Друзья</h1>
          <Link
            to="/profile/friends/add"
            aria-label="Найти друзей"
            className="sk-press sk-focus rounded-[16px] p-2"
          >
            <Icon name="user-plus" size={24} color="var(--color-brand)" />
          </Link>
        </div>

        {!configured ? (
          <SocialUnavailable />
        ) : (
          <>
          {error !== null && (
            <div className="flex items-center gap-3 rounded-[20px] border border-border p-3.5">
              <p className="flex-1 text-[13px]" style={{ color: 'var(--color-day-red)' }}>{error}</p>
              <button type="button" onClick={reload} className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus">
                Ещё раз
              </button>
            </div>
          )}

          {loading ? (
            <p className="text-[13px] text-text-muted">Загружаю…</p>
          ) : (
            <>
              {/* Сообщения впереди всего: это новость, а всё остальное на экране — положение дел.
                  Новость, стоящая под списком, читается последней или не читается вовсе. */}
              {notices.map((notice) => (
                <CircleFarewell
                  key={notice.id}
                  notice={notice}
                  circle={circles.circles.find((circle) => circle.id === notice.circleId)}
                  days={state.days}
                  today={today}
                  onClose={() => void dismissNotice(notice.id)}
                />
              ))}

              {view.incoming.length > 0 && (
                <Section title="Тебя зовут" people={view.incoming} state="incoming" />
              )}

              {/* Приглашение в кружок живёт рядом с заявками в друзья и устроено так же: пришло
                  и отправлено — разные состояния, и на первое отвечают. Стоит следом, потому что
                  оно тоже ждёт ответа, а список друзей не ждёт ничего. */}
              {circles.incoming.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="sk-eyebrow">Зовут в общую привычку</h2>
                  {circles.incoming.map((invite) => (
                    <IncomingCircle key={invite.id} invite={invite} />
                  ))}
                </section>
              )}

              {/* Закрытые сюда не попадают: они уже сказали своё прощальной карточкой выше, и
                  вторая строка про ту же пару — та же новость дважды, вторым тоном. */}
              {circles.circles.some((circle) => circle.leftAt === undefined) && (
                <section className="flex flex-col gap-3">
                  <h2 className="sk-eyebrow">Общие привычки</h2>
                  {circles.circles
                    .filter((circle) => circle.leftAt === undefined)
                    .map((circle) => (
                      <CircleCard key={circle.id} circle={circle} />
                    ))}
                </section>
              )}

              {view.friends.length > 0 && <Section title="Твои друзья" people={view.friends} state="friends" />}

              {view.outgoing.length > 0 && <Section title="Ты зовёшь" people={view.outgoing} state="outgoing" />}

              {circles.outgoing.length > 0 && (
                <section className="flex flex-col gap-3">
                  <h2 className="sk-eyebrow">Ты зовёшь в общую привычку</h2>
                  {circles.outgoing.map((invite) => (
                    <OutgoingCircle key={invite.id} invite={invite} />
                  ))}
                </section>
              )}

              {empty && error === null && (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-[13px] text-text-muted">
                    Пока никого. Друга находят по нику — его говорят вслух, как номер телефона.
                  </p>
                  <Link to="/profile/friends/add" className="sk-btn sk-btn-primary sk-plinth sk-press sk-focus">
                    Найти друзей
                  </Link>
                </div>
              )}
            </>
          )}
          </>
        )}
      </div>
    </AppShell>
  )
}

function Section({ title, people, state }: { title: string; people: Person[]; state: 'incoming' | 'friends' | 'outgoing' }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <h2 className="sk-eyebrow flex-1">{title}</h2>
        <span className="sk-num text-[12px] text-text-muted">{people.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {people.map((person) => (
          <PersonRow key={person.id} person={person} state={state} />
        ))}
      </div>
    </section>
  )
}

/**
 * Пришедшее приглашение в кружок.
 *
 * Привычка видна **целиком до согласия** — название, значок и дни недели, — потому что расписание
 * в кружке одно на двоих и соглашаются именно на него.
 *
 * «Принять» заводит привычку **обычным путём**, через тот же `applyAction`, что и заведённая
 * руками: в состояние попадает результат твоего согласия, а не чужие данные. Слово подсказала она
 * — завёл привычку ты, и дальше это твоя привычка со своим ключом, своими днями и своим уровнем.
 */
function IncomingCircle({ invite }: { invite: CircleInvite }) {
  const { state, dispatch, askAboutNewHabits } = useAppState()
  const { acceptInvite, declineInvite } = useSocial()
  const [busy, setBusy] = useState(false)

  function accept(): void {
    if (busy) return
    setBusy(true)
    const taskId = newId()
    const next = dispatch({
      kind: 'addGoal',
      input: {
        id: newId(),
        title: invite.title,
        tasks: [{ id: taskId, title: invite.title, weekdays: invite.weekdays, icon: invite.icon }],
      },
    })
    // Догадку спрашивают и здесь: привычка новая, и вопрос «сколько продержишься» — про неё,
    // а не про то, откуда пришло слово.
    askAboutNewHabits(state, next)
    void acceptInvite(invite.id, newId(), taskId)
  }

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface-raised p-3.5">
      <div className="flex items-center gap-3">
        <Avatar name={invite.person.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-text-primary">{invite.person.name}</p>
          <p className="text-[12px] text-text-muted">зовёт держать привычку вдвоём</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-[16px] bg-surface-sunken px-3.5 py-3">
        <HabitGlyph icon={invite.icon} title={invite.title} size={20} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-text-primary">{invite.title}</p>
          <p className="text-[12px] text-text-muted">{describeSchedule(invite.weekdays)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={busy}
          className="sk-btn sk-btn-primary sk-plinth sk-focus flex-1"
        >
          Принять
        </button>
        {/* Отказ не наказывается и ни о чём не сообщает сверх «не сейчас» — поэтому и слово такое. */}
        <button
          type="button"
          onClick={() => void declineInvite(invite.id)}
          disabled={busy}
          className="sk-btn sk-btn-ghost sk-press sk-focus flex-1"
        >
          Не сейчас
        </button>
      </div>
    </div>
  )
}

/** Отправленное. Ждёт не тебя, поэтому стоит тихо и умеет ровно одно — отмениться. */
function OutgoingCircle({ invite }: { invite: CircleInvite }) {
  const { cancelInvite } = useSocial()

  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-border p-3.5">
      <Avatar name={invite.person.name} size={40} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] text-text-primary">{invite.person.name}</p>
        <p className="truncate text-[12px] text-text-muted">
          {invite.title} · {describeSchedule(invite.weekdays)}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void cancelInvite(invite.id)}
        className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
      >
        Отменить
      </button>
    </div>
  )
}

/**
 * Живой кружок: с кем, какая привычка и два числа.
 *
 * «Выйти» спрашивает второй раз, как и «Убрать из друзей», и по той же причине: договор складывали
 * вдвоём, и промах по кнопке не должен его стоить. Вернуться назад нельзя — зовут заново.
 *
 * Привычка при этом **остаётся и сохраняет все свои дни**: чужой уход не имеет права отобрать у
 * человека его же жизнь. Про это сказано прямо в вопросе — иначе «Выйти» читается как «удалить
 * привычку», и нажать его побоятся ровно те, кому пора.
 */
function CircleCard({ circle }: { circle: Circle }) {
  const { state } = useAppState()
  const { leaveCircle } = useSocial()
  const [confirming, setConfirming] = useState(false)

  const today = state.days[state.days.length - 1]?.date ?? circle.startedOn
  const progress = pairProgress(circle, state.days, today)

  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface-raised p-3.5">
      <div className="flex items-center gap-3">
        <HabitGlyph icon={circle.icon} title={circle.title} size={22} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-text-primary">{circle.title}</p>
          <p className="truncate text-[12px] text-text-muted">
            вдвоём с {circle.partner.person.name} · {describeSchedule(circle.weekdays)}
          </p>
        </div>
        <Avatar name={circle.partner.person.name} size={32} />
      </div>

      <p className="text-[13px] text-text-secondary">{pairLine(progress)}</p>

      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-text-muted">
            Привычка останется у тебя со всеми днями — уйдёт только общий счёт. Чтобы вернуться,
            придётся позвать заново.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirming(false)
                void leaveCircle(circle.id)
              }}
              className="sk-btn sk-btn-danger sk-plinth sk-focus flex-1"
            >
              Выйти
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="sk-btn sk-btn-ghost sk-press sk-focus flex-1"
            >
              Остаться
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="sk-btn sk-btn-ghost sk-btn-sm sk-press sk-focus self-start"
        >
          Выйти из общей привычки
        </button>
      )}
    </div>
  )
}
