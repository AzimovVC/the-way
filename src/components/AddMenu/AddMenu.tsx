import HabitGlyph from '../icons/HabitGlyph'

export interface AddMenuProps {
  onHabit: () => void
  onChore: () => void
  onCancel: () => void
}

/**
 * Что вообще заводят в этом приложении: привычку или разовое дело.
 *
 * Спрашивается один вопрос, и он не про устройство приложения, а про саму вещь: повторяется она
 * или случится один раз. Всё остальное следует из ответа — у привычки дни недели и уровень, у
 * дела дата и вычеркнутая строка, — и человеку не надо знать ни слова «цель», ни того, что дорога
 * считает одно и не считает другое.
 *
 * Цена разницы названа прямо здесь, а не мелким шрифтом потом: привычку дорога считает, дело —
 * нет. Это единственное, что человек обязан понять до того, как выберет.
 */
export default function AddMenu({ onHabit, onChore, onCancel }: AddMenuProps) {
  return (
    <div
      className="sk-scrim absolute inset-0 z-30 flex items-end justify-center px-4 pb-6 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="sk-dialog flex w-full max-w-xs flex-col gap-3 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="sk-heading text-[19px] text-text-primary">Что добавим?</h3>

        <Choice
          emoji="🔁"
          title="Привычку"
          hint="Повторяется по дням недели. Дорога её считает."
          onClick={onHabit}
        />
        <Choice
          emoji="✅"
          title="Дело"
          hint="Один раз, на выбранный день. На дорогу не влияет."
          onClick={onChore}
        />

        <button type="button" onClick={onCancel} className="sk-btn sk-btn-outline sk-press sk-focus mt-1">
          Отмена
        </button>
      </div>
    </div>
  )
}

function Choice({
  emoji,
  title,
  hint,
  onClick,
}: {
  emoji: string
  title: string
  hint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="sk-plinth sk-focus flex items-center gap-3 rounded-[20px] border border-border p-3.5 text-left"
      style={{ backgroundColor: 'var(--color-surface-raised)' }}
    >
      <HabitGlyph icon={emoji} title={title} size={28} />
      <span className="flex min-w-0 flex-col">
        <span className="text-[16px] font-bold text-text-primary">{title}</span>
        <span className="text-[12px] leading-snug text-text-muted">{hint}</span>
      </span>
    </button>
  )
}
