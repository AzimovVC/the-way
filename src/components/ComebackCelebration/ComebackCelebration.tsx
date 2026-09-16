import { comebackRank, type Comeback } from '../../domain/comeback'
import { dayWord, formatShortDate } from '../../domain/calendar'
import Icon from '../Icon'

/**
 * The screen for the road turning back up.
 *
 * It earns a screen on the same terms as a tier: it has a moment. The comeback is called on the
 * day the return stopped being in doubt, by the person's own mark, and it is rarer than a closed
 * day. What it must never be is a reminder of the fall — the slump is named once, in the past
 * tense, because a return that does not say what it returned from is a good day with big type.
 */
export default function ComebackCelebration({ comeback, onClose }: { comeback: Comeback; onClose: () => void }) {
  const rank = comebackRank(comeback.ordinal)

  return (
    <div className="sk-scrim fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="sk-dialog flex w-full max-w-sm flex-col gap-4 p-6 text-center">
        <div
          className="mx-auto grid size-[76px] place-items-center rounded-full"
          style={{ backgroundColor: 'var(--color-day-green)', boxShadow: '0 6px 0 var(--color-day-green-plinth)' }}
        >
          <Icon name="trending-up" size={38} color="var(--ink-950)" />
        </div>

        <h2 className="sk-heading text-[22px] text-text-primary">Ты вернулся</h2>
        <p className="text-[15px] text-text-secondary">
          Дорога шла вниз {comeback.slumpLength} {dayWord(comeback.slumpLength)} и снова идёт вверх. Это
          твоё {comeback.ordinal}-е возвращение.
        </p>

        {rank && (
          <p className="sk-eyebrow" style={{ color: 'var(--color-day-green)' }}>
            Новое звание: {rank}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-3 text-left text-[12px] text-text-muted">
          <div>
            <dt>Спад начался</dt>
            <dd className="sk-num text-[19px] text-text-primary">{formatShortDate(comeback.slumpStart)}</dd>
          </div>
          <div>
            <dt>Идёшь вверх</dt>
            <dd className="sk-num text-[19px] text-text-primary">
              {comeback.returnLength} {dayWord(comeback.returnLength)}
            </dd>
          </div>
        </dl>

        {/* The one thing worth saying past the count, and it is true: returning is the part that
            predicts the long run, not the part where nothing went wrong. */}
        <p className="text-[13px] text-text-muted">
          Считается не то, что ты не падал. Считается, что ты возвращаешься.
        </p>

        <button type="button" onClick={onClose} className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus">
          Идти дальше
        </button>
      </div>
    </div>
  )
}
