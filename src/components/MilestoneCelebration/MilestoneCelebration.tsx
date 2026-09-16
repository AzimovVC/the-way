import { useState } from 'react'
import Icon from '../Icon'
import { TIER_LABEL, nextTier } from '../../domain/milestones'
import { formatShortDate } from '../../domain/calendar'
import { archiveGoal, removeTaskFromGoal } from '../../domain/goalManagement'
import { useAppState, type CelebrationInfo } from '../../state/appState'

/**
 * Tiers are told apart by the medal's colour, not by a different glyph — the
 * system carries state in a glyph plus a colour and never uses emoji.
 */
const TIER_COLOR: Record<CelebrationInfo['tier'], { fill: string; plinth: string }> = {
  bronze: { fill: 'var(--rust-500)', plinth: 'var(--coral-700)' },
  gold: { fill: 'var(--marigold-500)', plinth: 'var(--marigold-700)' },
  platinum: { fill: 'var(--ink-100)', plinth: 'var(--ink-400)' },
}

/**
 * The one screen where the habit is genuinely finished: the days the person set for themselves
 * are walked out, and what happens next is theirs to say — keep going for the next rank, or close
 * this habit here. The app has no opinion; a habit taken to its target and stopped on purpose is
 * not a habit abandoned, and continuing is not the only honest answer.
 *
 * Both answers have to be on this screen, because it is the only moment the question is live. A
 * card in a list asking «продолжать или закончить?» every day would be the app nagging someone to
 * quit.
 */
export default function MilestoneCelebration({ celebration, onClose }: { celebration: CelebrationInfo; onClose: () => void }) {
  const { state, setState } = useAppState()
  const [confirmingFinish, setConfirmingFinish] = useState(false)
  const { report } = celebration
  const upcoming = nextTier(celebration.tier)

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
          style={{
            backgroundColor: TIER_COLOR[celebration.tier].fill,
            boxShadow: `0 6px 0 ${TIER_COLOR[celebration.tier].plinth}`,
          }}
        >
          <Icon name="award" size={38} color="var(--ink-950)" />
        </div>
        <h2 className="sk-heading text-[22px] text-text-primary">
          Ты сделал это. {TIER_LABEL[celebration.tier]} — {celebration.goalTitle}
        </h2>
        <p className="text-[15px] text-text-secondary">{report.message}</p>

        {/* Said once, above the numbers: the cycle runs from the first day of the habit, not from
            the last rank, so these count the whole way here. */}
        <p className="sk-eyebrow">
          За всё время привычки · {formatShortDate(report.cycleStartDate)} — {formatShortDate(report.cycleEndDate)}
        </p>
        <dl className="grid grid-cols-2 gap-3 text-left text-[12px] text-text-muted">
          <div>
            <dt>Дней пройдено</dt>
            <dd className="sk-num text-[19px] text-text-primary">
              {report.daysWalked} <span className="text-[13px] text-text-muted">из {report.targetDays}</span>
            </dd>
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
            {/* Ending the habit stamps today's day and stops the task being asked for, and the
                dialog arrived over a tap the person made for a different reason — so it asks. */}
            <p className="text-[13px] text-text-secondary">
              Завершить «{celebration.goalTitle}»? Задача перестанет спрашиваться, а пройденный путь
              останется на дороге.
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
              {upcoming ? `Дальше — «${TIER_LABEL[upcoming]}»` : 'Продолжать эту привычку'}
            </button>
            {/* What continuing costs, said before the tap rather than discovered on the card
                afterwards. The days already walked past the target count toward it — the cycle
                does not restart — so this is the remainder, not the whole next rank. */}
            {upcoming && report.nextTierTarget !== null ? (
              <p className="text-[12px] text-text-muted">
                До «{TIER_LABEL[upcoming]}» — ещё{' '}
                <span className="sk-num">{Math.max(0, report.nextTierTarget - report.daysWalked)}</span> дн.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => setConfirmingFinish(true)}
              className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus"
            >
              Завершить привычку
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
