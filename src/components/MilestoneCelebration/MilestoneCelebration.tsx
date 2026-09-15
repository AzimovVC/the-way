import { useState } from 'react'
import Icon from '../Icon'
import TaskEditorModal, { type TaskEditorValue } from '../TaskEditorModal'
import { TIER_LABEL } from '../../domain/milestones'
import { addTaskToGoal } from '../../domain/goalManagement'
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

export default function MilestoneCelebration({ celebration, onClose }: { celebration: CelebrationInfo; onClose: () => void }) {
  const { state, setState } = useAppState()
  const [addingTask, setAddingTask] = useState(false)
  const { report } = celebration

  function saveNewTask(value: TaskEditorValue) {
    setState(addTaskToGoal(state, celebration.goalId, value))
    setAddingTask(false)
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

        <dl className="grid grid-cols-2 gap-3 text-left text-[12px] text-text-muted">
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

        <div className="flex flex-col gap-2 pt-2">
          <button type="button" onClick={onClose} className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus">
            Продолжать эту привычку
          </button>
          <button
            type="button"
            onClick={() => setAddingTask(true)}
            className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus"
          >
            Создать новую задачу
          </button>
        </div>
      </div>

      {addingTask && <TaskEditorModal onSave={saveNewTask} onCancel={() => setAddingTask(false)} />}
    </div>
  )
}
