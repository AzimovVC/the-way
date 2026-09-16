import { useState } from 'react'
import Icon from '../Icon'
import { formatShortDate } from '../../domain/calendar'
import { rankAfter, rankLabel } from '../../domain/ranks'
import { archiveGoal, removeTaskFromGoal } from '../../domain/goalManagement'
import { RANK_COLOR, RANK_PLINTH } from '../rankColor'
import { useAppState, type CelebrationInfo } from '../../state/appState'

/**
 * The two moments a habit stops to say something, on one screen because they are the same shape.
 *
 * A **rank** is a rung of the ladder every habit shares — «вот сколько ты уже держишь». It has one
 * button, because there is nothing to decide: the road goes on.
 *
 * A **target** is the finish the person set for themselves when they picked the difficulty, and it
 * is the only place the app asks whether to keep going or to close this habit. Both answers are
 * honest: a habit taken to its target and stopped on purpose is not a habit abandoned. The question
 * lives only here — a card in a list asking it every day would be the app nagging someone to quit.
 */
export default function MilestoneCelebration({ celebration, onClose }: { celebration: CelebrationInfo; onClose: () => void }) {
  const { state, setState } = useAppState()
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const { report, rank } = celebration
  const isTarget = celebration.kind === 'target'
  const color = rank ? RANK_COLOR[rank.id] : 'var(--color-brand)'
  const plinth = rank ? RANK_PLINTH[rank.id] : 'var(--color-brand-plinth)'
  const toGo = Math.max(0, report.nextRankDays - report.daysWalked)

  function finishHabit() {
    const goal = state.user.goals.find((g) => g.id === celebration.goalId)
    // A goal that is its own single task ends as a goal — dropping its last task would leave
    // something that asks nothing and reads as «never started». A task among others just leaves.
    const next =
      goal && goal.tasks.length > 1
        ? removeTaskFromGoal(state, celebration.goalId, celebration.taskId)
        : archiveGoal(state, celebration.goalId)
    setState(next)
    onClose()
  }

  return (
    <div className="sk-scrim fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="sk-dialog flex w-full max-w-sm flex-col gap-4 p-6 text-center">
        <div
          className="mx-auto grid size-[76px] place-items-center rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 6px 0 ${plinth}` }}
        >
          <Icon name={isTarget ? 'flag' : 'award'} size={38} color="var(--ink-950)" />
        </div>

        <h2 className="sk-heading text-[22px] text-text-primary">
          {isTarget ? `Цель пройдена — ${celebration.taskTitle}` : `${rank ? rankLabel(rank) : ''} — ${celebration.taskTitle}`}
        </h2>
        <p className="text-[15px] text-text-secondary">{report.message}</p>

        {/* Said once, above the numbers: the day count runs from the first day of the habit and
            never restarts, so these count the whole way here. */}
        <p className="sk-eyebrow">
          За всё время привычки · {formatShortDate(report.cycleStartDate)} — {formatShortDate(report.cycleEndDate)}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-left text-[12px] text-text-muted">
          <div>
            {/* Just the days. The threshold is already in the sentence above, and «38 из 21» on
                a habit that kept going long past its target reads as a bug, not as a record. */}
            <dt>Дней пройдено</dt>
            <dd className="sk-num text-[19px] text-text-primary">{report.daysWalked}</dd>
          </div>
          <div>
            <dt>Пропущено дней</dt>
            <dd className="sk-num text-[19px] text-text-primary">{report.missedDays}</dd>
          </div>
          <div>
            <dt>Серий пропусков</dt>
            <dd className="sk-num text-[19px] text-text-primary">{report.missStreakCount}</dd>
          </div>
          <div>
            <dt>Среднее восстановление</dt>
            <dd className="sk-num text-[19px] text-text-primary">{report.avgRecoveryDays.toFixed(1)} дн.</dd>
          </div>
          <div>
            <dt>Средняя выполняемость</dt>
            <dd className="sk-num text-[19px] text-text-primary">{Math.round(report.avgCompletionRate * 100)}%</dd>
          </div>
          <div>
            <dt>Заморозок использовано</dt>
            <dd className="sk-num text-[19px] text-text-primary">{report.freezesUsed}</dd>
          </div>
        </dl>

        {confirmingFinish ? (
          <div className="flex flex-col gap-2 pt-2">
            {/* Ending the habit stops the task being asked for, and the dialog arrived over a tap
                the person made for a different reason — so it asks. */}
            <p className="text-[13px] text-text-secondary">
              Завершить «{celebration.taskTitle}»? Задача перестанет спрашиваться, а пройденный путь
              останется на дороге и на витрине.
            </p>
            <button type="button" onClick={finishHabit} className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus">
              Да, завершить
            </button>
            <button
              type="button"
              onClick={() => setConfirmingFinish(false)}
              className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus"
            >
              Отмена
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 pt-2">
            <button type="button" onClick={onClose} className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus">
              {isTarget ? 'Продолжать эту привычку' : 'Дальше'}
            </button>
            {/* What continuing costs, said before the tap rather than discovered on the card
                afterwards. The days already walked count toward it — the day count never restarts
                — so this is the remainder, not the whole next rank. */}
            <p className="text-[12px] text-text-muted">
              До «{rankLabel(rankAfter(report.nextRankDays - 1))}» — ещё <span className="sk-num">{toGo}</span> дн.
            </p>
            {isTarget && (
              <button
                type="button"
                onClick={() => setConfirmingFinish(true)}
                className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus"
              >
                Завершить привычку
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
