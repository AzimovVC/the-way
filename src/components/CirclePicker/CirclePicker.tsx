import { useSocial } from '../../social/socialState'
import type { Person } from '../../social/types'
import Avatar from '../Avatar'

export interface CirclePickerProps {
  /**
   * Привычка, если она уже заведена. У новой ключа ещё нет — и звать будет форма, в тот же миг,
   * когда привычка появится: расписание к этой секунде уже настоящее, а не обещание.
   */
  taskId?: string
  value: Person | null
  onChange: (person: Person | null) => void
}

/**
 * Позвать в кружок прямо из формы привычки.
 *
 * Второй вход в кружок, и он с другой стороны: на чужом профиле человек начинает с **того, кого**
 * зовёт, и выбирает привычку ([CircleInviteModal](../CircleInviteModal/CircleInviteModal.tsx)); здесь
 * он начинает с **привычки** и выбирает человека. Оба вопроса живые — «с кем бы это делать вдвоём»
 * приходит в голову ровно тогда, когда привычку заводят, — и заставлять ради него закрыть форму,
 * дойти до друзей и начать сначала значило бы ответить «не сейчас» на мысль, которая бывает раз.
 *
 * Правило «зовут своей, уже заведённой привычкой» при этом не нарушено: приглашение уходит **после**
 * того, как форма сохранена, и расписание в нём то самое, которое человек только что взял на себя.
 * Отсюда и то, что строка ничего не отправляет сама: она только держит выбор, а зовёт тот, кто
 * сохраняет.
 *
 * Строки **нет вовсе**, пока звать некого: пустой ряд с подписью «друзей нет» — это упрёк в форме,
 * которую открыли ради привычки. По той же причине нет и кнопки «никого»: выбор снимается
 * повторным тапом, как у времени суток.
 */
export default function CirclePicker({ taskId, value, onChange }: CirclePickerProps) {
  const { view, circles, cancelInvite } = useSocial()

  // Привычка держит один кружок, поэтому у занятой строка не спрашивает, а рассказывает. Вторая
  // пара на той же строке дня — это две чужие галочки рядом с одной твоей, то есть «сколько из
  // двух», а счётчика в задаче здесь нет и не заводится.
  const circle = taskId === undefined
    ? undefined
    : circles.circles.find((item) => item.taskId === taskId && item.leftAt === undefined)
  const pending = taskId === undefined
    ? undefined
    : circles.outgoing.find((item) => item.taskId === taskId)

  if (circle !== undefined) {
    return (
      <div className="flex flex-col gap-2">
        <p className="sk-eyebrow">Общая привычка</p>
        {/* Имя в именительном падеже и без глагола: склонять его нечем — человек пишет какое
            хочет, — а глагол в русском выдал бы род, которого он здесь не называл. */}
        <p className="text-[13px] text-text-secondary">В общей привычке — {circle.partner.person.name}.</p>
      </div>
    )
  }

  if (pending !== undefined) {
    return (
      <div className="flex flex-col gap-2">
        <p className="sk-eyebrow">Общая привычка</p>
        <p className="text-[13px] text-text-secondary">Позвали — {pending.person.name}. Ждём ответа.</p>
        {/* Отмена стоит здесь, а не только на экране друзей: позвавший не по адресу узнаёт об этом
            в тот же миг, и отправлять его искать свою же ошибку в другом месте незачем. */}
        <button
          type="button"
          onClick={() => void cancelInvite(pending.id)}
          className="sk-press sk-focus self-start rounded-[8px] py-1 text-[13px] font-bold text-text-muted"
        >
          Отменить приглашение
        </button>
      </div>
    )
  }

  if (view.friends.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <p className="sk-eyebrow">Вместе с кем-то</p>

      <div className="flex flex-wrap gap-2">
        {view.friends.map((person) => {
          const on = value?.id === person.id
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => onChange(on ? null : person)}
              aria-pressed={on}
              className="sk-focus sk-plinth flex items-center gap-2 rounded-[16px] py-1.5 pl-1.5 pr-3"
              style={
                on
                  ? {
                      backgroundColor: 'var(--color-brand)',
                      color: 'var(--color-text-on-brand)',
                      ['--plinth-color' as string]: 'var(--color-brand-plinth)',
                      ['--depth-press' as string]: 'var(--depth-press-sm)',
                    }
                  : {
                      backgroundColor: 'var(--color-surface-sunken)',
                      color: 'var(--color-text-muted)',
                      boxShadow: 'inset 0 0 0 2px var(--color-border)',
                    }
              }
            >
              <Avatar name={person.name} size={22} />
              <span className="max-w-[9rem] truncate text-[13px] font-bold leading-none">{person.name}</span>
            </button>
          )
        })}
      </div>

      {/* Цена названа до выбора, а не после: кружок — это чужая галочка рядом с твоей, и человек
          должен знать, чего он **не** получает, прежде чем позовёт. */}
      {value === null ? (
        <p className="text-[12px] text-text-muted">
          Одна привычка на двоих: вы видите галочки друг друга. На дорогу это не влияет.
        </p>
      ) : (
        <p className="text-[12px] text-text-muted">
          Дни недели поедут вместе с названием — у общей привычки расписание одно на двоих. Приглашение
          уйдёт, когда сохранишь.
        </p>
      )}
    </div>
  )
}
