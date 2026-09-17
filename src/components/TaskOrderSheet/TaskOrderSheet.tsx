import { ANY_TIME_GROUP, PART_OF_DAY } from '../../domain/partOfDay'
import { canMoveTask, moveTask, orderedTemplates } from '../../domain/taskOrder'
import { useAppState } from '../../state/appState'
import Icon from '../Icon'
import HabitGlyph from '../icons/HabitGlyph'

/**
 * Порядок привычек в дне — стрелками, а не перетаскиванием.
 *
 * Перетаскивание пальцем по списку, который сам скроллится, — это спор двух жестов, и проигрывает
 * в нём всегда человек: список уезжает вместо строки. Две стрелки попадают с первого раза, работают
 * с озвучкой экрана и не требуют библиотеки.
 *
 * Список плоский, без целей: так он выглядит в дне, а порядок настраивают ровно для того вида.
 * Переставлять можно только внутри своего отрезка дня — «выше вечера» ничего не значит, поэтому
 * верхняя стрелка первой строки утра просто погашена.
 */
export default function TaskOrderSheet({ onClose }: { onClose: () => void }) {
  const { state, setState } = useAppState()
  const goals = state.user.goals.filter((g) => !g.archived)
  const tasks = orderedTemplates(goals)

  // Заголовки отрезков нужны, только когда отрезков больше одного: единственный «Когда угодно»
  // над всем списком — подпись к тому, что и так видно.
  const showHeadings = new Set(tasks.map((t) => t.partOfDay)).size > 1
  const rows = tasks.map((task, i) => ({ task, heading: i === 0 || tasks[i - 1].partOfDay !== task.partOfDay }))

  return (
    <div className="sk-scrim absolute inset-0 z-30 flex items-end justify-center px-4 pb-6 sm:items-center" onClick={onClose}>
      <div
        className="sk-dialog hide-scrollbar flex max-h-[85vh] w-full max-w-sm flex-col gap-3 overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h3 className="sk-heading text-[19px] text-text-primary">Порядок в дне</h3>
          <p className="text-[13px] text-text-muted">В этом порядке привычки стоят в карточке дня.</p>
        </div>

        {tasks.length === 0 && <p className="text-[13px] text-text-muted">Пока нечего переставлять.</p>}

        <div className="flex flex-col gap-1.5">
          {rows.map(({ task, heading }) => {
            const up = canMoveTask(goals, task.id, -1)
            const down = canMoveTask(goals, task.id, 1)

            return (
              <div key={task.id} className="flex flex-col gap-1.5">
                {heading && showHeadings && (
                  <p className="sk-eyebrow flex items-center gap-1.5 pt-1.5">
                    {task.partOfDay && <span aria-hidden>{PART_OF_DAY[task.partOfDay].emoji}</span>}
                    {task.partOfDay ? PART_OF_DAY[task.partOfDay].group : ANY_TIME_GROUP}
                  </p>
                )}

                <div className="flex items-center gap-2.5 rounded-[16px] border border-border bg-surface-raised px-3 py-2.5">
                  <HabitGlyph icon={task.icon} title={task.title} size={20} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-text-primary">
                    {task.title}
                  </span>
                  <button
                    type="button"
                    disabled={!up}
                    onClick={() => setState(moveTask(state, task.id, -1))}
                    aria-label={`Поднять «${task.title}»`}
                    className="sk-press sk-focus grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-25"
                    style={{ boxShadow: 'inset 0 0 0 2px var(--color-border)' }}
                  >
                    <Icon name="arrow-up" size={16} color="var(--color-text-secondary)" />
                  </button>
                  <button
                    type="button"
                    disabled={!down}
                    onClick={() => setState(moveTask(state, task.id, 1))}
                    aria-label={`Опустить «${task.title}»`}
                    className="sk-press sk-focus grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-25"
                    style={{ boxShadow: 'inset 0 0 0 2px var(--color-border)' }}
                  >
                    <Icon name="arrow-down" size={16} color="var(--color-text-secondary)" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <button type="button" onClick={onClose} className="sk-btn sk-btn-primary sk-plinth sk-focus sk-btn-block mt-1">
          Готово
        </button>
      </div>
    </div>
  )
}
