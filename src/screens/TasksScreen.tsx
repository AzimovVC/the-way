import { useMemo, useRef, useState } from 'react'
import AddGoalFlow from '../components/AddGoalFlow'
import CirclePicker from '../components/CirclePicker'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import MetricInfo from '../components/MetricInfo'
import RankBadge from '../components/RankBadge'
import TaskEditorModal, { type TaskEditorValue } from '../components/TaskEditorModal'
import { RANK_COLOR } from '../components/rankColor'
import { dayWord, formatShortDate } from '../domain/calendar'
import { isSingleTaskGoal } from '../domain/goalShape'
import { computeMilestoneProgress, projectedArrivalDate } from '../domain/milestones'
import type { Day, Goal, TaskTemplate } from '../domain/models'
import { ANY_TIME_GROUP, PART_OF_DAY } from '../domain/partOfDay'
import { getLogicalToday } from '../domain/pathEngine'
import { rankLabel } from '../domain/ranks'
import { EVERY_DAY, describeSchedule } from '../domain/schedule'
import { groupTemplates } from '../domain/taskOrder'
import { useDragReorder } from '../components/useDragReorder'
import { useAppState } from '../state/appState'
import { newId } from '../domain/ids'
import { useSocial } from '../social/socialState'
import type { Person } from '../social/types'

const MAX_TASKS_PER_GOAL = 5


/**
 * One habit, one row.
 *
 * The card used to print everything it knew at once — rung ahead, bar, rank, percent, its caveat —
 * and two habits filled the screen. A person opens this tab to see where the habits stand and what
 * today asks of them; that is a medal, a name, a schedule and a bar, and the rest is reading they
 * do once. So the rest waits behind the row, in the same shape the habits shelf already uses.
 *
 * Behind the tap stands only what explains the bar: where it walks and what a gap costs, and the
 * comeback line when the bar has shrunk — without it weeks of work look like a bug. What the rung
 * means was thrown out with the percent: a definition said under every habit every day, when it is
 * already said on the day the level is taken, and «?» at the top holds the whole ladder. The
 * percent went with its own caveat — «на уровень это не влияет» is two lines to say the line above
 * can be skipped, and a number that is not shown needs no footnote.
 */
function TaskRow({
  title,
  task,
  days,
  today,
  open,
  onToggle,
  onEdit,
  note,
  goalTitle,
  dragHandle,
}: {
  title: string
  task: TaskTemplate
  days: Day[]
  today: string
  open: boolean
  onToggle: () => void
  onEdit?: () => void
  /** Строка о состоянии самой привычки — например, что она завершена. */
  note?: string
  /** Название группы — только когда оно не повторяет название привычки. */
  goalTitle?: string
  dragHandle?: React.ReactNode
}) {
  const progress = computeMilestoneProgress(task, days)
  const rank = progress.currentRank
  const color = rank ? RANK_COLOR[rank.id] : 'var(--color-day-green)'
  const lost = progress.daysLostToMisses

  // The bar always walks to the next rung of the one ladder. It used to walk to the finish the
  // person was handed when they picked a difficulty — a number the app chose and then congratulated
  // them for reaching.
  const goingTo = { name: rankLabel(progress.nextRank), days: progress.nextRank.days }
  const toGo = Math.max(0, goingTo.days - progress.progressDays)

  // The three pieces of the bar. The debt is drawn beyond the fill and clipped at the finish: past
  // it the segment would say the habit owes ground it no longer needs. The notch is where the fill
  // can no longer retreat to — the rung already taken.
  const fill = Math.min(progress.progressDays, goingTo.days)
  const debtWidth = Math.max(0, Math.min(lost, goingTo.days - fill))
  const floorAt = (progress.floorDays / goingTo.days) * 100

  return (
    <div className="flex flex-col">
      <div className="flex items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="sk-press sk-focus flex min-w-0 flex-1 items-center gap-3 rounded-[20px] py-3 pl-3.5 pr-2 text-left"
      >
        <RankBadge
          rank={rank?.id ?? null}
          size={40}
          letter={title.trim().slice(0, 1).toUpperCase()}
          glyph={task.icon}
        />

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

          {/* Одно расписание и, если выбрано, время дня. Что привычка просит **сегодня**, тут не
              пишется: на это целиком отвечает главный экран, а здесь «Сегодня не спрашивают,
              снова в пятницу» занимало две строки, чтобы пересказать «Пн Ср Пт», которое стоит
              на той же строке слева.

              Время дня стоит рядом с расписанием, потому что отвечает на тот же вопрос — когда, —
              только внутри дня. Отдельной строкой оно читалось бы как условие. */}
          <span className="text-[12px] leading-snug text-text-muted">
            {/* У брошенной привычки «Каждый день» — правда, которая ничего не говорит: другого
                расписания у неё и быть не может. На этом месте стоит то, чего нельзя вывести
                из строки, — что привычку бросают, и галочка значит «удержался». */}
            {task.quit ? 'Бросаю' : describeSchedule(task.weekdays)}
            {!task.quit && task.partOfDay && <> · {PART_OF_DAY[task.partOfDay].label.toLowerCase()}</>}
          </span>

        </div>

      </button>

      {/* Стрелки «тут есть ещё» в строке нет: справа уже стоят карандаш и ручка, а третий значок
          отнимал у названия буквы — «Пробе…» вместо «Пробежка». Карточка раскрывается тапом по
          себе, и это первое, что человек делает с карточкой.

          Карандаш стоит в строке, а не в раскрытой панели: править привычку — самое частое из
          того, что с ней делают руками, и ради этого незачем раскрывать карточку. Кнопкой в
          кнопку его не вложить, поэтому строка — flex-ряд из двух кнопок, а не одна. */}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Изменить «${title}»`}
          className="sk-press sk-focus mr-2 shrink-0 rounded-[12px] p-2"
        >
          <Icon name="pencil" size={18} color="var(--color-text-muted)" />
        </button>
      )}

      {dragHandle}
      </div>

      {open && (
        <div className="flex flex-col gap-2 px-3.5 pb-3.5 pl-[66px]">
          {/* Имя группы стоит тут и только когда оно не то же самое, что имя привычки: пока цель
              не разбита, это одно и то же слово, и напечатать его дважды значит выдумать второй
              уровень там, где его нет. */}
          {goalTitle && <p className="text-[12px] text-text-muted">Цель · {goalTitle}</p>}

          {/* Число идёт первым: спрашивают «сколько осталось», а не «как называется следующее».
              Имя ступени стоит после слова «уровня» и поэтому остаётся в именительном — склонять
              его нельзя, на этом ломается каждое второе название.

              Ноль бывает ровно в ту секунду, пока эффект не выдал уровень; «ещё 0 дней» в этот
              момент читалось как насмешка. */}
          <p className="text-[12px] text-text-muted">
            {toGo > 0 ? (
              <>
                Ещё <span className="sk-num">{toGo}</span> {dayWord(toGo)} до уровня «{goingTo.name}». Без пропусков —{' '}
                {formatShortDate(projectedArrivalDate(today, toGo, lost))}.
              </>
            ) : (
              <>Дни до уровня «{goingTo.name}» уже набраны.</>
            )}
          </p>

          {note && <p className="text-[12px] text-text-muted">{note}</p>}

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
        </div>
      )}
    </div>
  )
}

export default function TasksScreen() {
  const { state, dispatch, askAboutNewHabits } = useAppState()
  const { invite, circles } = useSocial()
  const { user } = state
  // Открыта ли форма новой привычки. Другого рода вещей здесь не заводят, поэтому и вопроса
  // «что добавим» за кнопкой нет.
  const [addingHabit, setAddingHabit] = useState(false)
  // Which goal's "new task" sheet is open, if any — the goal id doubles as the open flag.
  const [addingTaskTo, setAddingTaskTo] = useState<string | null>(null)
  // Which task the edit sheet is open for. Editing exists because the alternative was deleting the
  // task and making it again — which restarts the day count and takes every rank with it.
  const [editing, setEditing] = useState<{ goalId: string; taskId: string } | null>(null)
  // Кого зовут в кружок привычкой, которую сейчас правят или заводят. Одно значение на оба
  // редактора: открыт всегда один, а закрытый уносит выбор с собой — приглашение уходит вместе
  // с сохранением, и отменённая правка не должна звать никого.
  const [mate, setMate] = useState<Person | null>(null)
  // Which row is unfolded. One at a time: the tab exists to compare habits, and three of them open
  // is the long card back again.
  const [openRow, setOpenRow] = useState<string | null>(null)
  // The logical day, not the calendar one: before 3:00 the day still being marked is yesterday's.
  const today = getLogicalToday(new Date())

  const toggle = (id: string) => setOpenRow((current) => (current === id ? null : id))

  // Экран плоский, но группа у привычки всё равно есть, и знать её надо — и панели, и карандашу.
  const goalOf = useMemo(() => {
    const map = new Map<string, Goal>()
    for (const goal of user.goals) for (const task of goal.tasks) map.set(task.id, goal)
    return map
  }, [user.goals])

  // Тот же список и тот же порядок, что в карточке дня. По целям он не делится: пока цель не
  // разбита, её имя и имя привычки — одно слово, а заголовок над одной строкой выдумывал второй
  // уровень. Разбитая цель говорит своё имя в раскрытой панели, где оно что-то добавляет.
  const groups = useMemo(() => groupTemplates(user.goals.filter((goal) => !goal.archived)), [user.goals])
  const showGroupHeadings = groups.length > 1
  const finished = useMemo(() => user.goals.filter((goal) => goal.archived), [user.goals])

  const rowRefs = useRef(new Map<string, HTMLLIElement | null>())
  // Наружу уходит список id всей группы, а не «эту на N-е место»: внутри группы места и так
  // подряд, но общая шкала одна на все отрезки дня, и номер по экрану попал бы не туда.
  const { drag, offsetOf, handlers } = useDragReorder((taskId, toIndex) => {
    const group = groups.find((g) => g.tasks.some((t) => t.id === taskId))
    if (!group) return
    const ids = group.tasks.map((t) => t.id)
    const from = ids.indexOf(taskId)
    ids.splice(toIndex, 0, ...ids.splice(from, 1))
    dispatch({ kind: 'reorderTasks', taskIds: ids })
  })

  const editingGoal = editing ? state.user.goals.find((g) => g.id === editing.goalId) : undefined
  const editingTask = editingGoal?.tasks.find((t) => t.id === editing!.taskId)

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
          {/* Просто «+»: заводят отсюда привычку, и только её. Не `sk-btn`: у той свои 20px по
              бокам, и в круге на 44px они съедают значок целиком — от него остаётся нулевая
              ширина. */}
          <button
            type="button"
            onClick={() => setAddingHabit(true)}
            aria-label="Добавить привычку"
            className="sk-press sk-focus flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-border text-text-primary"
          >
            <Icon name="plus" size={22} />
          </button>
        </div>

        {user.goals.length === 0 && (
          <p className="text-[15px] text-text-secondary">
            Пока ни одной привычки. Добавь первую — и дорога начнёт её считать.
          </p>
        )}

        {groups.map((group) => (
          <div key={group.part ?? 'any'} className="flex flex-col gap-2">
            {/* Заголовки отрезков — только когда отрезков больше одного: единственное «Когда
                угодно» над всем списком подписывает то, что и так очевидно. */}
            {showGroupHeadings && (
              <p className="sk-eyebrow flex items-center gap-1.5">
                {group.part && <span aria-hidden>{PART_OF_DAY[group.part].emoji}</span>}
                {group.part ? PART_OF_DAY[group.part].group : ANY_TIME_GROUP}
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {group.tasks.map((task, index) => {
                const goal = goalOf.get(task.id)
                if (!goal) return null
                const canDrag = group.tasks.length > 1
                const held = drag?.id === task.id
                const offset = drag && group.tasks.some((t) => t.id === drag.id) ? offsetOf(index) : 0

                return (
                  <li
                    key={task.id}
                    ref={(el) => {
                      rowRefs.current.set(task.id, el)
                    }}
                    className="flex flex-col rounded-[20px] border border-border"
                    style={{
                      backgroundColor: 'var(--color-surface-raised)',
                      transform: offset ? `translateY(${offset}px)` : undefined,
                      // Взятая карточка не едет плавно — она под пальцем. Уступающие место
                      // соседи, наоборот, только с переходом: без него список перещёлкивается.
                      transition: held ? 'none' : 'transform var(--dur-fast) var(--ease-out)',
                      zIndex: held ? 2 : undefined,
                      position: held ? 'relative' : undefined,
                      boxShadow: held ? 'var(--shadow-md)' : undefined,
                    }}
                  >
                    <TaskRow
                      title={task.title}
                      task={task}
                      days={state.days}
                      today={today}
                      open={openRow === task.id}
                      onToggle={() => toggle(task.id)}
                      onEdit={() => setEditing({ goalId: goal.id, taskId: task.id })}
                      goalTitle={isSingleTaskGoal(goal) ? undefined : goal.title}
                      dragHandle={
                        canDrag && (
                          // Жест начинается только отсюда: без ручки одно вертикальное движение
                          // означало бы и «листать», и «двигать», и выигрывал бы всегда список.
                          <button
                            type="button"
                            aria-label={`Переставить «${task.title}»`}
                            className="sk-focus grid w-9 shrink-0 cursor-grab place-items-center self-stretch rounded-r-[20px]"
                            style={{ touchAction: 'none' }}
                            onPointerDown={(e) =>
                              handlers.onPointerDown(
                                e,
                                task.id,
                                index,
                                group.tasks.map((t) => rowRefs.current.get(t.id) ?? null),
                              )
                            }
                            onPointerMove={handlers.onPointerMove}
                            onPointerUp={handlers.onPointerUp}
                            onPointerCancel={handlers.onPointerCancel}
                          >
                            <Icon name="grip" size={16} color="var(--color-text-muted)" />
                          </button>
                        )
                      }
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Завершённые стоят своей стопкой внизу и не переставляются: порядок — это про то, чем
            день будет спрашивать, а эти уже ни о чём не спрашивают. С экрана они не исчезают —
            иначе кнопку «Завершить» никто бы не нажал, и честный конец стоил бы дороже брошенного. */}
        {finished.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="sk-eyebrow">Завершённые</p>
            <ul className="flex flex-col gap-2">
              {finished.flatMap((goal) =>
                goal.tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex flex-col rounded-[20px] border border-border"
                    style={{ backgroundColor: 'var(--color-surface-raised)', opacity: 0.5 }}
                  >
                    <TaskRow
                      title={task.title}
                      task={task}
                      days={state.days}
                      today={today}
                      open={openRow === task.id}
                      onToggle={() => toggle(task.id)}
                      goalTitle={isSingleTaskGoal(goal) ? undefined : goal.title}
                      note="Завершена — пройденный путь остался на дороге."
                    />
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
      </div>

      {addingHabit && <AddGoalFlow onClose={() => setAddingHabit(false)} />}
      {editing && editingGoal && editingTask && (
        <TaskEditorModal
          initial={{
            title: editingTask.title,
            weekdays: editingTask.weekdays ?? EVERY_DAY,
            partOfDay: editingTask.partOfDay,
            icon: editingTask.icon,
            private: editingTask.private,
            quit: editingTask.quit,
          }}
          circle={<CirclePicker taskId={editing.taskId} value={mate} onChange={setMate} />}
          // Живая пара запирает «только для меня»: её галочки партнёр видит прямо сейчас.
          circleActive={circles.circles.some(
            (item) => item.taskId === editing.taskId && item.leftAt === undefined,
          )}
          onSave={(value: TaskEditorValue) => {
            dispatch({ kind: 'editTask', goalId: editing.goalId, taskId: editing.taskId, input: value })
            // Зовут тем, что человек только что сохранил: расписание в приглашении — то, на
            // которое он смотрел, нажимая «Сохранить», а не то, что лежало до правки.
            if (mate !== null) {
              void invite({
                id: newId(),
                personId: mate.id,
                taskId: editing.taskId,
                title: value.title,
                icon: value.icon,
                weekdays: value.weekdays,
                timezone: state.user.timezone,
              })
            }
            setMate(null)
            setEditing(null)
          }}
          onCancel={() => {
            setMate(null)
            setEditing(null)
          }}
          // Разбить можно только неразбитую: у разбитой это уже не «разбить», а «добавить ещё
          // одну в ту же группу», и говорить это из карточки одной привычки незачем.
          onSplit={
            isSingleTaskGoal(editingGoal) && editingGoal.tasks.length < MAX_TASKS_PER_GOAL
              ? () => {
                  setEditing(null)
                  setAddingTaskTo(editingGoal.id)
                }
              : undefined
          }
          // Последнюю привычку группы удалить нельзя: группа без привычек ничего не спрашивает,
          // а для неё есть «Завершить».
          onRemove={
            editingGoal.tasks.length > 1
              ? () => {
                  dispatch({ kind: 'removeTask', goalId: editing.goalId, taskId: editing.taskId })
                  setEditing(null)
                }
              : undefined
          }
          onFinish={() => {
            dispatch({ kind: 'archiveGoal', goalId: editingGoal.id })
            setEditing(null)
          }}
          // У разбитой группы завершается вся группа, и сказать это надо вслух: человек нажимает
          // это в карточке одной привычки, а уйдут все.
          finishLabel={
            isSingleTaskGoal(editingGoal) ? 'Завершить привычку' : `Завершить цель «${editingGoal.title}»`
          }
        />
      )}
      {addingTaskTo && (
        <TaskEditorModal
          circle={<CirclePicker value={mate} onChange={setMate} />}
          onSave={(value) => {
            // Ключ чеканится до вызова: им же названа привычка в приглашении — см. `newId`.
            const taskId = newId()
            const next = dispatch({ kind: 'addTask', goalId: addingTaskTo, input: { id: taskId, ...value } })
            if (mate !== null) {
              void invite({
                id: newId(),
                personId: mate.id,
                taskId,
                title: value.title,
                icon: value.icon,
                weekdays: value.weekdays,
                timezone: state.user.timezone,
              })
            }
            askAboutNewHabits(state, next)
            setMate(null)
            setAddingTaskTo(null)
          }}
          onCancel={() => {
            setMate(null)
            setAddingTaskTo(null)
          }}
        />
      )}
    </AppShell>
  )
}
