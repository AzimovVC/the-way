import { useState } from 'react'
import { formatLongDate } from '../../domain/calendar'
import type { ColorTier, Day, TaskTemplate } from '../../domain/models'
import { ANY_TIME_GROUP, PART_OF_DAY } from '../../domain/partOfDay'
import { WEEKDAY_LABELS, weekdayIndex } from '../../domain/schedule'
import { groupDayTasks } from '../../domain/taskOrder'
import AddGoalFlow from '../AddGoalFlow'
import Icon from '../Icon'
import HabitGlyph from '../icons/HabitGlyph'
import CircleMate from '../CircleMate'
import NodePopover, { type PopoverAnchor } from '../NodePopover'
import { circleRowState, pairLine, type CircleOnDay } from '../../social/circles'

interface DayCardProps {
  day: Day
  taskTemplates: Map<string, TaskTemplate>
  isToday: boolean
  anchor: PopoverAnchor
  frameWidth: number
  frameHeight: number
  freezesRemaining: number
  onClose: () => void
  /** Попросить у дороги места под кругом — см. NodePopover. Есть только там, где дорога есть. */
  requestRoom?: (neededBelowCentre: number, done: () => void) => void
  onToggleTask: (taskTemplateId: string) => void
  /**
   * Шаг счётчика у привычки, которая считается по разам. Отдельно от `onToggleTask` по той же
   * причине, по какой отдельно само действие: прибавить один и поставить отметку — разные вещи.
   */
  onStepTask?: (taskTemplateId: string, delta: number) => void
  /**
   * Кружки, по привычке. Её половина рисуется рядом с твоей и **не влияет ни на что**: ни на
   * `completionRate` в шапке, ни на цвет дня, ни на угол, ни на серию, ни на веху. Карточка её
   * печатает — и это вся власть, которую та сторона здесь имеет.
   */
  circles?: ReadonlyMap<string, CircleOnDay>
  onFreeze: () => void
}

const TIER_COLOR: Record<ColorTier, string> = {
  gold: 'var(--color-day-gold)',
  green: 'var(--color-day-green)',
  red: 'var(--color-day-red)',
  gray: 'var(--color-day-gray)',
  rest: 'var(--color-day-rest)',
}

/** Gold, green and red are bright enough to carry ink; the two dark tiers need the light text. */
const TIER_INK: Record<ColorTier, string> = {
  gold: 'var(--ink-950)',
  green: 'var(--ink-950)',
  red: 'var(--ink-950)',
  gray: 'var(--color-text-primary)',
  rest: 'var(--color-text-primary)',
}

export default function DayCard({
  day,
  taskTemplates,
  isToday,
  anchor,
  frameWidth,
  frameHeight,
  freezesRemaining,
  onClose,
  requestRoom,
  onToggleTask,
  onStepTask,
  circles,
  onFreeze,
}: DayCardProps) {
  // Отрезки дня и порядок внутри них. Заголовки появляются только когда отрезков больше одного:
  // единственный «Когда угодно» над списком из трёх строк — подпись к тому, что и так очевидно.
  const groups = groupDayTasks(day.tasks, taskTemplates)
  const showGroupHeadings = groups.length > 1
  // Nothing to protect on a day that asked for nothing — offering a freeze there would sell a
  // credit against a day that was never at risk.
  const canFreeze = !day.frozen && !day.rest && freezesRemaining > 0 && day.completionRate < 1
  const [confirmFreeze, setConfirmFreeze] = useState(false)
  // Привычка, заведённая прямо отсюда: день — то самое место, где она приходит в голову.
  const [addingHabit, setAddingHabit] = useState(false)
  const doneCount = day.tasks.filter((t) => t.isDone).length
  const total = day.tasks.length
  const tierColor = TIER_COLOR[day.colorTier]
  const ink = TIER_INK[day.colorTier]
  // Красный день уже носит красный: кнопка того же цвета пропадала бы в плашке, оставляя от себя
  // один плинт. На таком дне она берёт ступень темнее — красной она при этом быть не перестаёт.
  const dayIsRed = day.colorTier === 'red'

  return (
    <>
    <NodePopover anchor={anchor} frameWidth={frameWidth} frameHeight={frameHeight} accent={tierColor} onClose={onClose} requestRoom={requestRoom}>
      {/* The head wears the circle's own colour, so the card is visibly the same object as the dot
          it grew out of — the tail alone would only say *which* circle, not *how that day went*.

          Прилипшая: когда дню не хватило места и остаток ушёл в собственную прокрутку карточки
          (см. NodePopover), уезжать наверх обязан **список**, а не шапка. В шапке стоят имя дня,
          счёт и три кнопки — заморозка, «+» и закрытие; уехавшая шапка забирает с собой
          единственный выход из карточки и заставляет прокручивать день обратно, чтобы её закрыть.
          Список же прокручивают затем, чтобы читать его, — он и едет. */}
      <header
        className="sticky top-0 z-10 flex items-start gap-2 px-4 py-3"
        style={{ backgroundColor: tierColor }}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="sk-heading truncate text-[19px]" style={{ color: ink }}>
            {/* «Ср, 26 августа», not 2026-08-26: the stored form is a key, not something to read. */}
            {isToday ? 'Сегодня' : `${WEEKDAY_LABELS[weekdayIndex(day.date)]}, ${formatLongDate(day.date)}`}
          </span>
          <span className="sk-num text-[13px]" style={{ color: ink, opacity: 0.72 }}>
            {day.rest ? 'Выходной' : `Задача ${doneCount} из ${total}`}
            {day.frozen && (
              <span className="ml-2 inline-flex items-center gap-1">
                <Icon name="moon" size={13} color={ink} />
                заморожен
              </span>
            )}
          </span>
        </div>
        {/* Заморозка стоит на плашке, а не внизу карточки: это не итог чтения дня, а кнопка, за
            которой человек сюда и пришёл, когда пришёл за ней. Внизу она к тому же уезжала под
            список и изменения дня — тем дальше, чем длиннее был день.

            Тап здесь тратит невозвратное, а рядом стоит «Закрыть», поэтому спрашивается второй
            раз: промах по соседней кнопке не должен стоить заморозки. */}
        <div className="flex shrink-0 items-center gap-2">
          {canFreeze && (
            <button
              type="button"
              onClick={() => (confirmFreeze ? onFreeze() : setConfirmFreeze(true))}
              aria-label={`Заморозить день, осталось ${freezesRemaining}`}
              className="sk-plinth sk-focus flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold"
              style={{
                backgroundColor: 'var(--color-freeze)',
                color: 'var(--ink-950)',
                ['--plinth-color' as string]: 'var(--violet-700)',
              }}
            >
              <Icon name="moon" size={16} color="var(--ink-950)" />
              {confirmFreeze ? 'Точно?' : freezesRemaining}
            </button>
          )}
        {/* Заводит привычку, и больше ничего: другого рода вещей в приложении нет, поэтому
            вопроса «что добавим» за кнопкой тоже нет — он был бы выбором из одного.

            Стоит на плашке, а не внизу карточки: внизу она росла вместе со списком и уезжала тем
            дальше, чем длиннее день, а «добавить» — это не итог чтения списка. Наверху её место
            не зависит от того, что в дне. */}
          {isToday && (
            <button
              type="button"
              onClick={() => setAddingHabit(true)}
              aria-label="Добавить привычку"
              className="sk-plinth sk-focus grid size-10 place-items-center rounded-[14px]"
              style={{
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                ['--plinth-color' as string]: 'var(--ink-950)',
              }}
            >
              <Icon name="plus" size={22} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="sk-plinth sk-focus grid size-9 place-items-center rounded-full"
            style={{
              backgroundColor: dayIsRed ? 'var(--coral-700)' : 'var(--coral-500)',
              color: dayIsRed ? 'var(--color-text-primary)' : 'var(--ink-950)',
              ['--plinth-color' as string]: dayIsRed ? 'var(--ink-950)' : 'var(--coral-700)',
            }}
          >
            <Icon name="x" size={19} />
          </button>
        </div>
      </header>

      <div className="px-4 pb-4 pt-3">
        {/* A planned day off states itself, and states what it costs — nothing. Left as an empty
            list it would read as a day whose tasks were all missed. */}
        {day.rest && (
          <p className="text-[15px] text-text-secondary">
            На этот день ничего не запланировано. Дорога идёт ровно, серия не прервётся.
          </p>
        )}

        {groups.map((group) => (
          <div key={group.part ?? 'any'} className="flex flex-col gap-2 [&+&]:mt-3">
            {showGroupHeadings && (
              <p className="sk-eyebrow flex items-center gap-1.5">
                {group.part && <span aria-hidden>{PART_OF_DAY[group.part].emoji}</span>}
                {group.part ? PART_OF_DAY[group.part].group : ANY_TIME_GROUP}
              </p>
            )}
            <ul className="flex flex-col gap-2">
          {group.tasks.map((dayTask) => {
            const template = taskTemplates.get(dayTask.taskTemplateId)
            const title = template?.title ?? 'Задача'
            const circle = circles?.get(dayTask.taskTemplateId)
            // Счётчик — это способ поставить ту же отметку, а не второе её состояние: строка либо
            // закрыта, либо нет, и «3 из 8» это «нет» с числом, которое видно.
            const target = template?.target
            const counted = target !== undefined && target.count > 0 && onStepTask !== undefined
            const progress = counted ? Math.min(target.count, dayTask.progress ?? 0) : 0
            // «Я отметился, ждём второго» — привычка, которую держат только вместе. Твоя половина
            // тут настоящая и стоит на своём месте: для пары она такая же галочка, как закрытая
            // строка, — ждёт только день.
            const waiting = dayTask.pending === true
            const marked = dayTask.isDone || waiting
            const pair = circle === undefined ? null : circleRowState(marked, circle.theirs)

            return (
              <li
                key={dayTask.taskTemplateId}
                className="flex flex-col rounded-[20px] border border-border bg-surface-raised"
                style={{ opacity: isToday ? 1 : 0.6 }}
              >
                <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  disabled={!isToday}
                  onClick={() => {
                    if (!counted) return onToggleTask(dayTask.taskTemplateId)
                    // Закрытую строку тап открывает обратно — и обнуляет счёт: «8 из 8», с
                    // которого сняли отметку, но оставили восемь, это строка, которую нельзя
                    // ни закрыть, ни открыть.
                    onStepTask(dayTask.taskTemplateId, dayTask.isDone ? -target.count : 1)
                  }}
                  // Слово, а не форма: у брошенной привычки галочка значит «удержался», и глазами
                  // это читается из названия («Не курить»), а вслух — только отсюда.
                  aria-label={template?.quit === true ? `${title} — удержался` : title}
                  className={`sk-focus flex min-w-0 flex-1 items-center gap-3 rounded-[20px] px-3.5 py-3 text-left ${
                    isToday ? 'sk-press' : ''
                  }`}
                >
                  <span
                    className="grid size-7 shrink-0 place-items-center rounded-[8px] transition-colors"
                    style={{
                      backgroundColor: dayTask.isDone ? 'var(--color-day-gold)' : 'var(--color-surface-sunken)',
                      boxShadow: dayTask.isDone
                        ? '0 2px 0 var(--marigold-700)'
                        : 'inset 0 0 0 2px var(--color-border)',
                    }}
                  >
                    {/* Ждущая галочка — та же галочка, но без заливки: золото значит «день это
                        засчитал», а он ещё не засчитал. Форма при этом уже стоит, потому что
                        нажатие было настоящим, и пустая клетка сказала бы, что его не было. */}
                    {dayTask.isDone ? (
                      <Icon name="check" size={16} color="var(--color-text-on-brand)" />
                    ) : waiting ? (
                      <Icon name="check" size={16} color="var(--color-text-muted)" />
                    ) : (
                      counted &&
                      progress > 0 && <span className="sk-num text-[13px] font-bold text-text-secondary">{progress}</span>
                    )}
                  </span>
                  <HabitGlyph icon={template?.icon} title={title} size={20} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={`min-w-0 truncate text-[15px] ${dayTask.isDone ? 'text-text-muted line-through' : 'text-text-primary'}`}
                    >
                      {title}
                    </span>
                    {counted && (
                      <span className="sk-num text-[12px] text-text-muted">
                        {progress} из {target.count}
                        {target.unit && ` ${target.unit}`}
                      </span>
                    )}
                  </span>
                </button>
                {/* Шаг назад стоит только там, где есть что отменять: промахнуться пальцем по
                    строке, которую нажимают восемь раз за день, — обычное дело, а снять отметку
                    целиком ради одного лишнего стакана значит потерять семь настоящих. */}
                {counted && isToday && progress > 0 && !dayTask.isDone && (
                  <button
                    type="button"
                    onClick={() => onStepTask(dayTask.taskTemplateId, -1)}
                    aria-label={`${title} — на один меньше`}
                    className="sk-press sk-focus grid w-10 shrink-0 place-items-center rounded-[20px] text-[18px] font-bold text-text-muted"
                  >
                    −
                  </button>
                )}
                {circle !== undefined && (
                  <CircleMate partner={circle.partner} state={pair ?? 'nobody'} excused={circle.theirsExcused} />
                )}
                </div>

                {/* Числа пары — факт **про сегодня**, поэтому на карточке прошлого дня их нет:
                    «вместе 12 дней подряд» над июльским днём — число не про него. Её галочка там
                    остаётся: она про тот самый день и была.

                    «Оба» названо словами, потому что это событие, а две галочки рядом — положение.
                    «Только ты» словами не называется вовсе: круг справа уже тише, и вторая строка
                    про то же самое читалась бы как упрёк в чужую сторону. */}
                {circle !== undefined && isToday && (
                  <div className="flex flex-col gap-0.5 px-3.5 pb-2.5">
                    <p
                      className="text-[12px]"
                      style={{ color: pair === 'both' ? 'var(--color-day-gold)' : 'var(--color-text-muted)' }}
                    >
                      {pair === 'both' ? 'Сегодня закрыли оба. ' : ''}
                      {pairLine(circle.progress)}
                    </p>
                    {/* Единственная строка в карточке, которая говорит про **твою** невыполненную
                        строку, — и она не про тебя: ты своё сделал. Без неё серая галочка читалась
                        бы как сбой, а не как выбранное ожидание. */}
                    {waiting && (
                      <p className="text-[12px] text-text-muted">
                        Твоя галочка стоит — ждём {circle.partner.name}.
                      </p>
                    )}
                    {circle.zone !== null && <p className="text-[11px] text-text-muted">{circle.zone}</p>}
                  </div>
                )}
              </li>
            )
          })}
            </ul>
          </div>
        ))}

        {/* What the mark on the circle stands for. The path can only say "something changed
            here"; the name of the task belongs in the one place the day is read in full. */}
        {(day.taskChanges?.length ?? 0) > 0 && (
          <div className="sk-card-nested mt-3 flex flex-col gap-2">
            <p className="sk-eyebrow">Изменения дня</p>
            {day.taskChanges?.map((change) => (
              <div key={`${change.kind}-${change.taskId}`} className="flex items-center gap-2 text-[13px]">
                <Icon
                  name={change.kind === 'added' ? 'plus' : change.kind === 'removed' ? 'minus' : 'calendar'}
                  size={14}
                  color={change.kind === 'added' ? 'var(--cobalt-500)' : 'var(--color-text-muted)'}
                />
                <span className="text-text-secondary">
                  {change.kind === 'added'
                    ? 'Добавлена задача'
                    : change.kind === 'removed'
                      ? 'Убрана задача'
                      : 'Изменено расписание'}{' '}
                  «{change.title}»
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </NodePopover>

    {addingHabit && <AddGoalFlow onClose={() => setAddingHabit(false)} />}
    </>
  )
}
