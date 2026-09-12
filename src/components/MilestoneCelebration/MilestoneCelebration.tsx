import { useState } from 'react'
import TaskEditorModal, { type TaskEditorValue } from '../TaskEditorModal'
import { TIER_LABEL } from '../../domain/milestones'
import { addTaskToGoal } from '../../domain/goalManagement'
import { useAppState, type CelebrationInfo } from '../../state/AppStateContext'

const TIER_EMOJI: Record<CelebrationInfo['tier'], string> = {
  bronze: '🏆',
  gold: '🥇',
  platinum: '💎',
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
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
        <div className="text-5xl">{TIER_EMOJI[celebration.tier]}</div>
        <h2 className="text-lg font-semibold text-text-primary">
          Ты сделал это! {TIER_LABEL[celebration.tier]} — {celebration.goalTitle}
        </h2>
        <p className="text-sm text-text-secondary">{report.message}</p>

        <dl className="grid grid-cols-2 gap-3 text-left text-xs text-text-secondary">
          <div>
            <dt>Пропущено дней</dt>
            <dd className="text-sm font-medium text-text-primary">{report.missedDays}</dd>
          </div>
          <div>
            <dt>Серий пропусков</dt>
            <dd className="text-sm font-medium text-text-primary">{report.missStreakCount}</dd>
          </div>
          <div>
            <dt>Среднее восстановление</dt>
            <dd className="text-sm font-medium text-text-primary">{report.avgRecoveryDays.toFixed(1)} дн.</dd>
          </div>
          <div>
            <dt>Средняя выполняемость</dt>
            <dd className="text-sm font-medium text-text-primary">{Math.round(report.avgCompletionRate * 100)}%</dd>
          </div>
          <div>
            <dt>Заморозок использовано</dt>
            <dd className="text-sm font-medium text-text-primary">{report.freezesUsed}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg">
            Продолжать эту привычку
          </button>
          <button
            type="button"
            onClick={() => setAddingTask(true)}
            className="rounded-lg border border-border px-4 py-2.5 text-sm text-text-primary"
          >
            Создать новую задачу
          </button>
        </div>
      </div>

      {addingTask && <TaskEditorModal onSave={saveNewTask} onCancel={() => setAddingTask(false)} />}
    </div>
  )
}
