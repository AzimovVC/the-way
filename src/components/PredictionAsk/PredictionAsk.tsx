import { PREDICTION_CHOICES } from '../../domain/config'

/**
 * «Сколько, думаешь, продержишься?» — the whole screen, once, right after a habit is made.
 *
 * It used to be a row of chips inside the creation form, under the weekdays, and there it read as
 * one more field to fill in before the app would let you through. It is not a field. It is the one
 * question the app asks about the person rather than about the habit, and it gets the same frame
 * every other moment worth stopping for gets.
 *
 * Skipping is a real answer with its own plain button. A habit with no guess simply never sees the
 * screen that says one came true, and nothing else about it changes.
 */
export default function PredictionAsk({
  title,
  onAnswer,
  onSkip,
}: {
  title: string
  onAnswer: (days: number) => void
  onSkip: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Сколько, думаешь, продержишься?"
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ backgroundColor: 'var(--color-bg)', color: 'var(--color-text-primary)' }}
    >
      <div className="sk-rise flex flex-1 flex-col items-center justify-center gap-5 px-6 py-8 text-center">
        {/* The habit's own initial, not a RankBadge: with no level yet that badge draws a dashed
            padlock, and a lock over a habit one second old reads as «сюда ты не дошёл» — the empty
            shelf cell this app deliberately does not have. */}
        <div
          className="grid size-[76px] place-items-center rounded-full"
          style={{ backgroundColor: 'var(--color-brand)' }}
        >
          <span className="sk-heading text-[32px]" style={{ color: 'var(--color-text-on-brand)' }}>
            {title.trim().slice(0, 1).toUpperCase()}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="sk-eyebrow text-text-muted">Новая привычка</p>
          <h1 className="sk-heading text-[30px] leading-tight">{title}</h1>
          <p className="text-[16px] text-text-secondary">Сколько, думаешь, продержишься?</p>
        </div>

        {/* A column, not a row: three words side by side on a narrow phone wrap to two lines each
            and the answers start looking like a form again. Down the screen they read as a choice. */}
        <div className="flex w-full max-w-sm flex-col gap-2.5">
          {PREDICTION_CHOICES.map((choice) => (
            <button
              key={choice.days}
              type="button"
              onClick={() => onAnswer(choice.days)}
              className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus text-[17px]"
            >
              {choice.label}
            </button>
          ))}
        </div>

        <p className="max-w-sm text-[15px] text-text-muted">Это догадка о себе. Ошибиться нельзя.</p>

        <button
          type="button"
          onClick={onSkip}
          className="sk-press sk-focus rounded-[12px] px-3 py-2 text-[15px] font-bold text-text-muted"
        >
          Пока не знаю
        </button>
      </div>
    </div>
  )
}
