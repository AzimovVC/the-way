import { useState } from 'react'
import AddGoalFlow from '../components/AddGoalFlow'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import MetricInfo from '../components/MetricInfo'
import RankBadge from '../components/RankBadge'
import TaskEditorModal, { type TaskEditorValue } from '../components/TaskEditorModal'
import { RANK_COLOR } from '../components/rankColor'
import { dayWord, formatShortDate, formatWeekdayOn } from '../domain/calendar'
import { TASK_DIFFICULTY_TARGET_DAYS, type TaskDifficulty } from '../domain/config'
import { addTaskToGoal, archiveGoal, editTaskInGoal, removeTaskFromGoal } from '../domain/goalManagement'
import { isSingleTaskGoal } from '../domain/goalShape'
import { computeMilestoneProgress, projectedArrivalDate } from '../domain/milestones'
import type { Day, TaskTemplate } from '../domain/models'
import { getLogicalToday } from '../domain/pathEngine'
import { rankLabel, rankMeaning } from '../domain/ranks'
import { EVERY_DAY, describeSchedule, readTaskToday } from '../domain/schedule'
import { useAppState } from '../state/appState'

const MAX_TASKS_PER_GOAL = 5

/**
 * Which difficulty a running task's finish came from. The task stores the days, not the word, and
 * the editor speaks in words — a finish that matches none of them (an older build, a finish that
 * moved) opens on «Средняя» rather than pretending the number is gone.
 */
function difficultyOf(targetDays: number): TaskDifficulty {
  const found = (Object.keys(TASK_DIFFICULTY_TARGET_DAYS) as TaskDifficulty[]).find(
    (d) => TASK_DIFFICULTY_TARGET_DAYS[d] === targetDays,
  )
  return found ?? 'medium'
}

/**
 * The schedule, and then what it means today.
 *
 * «Пн Ср Пт» on its own states the rule without stating the state — the person is left to work out
 * whether today is one of those letters and whether they have already marked it. A day off says
 * when the task comes back, because a bare «сегодня не спрашивают» reads as the task having
 * quietly stopped.
 */
function todayLine(task: TaskTemplate, days: Day[], today: string) {
  const state = readTaskToday(task, days.find((d) => d.date === today), today)
  if (state.kind === 'done') return { text: 'Сегодня отмечено', color: 'var(--color-day-green)' }
  if (state.kind === 'pending') return { text: 'Сегодня ещё не отмечено', color: 'var(--color-text-secondary)' }
  return {
    text: state.nextDate ? `Сегодня не спрашивают, снова ${formatWeekdayOn(state.nextDate)}` : 'Сегодня не спрашивают',
    color: 'var(--color-text-muted)',
  }
}

/**
 * One habit, one row.
 *
 * The card used to print everything it knew at once — rung ahead, bar, rank, percent, its caveat —
 * and two habits filled the screen. A person opens this tab to see where the habits stand and what
 * today asks of them; that is a medal, a name, a schedule and a bar, and the rest is reading they
 * do once. So the rest waits behind the row, in the same shape the habits shelf already uses.
 *
 * What may not hide behind a tap is a caveat on a number that stays on screen. The percent goes in
 * with its own caveat, which is honest — a number that is not shown needs no footnote. The comeback
 * line does not: the bar it explains is right here, shrunken, and without it the weeks of work look
 * like a bug.
 */
function TaskRow({
  title,
  task,
  days,
  today,
  open,
  onToggle,
  actions,
}: {
  title: string
  task: TaskTemplate
  days: Day[]
  today: string
  open: boolean
  onToggle: () => void
  actions?: React.ReactNode
}) {
  const progress = computeMilestoneProgress(task, days)
  const rank = progress.currentRank
  const color = rank ? RANK_COLOR[rank.id] : 'var(--color-day-green)'
  const mark = todayLine(task, days, today)
  const lost = progress.daysLostToMisses

  // Which days the bar is walking to depends on where the habit stands: until the person reaches
  // the finish they set for themselves, that finish is the bar, because it is theirs; afterwards
  // the bar is the next rung of the ladder every habit shares.
  const goingTo = progress.targetReached
    ? { label: `До «${rankLabel(progress.nextRank)}»`, days: progress.nextRank.days }
    : { label: 'До своей цели', days: progress.targetDays }
  const toGo = Math.max(0, goingTo.days - progress.progressDays)

  // avg is 0 both when every asked day was missed and when the task was never asked at all —
  // but a miss always leaves a miss streak, so a zero average with no miss streak means the
  // calendar simply has not reached this task yet. Saying «0%» there would be an accusation.
  const neverAsked = progress.avgCompletionRate === 0 && progress.longestMissStreak === 0
  const percent = Math.round(progress.avgCompletionRate * 100)

  // The three pieces of the bar. The debt is drawn beyond the fill and clipped at the finish: past
  // it the segment would say the habit owes ground it no longer needs. The notch is where the fill
  // can no longer retreat to — the rung already taken.
  const fill = Math.min(progress.progressDays, goingTo.days)
  const debtWidth = Math.max(0, Math.min(lost, goingTo.days - fill))
  const floorAt = (progress.floorDays / goingTo.days) * 100

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="sk-press sk-focus flex items-center gap-3 rounded-[20px] px-3.5 py-3 text-left"
      >
        <RankBadge rank={rank?.id ?? null} size={40} letter={title.trim().slice(0, 1).toUpperCase()} />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-bold text-text-primary">{title}</span>
            {/* «40 / 66» is a fraction with no noun: the person is left to guess what 66 is, and
                the only place that says it is behind the chevron. Days walked need no denominator,
                and the level standing beside them says what the bar under it is walking away from
                — so the row reads without being opened. */}
            <span className="shrink-0 text-[13px] text-text-secondary">
              {rank && (
                <span className="font-semibold" style={{ color }}>
                  {rankLabel(rank)} ·{' '}
                </span>
              )}
              <span className="sk-num">{progress.progressDays}</span> {dayWord(progress.progressDays)}
            </span>
          </div>

          {/* The bar is in the colour of the rank standing now, the same colour as the medal beside
              it: one habit, one colour, so the row reads as a single object and not as a green bar
              that happens to sit under a blue medal.
      
              The ground a gap took is drawn, not written: a faded segment ahead of the fill is
              exactly what the misses cost and what the comeback is walking back over. Said in a
              sentence it was the only prose on a row of shapes; said here it is the same fact in
              the same place the number lives, and a bar that shrank after weeks of work stops
              looking like a bug. */}
          <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-surface-track">
            <div
              className="h-full transition-[width] duration-[var(--dur-slow)]"
              style={{ width: `${(fill / goingTo.days) * 100}%`, backgroundColor: color }}
            />
            {debtWidth > 0 && (
              <div
                className="h-full transition-[width] duration-[var(--dur-slow)]"
                style={{ width: `${(debtWidth / goingTo.days) * 100}%`, backgroundColor: color, opacity: 0.28 }}
              />
            )}
            {/* The floor, in the row rather than behind the tap: a bar that shrinks after weeks of
                work needs the thing it is standing on to be visible right where it shrinks, and a
                sentence about it inside the panel would be a caveat hidden behind a chevron.

                Cut in the card's own colour, so it reads as a notch in the bar against both the
                fill and the empty track — including the moment the fill has retreated all the way
                onto it, which is exactly when it has something to say. */}
            {progress.floorDays > 0 && (
              <span
                aria-hidden
                className="absolute inset-y-0 w-[2px]"
                style={{ left: `calc(${floorAt}% - 1px)`, backgroundColor: 'var(--color-surface)' }}
              />
            )}
          </div>

          {/* Расписание и то, что оно значит сегодня, — одной строкой: строка тут не делит ширину
              с кнопками цели, а обрезать предложение нельзя, поэтому перенос, а не «…». */}
          <span className="text-[12px] leading-snug text-text-muted">
            {describeSchedule(task.weekdays)} · <span style={{ color: mark.color }}>{mark.text}</span>
          </span>

        </div>

        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} color="var(--color-text-muted)" />
      </button>

      {open && (
        <div className="flex flex-col gap-2 px-3.5 pb-3.5 pl-[66px]">
          <p className="text-[12px] text-text-muted">
            {goingTo.label} — ещё <span className="sk-num">{toGo}</span> {dayWord(toGo)}.
            {toGo > 0 && <> Если не пропускать — {formatShortDate(projectedArrivalDate(today, toGo, lost))}.</>}
          </p>

          {/* Where the habit stands on the one ladder all of them share. Said as a line and not as a
              second bar: two gauges on one row make the person pick which one is the real one.

              «Уровень привычки: Ученик» and not «Ты Ученик»: the name of a habit is whatever the
              person typed, and a sentence built around it breaks on «Читать 30 стр 🔥». A label and
              its value never break. */}
          {rank ? (
            <div className="flex flex-col gap-0.5">
              <p className="flex items-center gap-1.5 text-[12px] text-text-muted">
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                <span>
                  Уровень привычки:{' '}
                  <span className="font-semibold text-text-secondary">{rankLabel(rank)}</span>
                </span>
              </p>
              {/* The rung said in words, and light ones. What the ladder is built from — the study,
                  the spread of 18 to 254 days — lives behind the «?» at the top of the tab: that is
                  a definition, read once, and it has no business sitting under every habit. */}
              <p className="pl-[14px] text-[12px] text-text-muted">{rankMeaning(rank)}</p>
            </div>
          ) : (
            <p className="text-[12px] text-text-muted">
              Первый уровень — «{rankLabel(progress.nextRank)}», это {progress.nextRank.days}{' '}
              {dayWord(progress.nextRank.days)}.
            </p>
          )}

          {/* What the faded segment on the bar is. A definition, so it may live behind the tap —
              what may not is a caveat on a number standing in the open, and the segment is not a
              number, it is the shape of the debt itself. */}
          {lost > 0 && (
            <p className="text-[12px]" style={{ color: 'var(--color-day-green)' }}>
              Возвращение: день идёт за два, осталось отыграть{' '}
              <span className="sk-num font-semibold">
                {lost} {dayWord(lost)}
              </span>
              .
            </p>
          )}

          {/* The percent is a description of the run and says so; it used to be a second condition,
              and a person who had walked out the days was told «ранг ждёт стабильности» over a bar
              filled past its end, with no number anywhere saying what would open it. */}
          <p className="text-[12px] text-text-muted">
            {neverAsked ? (
              'Процент появится, когда привычку спросят в первый раз.'
            ) : (
              <>
                Сделал <span className="sk-num font-semibold text-text-secondary">{percent}%</span> из тех дней, когда
                спрашивали. На уровень это не влияет — пропуски уже вычтены из дней.
              </>
            )}
          </p>

          {actions && <div className="-ml-2 flex flex-wrap items-center gap-1 pt-1">{actions}</div>}
        </div>
      )}
    </div>
  )
}

export default function TasksScreen() {
  const { state, setState } = useAppState()
  const { user } = state
  const [addingGoal, setAddingGoal] = useState(false)
  // Which goal's "new task" sheet is open, if any — the goal id doubles as the open flag.
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null)
  // Which task the edit sheet is open for. Editing exists because the alternative was deleting the
  // task and making it again — which restarts the day count and takes every rank with it.
  const [editing, setEditing] = useState<{ goalId: string; taskId: string } | null>(null)
  // Which row is unfolded. One at a time: the tab exists to compare habits, and three of them open
  // is the long card back again.
  const [openRow, setOpenRow] = useState<string | null>(null)
  // The logical day, not the calendar one: before 3:00 the day still being marked is yesterday's.
  const today = getLogicalToday(new Date())

  const toggle = (id: string) => setOpenRow((current) => (current === id ? null : id))

  const editAction = (goalId: string, taskId: string) => (
    <button
      type="button"
      onClick={() => setEditing({ goalId, taskId })}
      className="sk-press sk-focus rounded-[8px] px-2 py-1 text-[13px] font-bold text-text-secondary"
    >
      Изменить
    </button>
  )

  const editingTask = editing
    ? state.user.goals.find((g) => g.id === editing.goalId)?.tasks.find((t) => t.id === editing.taskId)
    : undefined

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-4 px-4 py-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h1 className="sk-heading text-[32px] text-text-primary">Привычки</h1>
            {/* The one place the ladder explains itself. A definition, so it lives behind the
                button — and the spread of 18 to 254 days is the reason it is worth opening: it is
                what says a slower habit is not a worse one. */}
            <MetricInfo title="Уровень привычки">
              <p>Уровень показывает, сколько дней привычка с тобой.</p>
              <p>Ступени такие: неделя, три недели, два месяца, полгода, год.</p>
              <p>
                Два месяца тут не случайно. В исследовании 2010 года привычка закреплялась в среднем
                за 66 дней. Но кому-то хватило 18 дней, а кому-то понадобилось 254. Свой срок —
                нормальный.
              </p>
            </MetricInfo>
          </div>
          <button
            type="button"
            onClick={() => setAddingGoal(true)}
            className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
          >
            <Icon name="plus" size={16} />
            Привычка
          </button>
        </div>

        {user.goals.length === 0 && (
          <p className="text-[15px] text-text-secondary">
            Пока ни одной привычки. Добавь первую — и дорога начнёт её считать.
          </p>
        )}

        <div className="flex flex-col gap-2">
          {user.goals.map((goal) => {
            // A goal that is still its own single task is one row. Drawing a heading with a list of
            // one identical name under it says the name twice and implies there is a second level
            // here when there is not.
            const single = isSingleTaskGoal(goal)
            const archived = goal.archived

            const archiveAction = archived ? (
              <span className="text-[12px] text-text-muted">Завершена</span>
            ) : (
              <button
                type="button"
                onClick={() => setState(archiveGoal(state, goal.id))}
                className="sk-press sk-focus rounded-[8px] px-2 py-1 text-[13px] font-bold text-text-muted"
              >
                Завершить
              </button>
            )

            const splitAction = !archived && goal.tasks.length < MAX_TASKS_PER_GOAL && (
              <button
                type="button"
                onClick={() => setAddingTaskTo(goal.id)}
                className="sk-press sk-focus rounded-[8px] px-2 py-1 text-[13px] font-bold text-text-secondary"
              >
                Разбить на несколько
              </button>
            )

            return (
              <section
                key={goal.id}
                className="flex flex-col rounded-[20px] border border-border"
                style={{ backgroundColor: 'var(--color-surface-raised)', opacity: archived ? 0.5 : 1 }}
              >
                {single ? (
                  <TaskRow
                    title={goal.title}
                    task={goal.tasks[0]}
                    days={state.days}
                    today={today}
                    open={openRow === goal.tasks[0].id}
                    onToggle={() => toggle(goal.tasks[0].id)}
                    actions={
                      <>
                        {!archived && editAction(goal.id, goal.tasks[0].id)}
                        {splitAction}
                        {archiveAction}
                      </>
                    }
                  />
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2 px-3.5 pt-3.5 pb-1">
                      <p className="sk-heading truncate text-[17px] text-text-primary">{goal.title}</p>
                      {archived ? (
                        <span className="shrink-0 text-[12px] text-text-muted">Завершена</span>
                      ) : (
                        // Приглушённым: на вкладке первого уровня яркая кнопка рядом с названием
                        // читается как главное действие карточки, хотя это самое редкое из них.
                        <button
                          type="button"
                          onClick={() => setState(archiveGoal(state, goal.id))}
                          className="sk-press sk-focus shrink-0 rounded-[8px] px-2 py-1 text-[13px] font-bold text-text-muted"
                        >
                          Завершить
                        </button>
                      )}
                    </div>

                    {goal.tasks.length === 0 && (
                      <p className="px-3.5 pb-3.5 text-[13px] text-text-muted">Пока ни одной привычки.</p>
                    )}

                    {/* Editing the daily set is the one thing here the road records. Adding or
                        dropping a task changes what every following day is judged against, so it
                        leaves a permanent mark on today's circle — see goalManagement. */}
                    {goal.tasks.map((task) => (
                      <TaskRow
                        key={task.id}
                        title={task.title}
                        task={task}
                        days={state.days}
                        today={today}
                        open={openRow === task.id}
                        onToggle={() => toggle(task.id)}
                        actions={
                          <>
                            {!archived && editAction(goal.id, task.id)}
                            {/* Последнюю привычку группы удалить нельзя: группа без привычек
                                ничего не спрашивает, а для неё есть «Завершить». */}
                            {!archived && goal.tasks.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setState(removeTaskFromGoal(state, goal.id, task.id))}
                                className="sk-press sk-focus rounded-[8px] px-2 py-1 text-[13px] font-bold text-text-muted"
                              >
                                Удалить привычку
                              </button>
                            )}
                          </>
                        }
                      />
                    ))}

                    {!archived && goal.tasks.length < MAX_TASKS_PER_GOAL && (
                      <button
                        type="button"
                        onClick={() => setAddingTaskTo(goal.id)}
                        className="sk-press sk-focus px-3.5 pt-1 pb-3.5 text-left text-[13px] font-bold text-text-secondary"
                      >
                        + Добавить привычку
                      </button>
                    )}
                  </>
                )}
              </section>
            )
          })}
        </div>
      </div>

      {addingGoal && <AddGoalFlow onClose={() => setAddingGoal(false)} />}
      {editing && editingTask && (
        <TaskEditorModal
          initial={{
            title: editingTask.title,
            difficulty: difficultyOf(editingTask.targetDays),
            targetDays: editingTask.targetDays,
            weekdays: editingTask.weekdays ?? EVERY_DAY,
          }}
          walkedDays={computeMilestoneProgress(editingTask, state.days).progressDays}
          targetLocked={state.days.some((d) => (d.targetsReached ?? []).some((t) => t.taskId === editing.taskId))}
          onSave={(value: TaskEditorValue) => {
            setState(editTaskInGoal(state, editing.goalId, editing.taskId, value))
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
        />
      )}
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
