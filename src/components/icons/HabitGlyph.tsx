import { taskIconKind } from '../../domain/taskIcon'
import TaskIcon from './TaskIcon'

/**
 * Значок привычки: выбранная эмодзи, а если её нет — тот, что приложение подобрало по названию.
 *
 * Одно место на всё приложение, чтобы строка в дне и строка на вкладке привычек не разошлись
 * в том, какой значок у одной и той же привычки.
 */
export default function HabitGlyph({
  icon,
  title,
  size = 20,
  className,
}: {
  icon?: string
  title: string
  size?: number
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center leading-none ${className ?? 'text-text-secondary'}`}
      style={{ width: size, height: size, fontSize: icon ? size * 0.95 : undefined }}
    >
      {icon ?? <TaskIcon kind={taskIconKind(title)} className="h-full w-full" />}
    </span>
  )
}
