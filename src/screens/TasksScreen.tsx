import { useState } from 'react'
import AddGoalFlow from '../components/AddGoalFlow'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import TaskEditorModal from '../components/TaskEditorModal'
import { dayWord, formatWeekdayOn } from '../domain/calendar'
import { addTaskToGoal, archiveGoal, removeTaskFromGoal } from '../domain/goalManagement'
import { isSingleTaskGoal } from '../domain/goalShape'
import { computeMilestoneProgress } from '../domain/milestones'
import { rankLabel } from '../domain/ranks'
import { RANK_COLOR } from '../components/rankColor'
import type { Day, TaskTemplate } from '../domain/models'
import { getLogicalToday } from '../domain/pathEngine'
import { describeSchedule, readTaskToday } from '../domain/schedule'
import { useAppState } from '../state/appState'

const MAX_TASKS_PER_GOAL = 5

/**
 * The schedule, and then what it means today.
 *
 * This is the only list of tasks in the app, and «Пн Ср Пт» on its own states the rule without
 * stating the state — the person is left to work out whether today is one of those letters and
 * whether they have already marked it. A day off says when the task comes back, because a bare
 * «сегодня не спрашивают» reads as the task having quietly stopped.
 */
function ScheduleLine({ task, days, today }: { task: TaskTemplate; days: Day[]; today: string }) {
  const state = readTaskToday(task, days.find((d) => d.date === today), today)
  const mark =
    state.kind === 'done'
      ? { text: 'Сегодня отмечено', color: 'var(--color-day-green)' }
      : state.kind === 'pending'
        ? { text: 'Сегодня ещё не отмечено', color: 'var(--color-text-secondary)' }
        : {
            text: state.nextDate
              ? `Сегодня не спрашивают, снова ${formatWeekdayOn(state.nextDate)}`
              : 'Сегодня не спрашивают',
            color: 'var(--color-text-muted)',
          }

  // Two lines, not one joined by a separator: the row shares its width with the goal's own
  // controls, and a single line breaks in the middle of the phrase — «Пн Ср Пт · сегодня ждёт /
  // отметки» reads as one broken sentence instead of a rule and its state.
  return (
    <>
      <p className="text-[13px] text-text-muted">{describeSchedule(task.weekdays)}</p>
      <p className="text-[12px]" style={{ color: mark.color }}>
        {mark.text}
      </p>
    </>
  )
}

/** The days walked against the days the next thing asks for — the only bar on this card. */
function Gauge({ value, target }: { value: number; target: number }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-track">
      <div
        className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]"
        style={{
          width: `${Math.min(100, (value / target) * 100)}%`,
          backgroundColor: 'var(--color-day-green)',
        }}
      />
    </div>
  )
}

/**
 * What the road cannot draw: how far this habit is into what it is walking toward.
 *
 * One bar, and it is the days — the only thing that decides anything here. Which days, though,
 * depends on where the habit stands: until the person reaches the finish they set for themselves,
 * that finish is the bar, because it is theirs; afterwards the bar is the next rung of the ladder
 * every habit shares. The rank standing now is one line under it, never a second gauge.
 *
 * The percent below is a description of the run and says so; it used to be a second condition, and
 * a person who had walked out the days was told «ранг ждёт стабильности» over a bar filled past
 * its end, with no number anywhere saying what would open it.
 */
function MilestoneBlock({ task, days }: { task: TaskTemplate; days: Day[] }) {
  const progress = computeMilestoneProgress(task, days)
  // avg is 0 both when every asked day was missed and when the task was never asked at all —
  // but a miss always leaves a miss streak, so a zero average with no miss streak means the
  // calendar simply has not reached this task yet. Saying «0%» there would be an accusation.
  const neverAsked = progress.avgCompletionRate === 0 && progress.longestMissStreak === 0
  const percent = Math.round(progress.avgCompletionRate * 100)
  const lost = progress.daysLostToMisses
  const rank = progress.currentRank

  const goingTo = progress.targetReached
    ? { eyebrow: `До «${rankLabel(progress.nextRank)}»`, days: progress.nextRank.days }
    : { eyebrow: 'До своей цели', days: progress.targetDays }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="sk-eyebrow">{goingTo.eyebrow}</span>
        <span className="sk-num text-[13px] text-text-secondary">
          {progress.progressDays} / {goingTo.days} дн.
        </span>
      </div>
      <Gauge value={progress.progressDays} target={goingTo.days} />

      {/* Where the habit stands on the one ladder all of them share. Said as a line and not as a
          second bar: two gauges on one card make the person pick which one is the real one. */}
      <p className="flex items-center gap-1.5 text-[12px] text-text-muted">
        {rank ? (
          <>
            <span className="size-2 rounded-full" style={{ backgroundColor: RANK_COLOR[rank.id] }} />
            <span>
              Ранг: <span className="font-semibold text-text-secondary">{rankLabel(rank)}</span> · {rank.days} дн.
            </span>
          </>
        ) : (
          <span>
            Первый ранг — «{rankLabel(progress.nextRank)}», {progress.nextRank.days} дн.
          </span>
        )}
      </p>

      {/* A shrunken bar after weeks of work is the one number on this screen that looks like a bug,
          so the ground a gap took is named — and, because it is being repaid double, the same line
          is where the comeback becomes visible instead of living only in the arithmetic. */}
      {lost > 0 && (
        <p className="text-[12px]" style={{ color: 'var(--color-day-green)' }}>
          Возвращение: день идёт за два, осталось отыграть{' '}
          <span className="sk-num font-semibold">
            {lost} {dayWord(lost)}
          </span>
          .
        </p>
      )}

      <p className="text-[12px] text-text-muted">
        {neverAsked ? (
          'Средний процент появится, когда задачу спросят в первый раз.'
        ) : (
          <>
            <span className="sk-num font-semibold text-text-secondary">{percent}%</span> в дни, когда
            спрашивали. Пропуски уже посчитаны в днях выше.
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
  // The logical day, not the calendar one: before 3:00 the day still being marked is yesterday's.
  const today = getLogicalToday(new Date())

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
                  {single && <ScheduleLine task={goal.tasks[0]} days={state.days} today={today} />}
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
                        <ScheduleLine task={task} days={state.days} today={today} />
                      </div>
                      {/* Последнюю задачу цели удалить нельзя: цель без задач ничего не
                          спрашивает, а цель — это «Архивировать». */}
                      {!goal.archived && goal.tasks.length > 1 && (
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
