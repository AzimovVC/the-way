import Icon from '../Icon'
import type { RankId } from '../../domain/ranks'
import { RANK_COLOR, RANK_PLINTH } from '../rankColor'

/**
 * The medal of one habit: a rounded diamond in the colour of the rank it stands at.
 *
 * The colour belongs to the **rank** and not to the habit. It is the only thing on a 56px shape
 * that reads from across the screen, and the rank is the thing worth reading that way; a colour
 * handed to the habit would leave the rank with no signal at all. The colours are not new either —
 * they are `RANK_COLOR`, the same ones the road and the award screen use, so a medal never changes
 * hue between the places it appears.
 *
 * Which leaves two habits at the same rung looking alike, so the habit says who it is inside the
 * medal: its own glyph — the emoji it was given, or its initial when it was given none — and its
 * own day count in the corner. The number moves every day, which the rung's number does not.
 *
 * A habit that has not taken the first rung gets an outline rather than a grey medal: a filled
 * medal for «ещё ничего» would read as a rank of its own, and the empty slot is the dark half this
 * app does not have.
 */
export default function RankBadge({
  rank,
  size = 56,
  days,
  letter,
  glyph,
  dimmed = false,
}: {
  rank: RankId | null
  size?: number
  /** The habit's own days walked, printed in the corner. Omitted while there is no rank. */
  days?: number | null
  /** The habit's initial, so two medals at the same rung are not the same medal. */
  letter?: string
  /** The emoji the habit was given, which says who it is better than a letter does. Wins over it. */
  glyph?: string
  /** A finished habit keeps its colour but stops being loud: it is a record now, not a run. */
  dimmed?: boolean
}) {
  const color = rank ? RANK_COLOR[rank] : 'transparent'
  const plinth = rank ? RANK_PLINTH[rank] : 'var(--ink-600)'

  return (
    <div className="relative shrink-0" style={{ width: size, height: size, opacity: dimmed ? 0.65 : 1 }}>
      {/* The plinth is its own shape rather than a box-shadow: a shadow on a rotated square is
          rotated with it and comes out under a corner, not under the medal. */}
      {rank && (
        <div
          className="absolute inset-0 rotate-45 rounded-[30%]"
          style={{ backgroundColor: plinth, transform: `translateY(${Math.round(size / 16)}px) rotate(45deg)` }}
        />
      )}
      <div
        className="absolute inset-0 rotate-45 rounded-[30%]"
        style={{ backgroundColor: color, border: rank ? 'none' : '2px dashed var(--ink-500)' }}
      />
      <div className="absolute inset-0 grid place-items-center">
        {rank && (glyph || letter) ? (
          <span
            className={glyph ? 'leading-none' : 'sk-heading leading-none'}
            style={{ fontSize: Math.round(size * 0.42), color: 'var(--ink-950)' }}
            aria-hidden
          >
            {glyph ?? letter}
          </span>
        ) : glyph ? (
          // Значок стоит и в пустой рамке: рамка осталась пунктирной, то есть ранга по-прежнему
          // нет, а замок на привычке возрастом в одну секунду читался как «сюда ты не дошёл».
          <span className="leading-none opacity-70" style={{ fontSize: Math.round(size * 0.42) }} aria-hidden>
            {glyph}
          </span>
        ) : (
          <Icon
            name={rank ? 'award' : 'lock'}
            size={Math.round(size * 0.42)}
            color={rank ? 'var(--ink-950)' : 'var(--ink-400)'}
          />
        )}
      </div>
      {rank && days != null && (
        <span
          className="sk-num absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 text-[11px] font-bold"
          style={{ backgroundColor: plinth, color: 'var(--ink-950)' }}
        >
          {days}
        </span>
      )}
    </div>
  )
}
