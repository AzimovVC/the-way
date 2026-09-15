import { useState } from 'react'
import AddGoalFlow from '../components/AddGoalFlow'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import TaskEditorModal from '../components/TaskEditorModal'
import { MILESTONE_MIN_COMPLETION_RATE } from '../domain/config'
import { addTaskToGoal, archiveGoal, removeTaskFromGoal } from '../domain/goalManagement'
import { isSingleTaskGoal } from '../domain/goalShape'
import { TIER_LABEL, computeMilestoneProgress } from '../domain/milestones'
import type { Day, TaskTemplate } from '../domain/models'
import { describeSchedule } from '../domain/schedule'
import { useAppState } from '../state/appState'

const MAX_TASKS_PER_GOAL = 5

/**
 * What the road cannot draw: how far this task is into its milestone, and how honestly.
 *
 * The two numbers are deliberately labelled apart, because they are counted on different
 * calendars and would otherwise look like one of them is lying. The bar is calendar days —
 * a day the task was never asked for still earns its +1. The average is read only over the
 * days it *was* asked for. So «40 / 66 дн.» next to «71%» is not a contradiction.
 */
function MilestoneBlock({ task, days }: { task: TaskTemplate; days: Day[] }) {
  const progress = computeMilestoneProgress(task, days)
  const target = progress.nextTierTarget
  // avg is 0 both when every asked day was missed and when the task was never asked at all —
  // but a miss always leaves a miss streak, so a zero average with no miss streak means the
  // calendar simply has not reached this task yet. Saying «0%» there would be an accusation.
  const neverAsked = progress.avgCompletionRate === 0 && progress.longestMissStreak === 0
  const percent = Math.round(progress.avgCompletionRate * 100)
  const gatePercent = Math.round(MILESTONE_MIN_COMPLETION_RATE * 100)
  const atGate = progress.avgCompletionRate >= MILESTONE_MIN_COMPLETION_RATE

  return (
    <div className="flex flex-col gap-1.5">
      {progress.nextTier && target !== null ? (
        <>
          <div className="flex items-baseline justify-between gap-2">
            <span className="sk-eyebrow">До «{TIER_LABEL[progress.nextTier]}»</span>
            <span className="sk-num text-[13px] text-text-secondary">
              {progress.progressDays} / {target} дн.
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-track">
            <div
              className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]"
              style={{
                width: `${Math.min(100, (progress.progressDays / target) * 100)}%`,
                backgroundColor: 'var(--color-day-green)',
              }}
            />
          </div>
        </>
      ) : (
        <p className="text-[13px] text-text-muted">Все вехи взяты.</p>
      )}

      <p className="text-[12px] text-text-muted">
        {neverAsked ? (
          'Средний процент появится, когда задачу спросят в первый раз.'
        ) : (
          <>
            <span className="sk-num font-semibold" style={{ color: atGate ? 'var(--color-day-green)' : 'var(--color-text-secondary)' }}>
              {percent}%
            </span>{' '}
            в дни, когда спрашивали — веха открывается с {gatePercent}%.
          </>
        )}
      </p>
    </div>
  )
}

export default function TasksScreen() {
  const { state, setState } = useAppState()
  const { user } = state
  const [addingGoal, setAddingGoal] = useState(false)
  // Which goal's "new task" sheet is open, if any — the goal id doubles as the open flag.
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null)

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-5 px-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="sk-heading text-[32px] text-text-primary">Задачи</h1>
          <button
            type="button"
            onClick={() => setAddingGoal(true)}
            className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
          >
            <Icon name="plus" size={16} />
            Цель
          </button>
        </div>

        {user.goals.length === 0 && (
          <p className="text-[15px] text-text-secondary">
            Пока ни одной цели. Добавь первую — и дорога начнёт её считать.
          </p>
        )}

        {user.goals.map((goal) => {
          // A goal that is still its own single task is shown as one line. Drawing a heading
          // with a list of one identical name under it says the name twice and implies there is
          // a second level here when there is not.
          const single = isSingleTaskGoal(goal)
          return (
            <section key={goal.id} className={`sk-card flex flex-col gap-3 ${goal.archived ? 'opacity-50' : ''}`}>
              {/* Архивировать/Удалить стоят приглушёнными: на вкладке первого уровня коралл рядом
                  с названием читается как главное действие карточки, хотя это самое редкое из них. */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="sk-heading truncate text-[19px] text-text-primary">{goal.title}</p>
                  {single && <p className="text-[13px] text-text-muted">{describeSchedule(goal.tasks[0].weekdays)}</p>}
                </div>
                {goal.archived ? (
                  <span className="shrink-0 text-[13px] text-text-muted">В архиве</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setState(archiveGoal(state, goal.id))}
                    className="sk-press sk-focus shrink-0 rounded-[8px] px-2 py-1 text-[13px] font-bold text-text-muted"
                  >
                    Архивировать
                  </button>
                )}
              </div>

              {/* Editing the daily set is the one thing here the road records. Adding or dropping a
                  task changes what every following day is judged against, so it leaves a permanent
                  mark on today's circle — see goalManagement. */}
              {goal.tasks.length === 0 && <p className="text-[13px] text-text-muted">Пока ни одной задачи.</p>}

              {single ? (
                <MilestoneBlock task={goal.tasks[0]} days={state.days} />
              ) : (
                goal.tasks.map((task) => (
                  <div key={task.id} className="sk-card-nested flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[15px] text-text-primary">{task.title}</span>
                        <span className="text-[12px] text-text-muted">{describeSchedule(task.weekdays)}</span>
                      </div>
                      {!goal.archived && (
                        <button
                          type="button"
                          onClick={() => setState(removeTaskFromGoal(state, goal.id, task.id))}
                          className="sk-press sk-focus shrink-0 rounded-[8px] px-1.5 py-1 text-[13px] font-bold text-text-muted"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                    <MilestoneBlock task={task} days={state.days} />
                  </div>
                ))
              )}

              {/* Splitting and adding are the same act — a second task is what makes the goal a
                  goal — so it is one button under either label. */}
              {!goal.archived && goal.tasks.length < MAX_TASKS_PER_GOAL && (
                <button
                  type="button"
                  onClick={() => setAddingTaskTo(goal.id)}
                  className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
                >
                  {single ? 'Разбить на задачи' : 'Добавить задачу'}
                </button>
              )}
            </section>
          )
        })}
      </div>

      {addingGoal && <AddGoalFlow onClose={() => setAddingGoal(false)} />}
      {addingTaskTo && (
        <TaskEditorModal
          onSave={(value) => {
            setState(addTaskToGoal(state, addingTaskTo, value))
            setAddingTaskTo(null)
          }}
          onCancel={() => setAddingTaskTo(null)}
        />
      )}
    </AppShell>
  )
}
