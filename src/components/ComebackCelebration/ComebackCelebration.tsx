import { useNavigate } from 'react-router-dom'
import { dayWord, formatShortDate } from '../../domain/calendar'
import { comebackRank, type Comeback } from '../../domain/comeback'
import ComebackHero from '../ComebackHero'
import ReviewScreen, { type ReviewTileData } from '../ReviewScreen'

/**
 * Shown once, on the mark that confirmed the return. Built on the same shell as the week summary
 * because it is the same kind of moment — the road stopping to say what just happened — and a
 * comeback shown in a smaller frame than a week would say it mattered less.
 */
export default function ComebackCelebration({ comeback, onClose }: { comeback: Comeback; onClose: () => void }) {
  const navigate = useNavigate()
  const rank = comebackRank(comeback.ordinal)

  const tiles: ReviewTileData[] = [
    { label: 'Спад', value: `${comeback.slumpLength} ${dayWord(comeback.slumpLength)}`, color: 'var(--color-day-red)' },
    { label: 'Вверх', value: `${comeback.returnLength} ${dayWord(comeback.returnLength)}`, color: 'var(--color-day-green)' },
    // The ordinal, never the rank: the rank is already the title, and a tile repeating the title
    // word for word is a third of the row spent saying nothing new.
    { label: 'Возвращение', value: `${comeback.ordinal}-е`, color: 'var(--color-day-green)' },
  ]

  return (
    <ReviewScreen
      tone="dark"
      eyebrow="Возвращение"
      title={rank ? `Ты вернулся. ${rank}` : 'Ты вернулся'}
      subtitle={`${formatShortDate(comeback.slumpStart)} — ${formatShortDate(comeback.confirmedDate)}`}
      hero={<ComebackHero shape={comeback.shape} />}
      tiles={tiles}
      note="Считается не то, что ты не падал. Считается, что ты возвращаешься."
      primaryLabel="Идти дальше"
      onPrimary={onClose}
      secondaryLabel="Открыть статистику"
      onSecondary={() => {
        onClose()
        navigate('/stats')
      }}
    />
  )
}
