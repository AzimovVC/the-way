import { useState } from 'react'
import { newId } from '../../domain/ids'
import { describeSchedule } from '../../domain/schedule'
import { useSocial } from '../../social/socialState'
import type { Person } from '../../social/types'
import { useAppState } from '../../state/appState'
import HabitGlyph from '../icons/HabitGlyph'

/**
 * Позвать в кружок: выбрал свою привычку — отправил.
 *
 * Зовут **своей, уже заведённой привычкой**, а не выдуманным на месте названием, и это не
 * экономия экрана. Расписание в кружке одно на двоих и задаёт его зовущий; у заведённой привычки
 * оно уже есть, уже прожито и уже видно — поэтому и в приглашении оно настоящее, а не обещание,
 * которое зовущий даёт за минуту до того, как сам начнёт его держать. Нет такой привычки — её
 * заводят там же, где заводят все, кнопкой «+»; один экран на одно дело.
 *
 * Отказ здесь ничем не грозит и ни о чём не сообщает сверх «не сейчас», поэтому и зовущему тут
 * ничего не обещают: пока она не ответила, у него не меняется ровно ничего.
 */
export default function CircleInviteModal({ person, onClose }: { person: Person; onClose: () => void }) {
  const { state } = useAppState()
  const { circles, invite } = useSocial()
  const [chosen, setChosen] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  // Привычка держит один кружок. Вторая пара на той же строке дня — это две чужие галочки рядом с
  // одной твоей, то есть «сколько из двух», а счётчика в задаче здесь нет и не заводится.
  const taken = new Set([
    ...circles.circles.map((circle) => circle.taskId),
    ...circles.outgoing.map((item) => item.taskId).filter((id): id is string => id !== undefined),
  ])

  const habits = state.user.goals
    .filter((goal) => !goal.archived)
    .flatMap((goal) => goal.tasks)
    .map((task) => ({ task, busy: taken.has(task.id) }))

  async function send(): Promise<void> {
    const task = habits.find((row) => row.task.id === chosen)?.task
    if (task === undefined || sending) return
    setSending(true)
    await invite({
      id: newId(),
      personId: person.id,
      taskId: task.id,
      title: task.title,
      icon: task.icon,
      weekdays: task.weekdays,
      timezone: state.user.timezone,
    })
    onClose()
  }

  return (
    <div className="sk-scrim fixed inset-0 z-40 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="sk-dialog hide-scrollbar flex max-h-[85vh] w-full max-w-sm flex-col gap-4 overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2 className="sk-heading text-[22px] text-text-primary">Позвать в кружок</h2>
          {/* Цена названа до выбора, а не после: кружок — это чужая галочка рядом с твоей и общий
              счёт, и человек должен знать, чего он **не** получает, прежде чем позовёт. */}
          <p className="text-[13px] text-text-muted">
            {person.name} будет видеть твою галочку, а ты — её. Дорогу это не трогает: твой день
            считается по твоим привычкам, как и раньше.
          </p>
        </div>

        {habits.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            Сначала заведи привычку — зовут своей, с её днями недели.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <p className="sk-eyebrow">Какой привычкой зовёшь</p>
              {habits.map(({ task, busy }) => (
                <button
                  key={task.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setChosen(task.id)}
                  className="sk-focus flex items-center gap-3 rounded-[16px] border px-3.5 py-3 text-left disabled:opacity-40"
                  style={{
                    borderColor: chosen === task.id ? 'var(--color-brand)' : 'var(--color-border)',
                    backgroundColor: 'var(--color-surface-raised)',
                  }}
                >
                  <HabitGlyph icon={task.icon} title={task.title} size={20} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-text-primary">{task.title}</span>
                    <span className="block text-[12px] text-text-muted">
                      {busy ? 'Уже в кружке' : describeSchedule(task.weekdays)}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* Расписание — единственное, о чём стоит предупредить: соглашаются именно на него, и
                «я бегаю Пн Ср Пт, она Вт Чт» кружком не бывает. */}
            <p className="text-[12px] text-text-muted">
              Дни недели поедут вместе с названием — в кружке расписание одно на двоих.
            </p>

            <button
              type="button"
              disabled={chosen === null || sending}
              onClick={() => void send()}
              className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus"
            >
              Позвать
            </button>
          </>
        )}

        <button type="button" onClick={onClose} className="sk-btn sk-btn-ghost sk-btn-block sk-press sk-focus">
          Не сейчас
        </button>
      </div>
    </div>
  )
}
