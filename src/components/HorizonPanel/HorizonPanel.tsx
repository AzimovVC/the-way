import type { HorizonMarker } from '../../domain/horizon'
import { dayWord } from '../../domain/calendar'
import { milestoneBadgeFace, rosettePathD } from '../../domain/decorGeometry'
import Icon, { ICON_PATH_D, TROPHY_PATH_D } from '../Icon'

/**
 * What the road is heading toward but cannot draw yet, drawn as a band that stands across the road
 * just past its last ghost.
 *
 * Above the road because that is where the road is going. A kept day turns the road upward, and the
 * ghost road past today is a road of kept days, so the horizon is always overhead — scrolling
 * forward is climbing toward it, and the band is the wall that climb runs into. Hung at the foot of
 * the screen instead, it would be a footnote under the road rather than the thing at the end of it.
 *
 * It is not placed on the screen but on the *road*: its caller pins it a fixed gap above the last
 * ghost and moves it with the camera, so it slides down into the frame as the horizon is approached
 * and comes to rest against the end of the road. Pinned to the top of the screen instead and merely
 * faded in, it would be a lid that cuts whichever ghost happened to be passing under it — which is
 * how this started, and is exactly what it must not do: a half circle sliced by a straight edge
 * reads as a rendering fault, not as a boundary.
 *
 * It is the far side of the same idea as the badges on the road: the mark ahead is drawn as the very
 * badge that will stand there, only grey — not yet walked to, rather than closed off. The reference
 * this is modelled on puts a padlock there instead, and a padlock is the one thing it must not be:
 * nothing in this app is locked, and a lock says the road is refusing you rather than merely
 * unbuilt. Grey says "not yet" without saying "not allowed".
 *
 * Rendered as DOM over the path rather than inside its SVG, which is what buys the band its frame:
 * the road's own coordinates are scrolled and scaled by the camera, so a screen-wide rule drawn in
 * them would drift and stretch with it.
 */

const BADGE_RADIUS = 21
const BADGE_DEPTH = 3

function MarkerBadge({ marker, size }: { marker: HorizonMarker; size: number }) {
  // A habit tier has no badge of its own on the road — it is not a place the road passes, it is a
  // thing a task earns — so it is shown as a medal rather than borrowed into a rosette. Only the
  // calendar marks are drawn as the badge that will one day stand there.
  if (!marker.milestone) return <Icon name="award" size={size} color="var(--color-text-muted)" />

  const face = milestoneBadgeFace(marker.milestone, marker.milestoneN)
  const d = rosettePathD(BADGE_RADIUS)
  // The viewBox is squared around the origin at the badge's full reach — radius plus the plinth
  // hanging under it — so the same drawing serves both sizes on this panel by scaling alone.
  const half = BADGE_RADIUS + BADGE_DEPTH
  return (
    <svg width={size} height={size} viewBox={`${-half} ${-half} ${half * 2} ${half * 2}`} aria-hidden>
      <path d={d} transform={`translate(0, ${BADGE_DEPTH})`} fill="var(--color-day-gray-plinth)" />
      <path d={d} fill="var(--color-day-gray)" />
      {face.kind === 'text' ? (
        <text
          y={5}
          textAnchor="middle"
          fontSize={face.text.length > 2 ? 12 : 15}
          fontFamily="var(--font-display)"
          fontWeight={700}
          fill="var(--color-text-muted)"
        >
          {face.text}
        </text>
      ) : (
        <path
          d={face.icon === 'trophy' ? TROPHY_PATH_D : ICON_PATH_D.flag}
          transform={`translate(${-BADGE_RADIUS * 0.55}, ${-BADGE_RADIUS * 0.55}) scale(${(BADGE_RADIUS * 1.1) / 24})`}
          fill="none"
          stroke="var(--color-text-muted)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

/**
 * How far off a mark is, said in the unit that mark is actually counted in.
 *
 * A calendar mark is a date the road reaches by turning up; a tier is days that still have to be
 * *put in*, and a missed day pushes it further off. Printing both as "через N дней" would turn the
 * second into a promise the app has not made — so the difference is said on the line itself, where
 * it is read, rather than parked behind a "?".
 */
function distanceText(marker: HorizonMarker): string {
  const n = marker.daysAhead
  return marker.kind === 'tier' ? `${n} ${dayWord(n)} без пропусков` : `через ${n} ${dayWord(n)}`
}

export interface HorizonPanelProps {
  markers: HorizonMarker[]
}

export default function HorizonPanel({ markers }: HorizonPanelProps) {
  if (markers.length === 0) return null
  const [next, ...rest] = markers

  return (
    <div className="border-b border-border bg-surface px-4 pb-5 pt-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="sk-eyebrow rounded-full bg-surface-raised px-3 py-1">Дальше</span>

        <div className="flex items-center gap-3">
          <MarkerBadge marker={next} size={44} />
          <div className="flex flex-col items-start">
            <span className="text-[17px] font-semibold text-text-secondary">{next.label}</span>
            <span className="text-[13px] text-text-muted">{distanceText(next)}</span>
          </div>
        </div>

        {rest.length > 0 && (
          <div className="flex flex-col items-center gap-1.5">
            {rest.map((m) => (
              <div key={m.label} className="flex items-center gap-2">
                <MarkerBadge marker={m} size={22} />
                <span className="text-[13px] text-text-muted">
                  {m.label} · {distanceText(m)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
