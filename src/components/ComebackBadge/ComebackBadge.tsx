import Icon from '../Icon'

/**
 * Возвращения одной медалью на витрине достижений.
 *
 * Форма у неё **не ромб**, которым нарисована ступень привычки, и это то же правило, что у кубка
 * на дороге: одно чувство, разные подлежащие — разные знаки. Ромб принадлежит привычке и говорит,
 * сколько она держится; эта медаль принадлежит дороге целиком и говорит, сколько раз та
 * разворачивалась обратно вверх.
 *
 * Залитой она при этом быть не может, и это не вкусовщина: на этой полке **цвет — это ступень**
 * (`RANK_COLOR`), и зелёный там уже занят «Учеником». Медаль, залитая зелёным, встала бы среди
 * ромбов четвёртым Учеником. Поэтому цвет здесь носит обод и знак, а лицо остаётся подставкой —
 * зелёный говорит «дорога пошла вверх», а не «такая-то ступень».
 */
export default function ComebackBadge({ count, size = 56 }: { count: number; size?: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 grid place-items-center rounded-[34%]"
        style={{
          backgroundColor: 'var(--color-surface-raised)',
          border: '2px solid var(--color-day-green)',
        }}
      >
        <Icon name="trending-up" size={Math.round(size * 0.46)} color="var(--color-day-green)" />
      </div>
      <span
        className="sk-num absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[11px] font-bold"
        style={{ backgroundColor: 'var(--color-day-green)', color: 'var(--ink-950)' }}
      >
        {count}
      </span>
    </div>
  )
}
