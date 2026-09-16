import { PREDICTION_CHOICES } from '../../domain/config'

/**
 * «Сколько, думаешь, продержишься?» — asked once, when a habit is made, and never again for that
 * habit.
 *
 * It is a guess about the person, not a goal set for them. Nothing is owed to it: the day count
 * gets there late or gets there on time, and there is no third outcome. That is the whole reason
 * the app is allowed to ask at all — a number you can fail is a bet, and this app does not take
 * bets against the people using it.
 *
 * Skipping costs nothing and is never punished: tapping the chosen chip again clears it, and a
 * habit with no guess simply never sees the screen.
 */
export default function PredictionPicker({
  value,
  onChange,
}: {
  value: number | undefined
  onChange: (days: number | undefined) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="sk-eyebrow">Сколько, думаешь, продержишься?</p>
      <div className="flex gap-2">
        {PREDICTION_CHOICES.map((choice) => (
          <button
            key={choice.days}
            type="button"
            onClick={() => onChange(value === choice.days ? undefined : choice.days)}
            data-selected={value === choice.days}
            className="sk-chip sk-plinth sk-focus flex-1 justify-center px-2"
          >
            {choice.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-text-muted">Это догадка о себе. Ошибиться нельзя, а пропустить можно.</p>
    </div>
  )
}
