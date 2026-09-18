import Icon from '../Icon'
import type { PredictionAward } from '../../domain/predictionAward'
import ReviewScreen from '../ReviewScreen'

/**
 * «Догадка была — месяц. Всё сошлось.»
 *
 * Догадка стоит подлежащим не для красоты. «Ты говорил» знает, кто ты, а приложение не знает; «вот
 * он, целиком» согласовано с «месяцем» и разваливается на «двух неделях» и «ста днях» — то есть на
 * двух вариантах из трёх. Существительное, которое здесь всегда одно и то же, снимает обе беды
 * разом: сказуемое согласуется с ним, а не с тем, что человек выбрал и кем он оказался.
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
      subtitle={`Догадка была — ${award.label.toLowerCase()}. Всё сошлось.`}
      hero={
        <div
          className="grid size-[76px] place-items-center rounded-full"
          style={{ backgroundColor: 'var(--color-day-green)' }}
        >
          <Icon name="check" size={38} color="var(--ink-950)" />
        </div>
      }
      tiles={[]}
      note="Ты знаешь себя лучше, чем думаешь."
      primaryLabel="Ура"
      onPrimary={onClose}
    />
  )
}
