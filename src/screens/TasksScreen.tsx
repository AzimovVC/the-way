import { useState } from 'react'
import AddGoalFlow from '../components/AddGoalFlow'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import TaskEditorModal from '../components/TaskEditorModal'
import { dayWord, formatWeekdayOn, timesWord } from '../domain/calendar'
import {
  MILESTONE_MAX_MISS_STREAK,
  MILESTONE_MIN_COMPLETION_RATE,
  MILESTONE_MISS_STREAK_FORGIVE_DAYS,
} from '../domain/config'
import { addTaskToGoal, archiveGoal, removeTaskFromGoal } from '../domain/goalManagement'
import { isSingleTaskGoal } from '../domain/goalShape'
import { TIER_LABEL, computeMilestoneProgress } from '../domain/milestones'
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

/** One horizontal gauge, drawn on whatever fraction is actually being waited on. */
function Gauge({ value, target, atGate }: { value: number; target: number; atGate: boolean }) {
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-track">
      <div
        className="h-full rounded-full transition-[width] duration-[var(--dur-slow)]"
        style={{
          width: `${Math.min(100, (value / target) * 100)}%`,
          backgroundColor: atGate ? 'var(--color-day-green)' : 'var(--color-text-secondary)',
        }}
      />
    </div>
  )
}

/**
 * What the road cannot draw: how far this task is into its milestone, and how honestly.
 *
 * Only the condition still holding the tier gets the bar. The two numbers are counted on
 * different calendars — the days are calendar days, where a day the task was never asked for
 * still earns its +1, and the average is read only over the days it *was* asked for — so a task
 * can be long past its day target and still be waiting. Drawing the days in that state fills the
 * bar to the end beside a milestone that is not coming, and the card says «дошёл» and «не дошёл»
 * in the same breath. So the bar follows `blocker`, and the condition that is already met steps
 * down to a line of text.
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
  const lost = progress.daysLostToMisses

  if (!progress.nextTier || target === null) {
    return <p className="text-[13px] text-text-muted">Все ранги взяты.</p>
  }

  const tierName = TIER_LABEL[progress.nextTier]

  // Nothing is holding the tier, and it is still not on the road: the award is made when the task
  // is next marked, not when this screen is drawn. Falling through to the day bar here would print
  // «24 / 1 дн.» under a bar filled past its end — the very reading this block exists to prevent.
  if (progress.blocker === null) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="sk-eyebrow">Ранг «{tierName}» набран</span>
        <p className="text-[13px] text-text-secondary">Отметь задачу — и она встанет на дорогу.</p>
      </div>
    )
  }

  // A streak past the limit used to be the end of the road: the cycle only restarts when a tier is
  // taken, so the tier was closed for good. It ages out now, and saying when is the whole point —
  // the number that matters here is the one counting down, not the one counting the damage.
  if (progress.blocker === 'missStreak') {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="sk-eyebrow">До «{tierName}»</span>
        <p className="text-[13px] text-text-secondary">
          Пропущено{' '}
          <span className="sk-num font-semibold">
            {progress.blockingMissStreak} {timesWord(progress.blockingMissStreak)} подряд
          </span>{' '}
          — ранг держится на {MILESTONE_MAX_MISS_STREAK}.
        </p>
        <p className="text-[12px] text-text-muted">
          Перерыв перестанет считаться через{' '}
          <span className="sk-num">
            {MILESTONE_MISS_STREAK_FORGIVE_DAYS} {dayWord(MILESTONE_MISS_STREAK_FORGIVE_DAYS)}
          </span>{' '}
          после последнего пропуска. Дни идут своим ходом и не ждут.
        </p>
      </div>
    )
  }

  // The honesty gate is the last thing standing: the days are in, so they become the footnote and
  // the percent takes the bar. Without this the bar would sit full while nothing was arriving.
  if (progress.blocker === 'rate') {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="sk-eyebrow">Ранг ждёт стабильности</span>
          <span className="sk-num text-[13px] text-text-secondary">
            {percent}% / {gatePercent}%
          </span>
        </div>
        <Gauge value={progress.avgCompletionRate} target={MILESTONE_MIN_COMPLETION_RATE} atGate={false} />
        <p className="text-[12px] text-text-muted">
          Дни до «{tierName}» набраны:{' '}
          <span className="sk-num">
            {progress.progressDays} из {target}
          </span>
          . Процент считается по дням, когда задачу спрашивали.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="sk-eyebrow">До «{tierName}»</span>
        <span className="sk-num text-[13px] text-text-secondary">
          {progress.progressDays} / {target} дн.
        </span>
      </div>
      <Gauge value={progress.progressDays} target={target} atGate />

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
            <span
              className="sk-num font-semibold"
              style={{
                color:
                  progress.avgCompletionRate >= MILESTONE_MIN_COMPLETION_RATE
                    ? 'var(--color-day-green)'
                    : 'var(--color-text-secondary)',
              }}
            >
              {percent}%
            </span>{' '}
            в дни, когда спрашивали — ранг открывается с {gatePercent}%.
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
