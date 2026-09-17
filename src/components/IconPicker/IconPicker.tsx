import { taskIconKind } from '../../domain/taskIcon'
import TaskIcon from '../icons/TaskIcon'

/**
 * Набор нарочно маленький и нарочно про действия, а не про настроения.
 *
 * Полная клавиатура эмодзи превратила бы создание привычки в выбор картинки: человек пришёл
 * написать, что будет делать, и уходит листать флаги. Шестнадцать кружков листаются одним
 * движением большого пальца и закрывают почти всё, что люди сюда пишут.
 */
const CHOICES = ['🏃', '💪', '🧘', '🚶', '📚', '✍️', '🎧', '🎸', '💧', '🥗', '💊', '🛏️', '🧹', '💸', '🌱', '🧠']

export interface IconPickerProps {
  value: string | undefined
  /** Название привычки — по нему рисуется значок «как есть», когда свой не выбран. */
  title: string
  onChange: (icon: string | undefined) => void
}

/**
 * Первая ячейка — не «пусто», а тот значок, который приложение подобрало само по названию
 * (`taskIcon.ts`), и он живой: меняется, пока человек печатает. Пустой квадрат на этом месте
 * читался бы как «значка не будет», хотя значок будет — просто не выбранный руками.
 */
export default function IconPicker({ value, title, onChange }: IconPickerProps) {
  const cell = (on: boolean) =>
    on
      ? {
          backgroundColor: 'var(--color-brand)',
          boxShadow: '0 3px 0 var(--color-brand-plinth)',
          color: 'var(--color-text-on-brand)',
        }
      : { boxShadow: 'inset 0 0 0 2px var(--color-border)', color: 'var(--color-text-muted)' }

  return (
    <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      <button
        type="button"
        onClick={() => onChange(undefined)}
        aria-pressed={!value}
        aria-label="Значок по названию"
        className="sk-press sk-focus grid size-10 shrink-0 place-items-center rounded-full transition-colors"
        style={cell(!value)}
      >
        <TaskIcon kind={taskIconKind(title)} className="h-5 w-5" />
      </button>

      {CHOICES.map((emoji) => {
        const on = value === emoji
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            aria-pressed={on}
            aria-label={emoji}
            className="sk-press sk-focus grid size-10 shrink-0 place-items-center rounded-full text-[19px] leading-none transition-colors"
            style={cell(on)}
          >
            {emoji}
          </button>
        )
      })}
    </div>
  )
}
