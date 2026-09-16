import Icon from '../Icon'
import type { PredictionAward } from '../../domain/predictionAward'
import ReviewScreen from '../ReviewScreen'

/**
 * «Ты говорил — месяц. Вот он.»
 *
 * Its own screen, not a line on the level screen, because it is its own event: a level says how far
 * the habit has set, on the ladder everybody shares; this says the person read themselves right,
 * and belongs to nobody else.
 *
 * No tiles. The only numbers here are the guess and the days walked, and on the day this appears
 * they are the same number — a row of tiles would be a third of the screen spent agreeing with
 * itself. What the person gets is a sentence, and the sentence is the point: they learned something
 * about themselves that the app could not have told them.
 */
export default function PredictionCelebration({
  award,
  onClose,
}: {
  award: PredictionAward
  onClose: () => void
}) {
  return (
    <ReviewScreen
      tone="dark"
      eyebrow="Получилось"
      title={award.taskTitle}
      subtitle={`Ты говорил — ${award.label.toLowerCase()}. Вот он, целиком.`}
      hero={
        <div
          className="grid size-[76px] place-items-center rounded-full"
          style={{ backgroundColor: 'var(--color-day-green)' }}
        >
          <Icon name="check" size={38} color="var(--ink-950)" />
        </div>
      }
      tiles={[]}
      note="Ты знаешь себя лучше, чем думал."
      primaryLabel="Ура"
      onPrimary={onClose}
    />
  )
}
