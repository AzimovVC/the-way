import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { TAB_BAR_HEIGHT } from '../TabBar'

/** Where on screen, inside the phone frame, the thing that was tapped stands. */
export interface PopoverAnchor {
  x: number
  y: number
  /** Half-height of the tapped thing — the tail starts clear of it instead of overlapping it. */
  radius: number
}

/** Clear ground kept between the popover and the frame's edges. */
const MARGIN = 12
const MAX_WIDTH = 340
const TAIL = 10
const TAIL_HALF_WIDTH = 11
/** The tail never slides so far along the edge that it meets the corner radius. */
const TAIL_EDGE_INSET = TAIL_HALF_WIDTH + 10
/** The tab bar sits on every screen a popover can open on, and the popover does not run under it. */
const BOTTOM_INSET = TAB_BAR_HEIGHT + MARGIN

/**
 * A popover squeezed below this would show nothing — the only case in which it gives up the side it
 * belongs on. On the road it never comes to that: the view brings the tapped circle up to a row
 * with room under it before the card opens (see openOnRoad). This is for the maps that cannot
 * scroll, where a circle can sit hard against the bottom edge.
 */
const MIN_USEFUL_HEIGHT = 160

/**
 * Дольше этого карточка места не ждёт: с запасом от самого длинного движения дороги (SCROLL_GLIDE_MAX_MS).
 */
const ROOM_WAIT_MAX_MS = 800

/**
 * Запас к просьбе о месте. Дорога встаёт **достаточно близко** к названной строке, а не точно на
 * неё — у неё своя слабина, чтобы не дёргаться ради десяти пикселей. Недобор этих десяти пикселей
 * и есть та самая карточка, которая перевернётся наверх, то есть ровно то, ради чего просьба
 * существует. Просить чуть больше дешевле, чем попасть в точку.
 */
const ROOM_SLACK = 32

interface Layout {
  left: number
  top: number
  width: number
  maxHeight: number
  tailX: number
  below: boolean
}

interface NodePopoverProps {
  anchor: PopoverAnchor
  /** The phone frame's box — the popover is positioned inside it, in its coordinates. */
  frameWidth: number
  frameHeight: number
  /** Colour of the popover's top edge, so the tail can wear it when the popover hangs below. */
  accent: string
  /** Colour of its bottom edge, for the flipped case. Defaults to the card surface. */
  foot?: string
  onClose: () => void
  /**
   * Попросить у того, на чём карточка стоит, места под собой — столько пикселей вниз от центра
   * круга, сколько ей нужно, чтобы поместиться целиком. Зовётся один раз на открытие, и карточка
   * ждёт `done`, не показываясь: появиться там, где не помещаешься, и переехать на глазах — это
   * два движения вместо одного.
   *
   * Без этой просьбы (карточка на карте, которая не прокручивается) высота берётся какая есть, и
   * остаток уходит в прокрутку самой карточки.
   */
  requestRoom?: (neededBelowCentre: number, done: () => void) => void
  children: ReactNode
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * A card that belongs to one circle on the road: it grows out of that circle, wears its colour and
 * points back at it with a tail.
 *
 * This is deliberately not a bottom sheet. A sheet comes from the bottom edge and says nothing
 * about which day it is about — with fifty circles on screen the only thing tying the two together
 * is that one of them was tapped a moment ago. Anchored here, the card *is* the day: it opens where
 * the finger landed, the road stays visible around it, and the tail names the circle.
 *
 * It hangs below the circle when there is room and flips above when there is not, because the road
 * scrolls and today can sit anywhere in the frame — a fixed side would run off the screen half the
 * time.
 *
 * Height is asked for, not taken: the card measures itself and asks what it stands on to raise the
 * circle until it fits (see `requestRoom`). A card that scrolls inside itself hides part of the day
 * inside the day — and the day is the only thing this card is about. The clamp below survives as the
 * last resort, for the case where the thing it stands on cannot move at all.
 */
export default function NodePopover({
  anchor,
  frameWidth,
  frameHeight,
  accent,
  foot = 'var(--color-surface)',
  onClose,
  requestRoom,
  children,
}: NodePopoverProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)
  const [visible, setVisible] = useState(false)
  // Пока место не отдано, карточки на экране нет. Спрашивается оно один раз: круг поднимается по
  // недостаче, а недостача у карточки одна — её собственная высота.
  const [waiting, setWaiting] = useState(!!requestRoom)
  // Сколько места уже попрошено. Число, а не «спрашивали ли»: карточка растёт на глазах — в неё
  // добавляют дело, — и выросшая карточка вправе попросить ещё. Меньше прежнего не просят: дорога
  // не ездит обратно за каждую вычеркнутую строку.
  const askedFor = useRef(0)
  // Просьба живёт в ref: на экране это стрелочная функция, новая на каждый кадр, а зависеть от
  // неё значило бы перемерять карточку на каждый чужой ререндер.
  const askRoom = useRef(requestRoom)
  useEffect(() => {
    askRoom.current = requestRoom
  })

  // Measured, not guessed: the card's content is a task list whose length is the user's business,
  // and where it fits is exactly what decides which side of the circle it opens on. scrollHeight,
  // not offsetHeight, so a card already clamped by maxHeight still reports what it wants to be —
  // otherwise the clamp would feed itself and the card could never grow back.
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return

    const measure = () => {
      const width = Math.min(MAX_WIDTH, frameWidth - MARGIN * 2)
      const left = clamp(anchor.x - width / 2, MARGIN, Math.max(MARGIN, frameWidth - MARGIN - width))
      const tailX = clamp(anchor.x - left, TAIL_EDGE_INSET, Math.max(TAIL_EDGE_INSET, width - TAIL_EDGE_INSET))
      const lowEdge = anchor.y + anchor.radius + TAIL
      const highEdge = anchor.y - anchor.radius - TAIL
      const spaceBelow = frameHeight - BOTTOM_INSET - lowEdge
      const spaceAbove = highEdge - MARGIN
      const wanted = el.scrollHeight
      const ask = askRoom.current
      const needed = anchor.radius + TAIL + wanted + BOTTOM_INSET + ROOM_SLACK
      if (ask && needed > askedFor.current + 4) {
        askedFor.current = needed
        ask(needed, () => setWaiting(false))
      }
      // Below, unless below is unusable. One direction is worth more than a perfect fit: a card
      // that sometimes grows down out of a circle and sometimes up over it makes the user re-read
      // the same gesture every time. Room below is what the card asks for above, so on the road
      // this branch almost always comes out «below» on the second pass.
      const below = spaceBelow >= Math.min(wanted, MIN_USEFUL_HEIGHT) || spaceBelow >= spaceAbove
      const maxHeight = Math.max(MIN_USEFUL_HEIGHT, below ? spaceBelow : spaceAbove)
      const top = below ? lowEdge : Math.max(MARGIN, highEdge - Math.min(wanted, maxHeight))

      setLayout((prev) =>
        prev &&
        prev.left === left &&
        prev.top === top &&
        prev.width === width &&
        prev.maxHeight === maxHeight &&
        prev.tailX === tailX &&
        prev.below === below
          ? prev
          : { left, top, width, maxHeight, tailX, below },
      )
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [anchor.x, anchor.y, anchor.radius, frameWidth, frameHeight])

  // One frame after the layout is known, so the growth starts from the circle rather than from
  // wherever the card happened to be measured — and not before the road has stopped moving.
  useEffect(() => {
    if (!layout || waiting) return
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [layout, waiting])

  // Страховка: просьба о месте уходит наружу, и там она может остаться без ответа — при промахе,
  // при пальце на экране, при развороте. Невидимая карточка — худшее, чем может кончиться
  // движение, которого человек не просил.
  useEffect(() => {
    if (!waiting) return
    const id = setTimeout(() => setWaiting(false), ROOM_WAIT_MAX_MS)
    return () => clearTimeout(id)
  }, [waiting])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tailFill = layout?.below ? accent : foot

  return (
    <div className="absolute inset-0 z-30" onClick={onClose}>
      <div
        className="absolute"
        style={{
          left: layout?.left ?? MARGIN,
          top: layout?.top ?? 0,
          width: layout?.width ?? Math.min(MAX_WIDTH, frameWidth - MARGIN * 2),
          visibility: layout ? 'visible' : 'hidden',
          transformOrigin: `${layout?.tailX ?? 0}px ${layout?.below === false ? '100%' : '0%'}`,
          transform: visible ? 'scale(1)' : 'scale(0.72)',
          opacity: visible ? 1 : 0,
          transition: 'transform var(--dur-base) var(--ease-bounce), opacity var(--dur-base) var(--ease-out)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={cardRef}
          className="hide-scrollbar overflow-y-auto rounded-[var(--r-sheet)] border border-border bg-surface"
          style={{ maxHeight: layout?.maxHeight, boxShadow: 'var(--shadow-lg)' }}
        >
          {children}
        </div>

        {/* The tail is drawn open at its base — two stroked sides and a filled body — so it reads as
            the card's own edge pulled into a point, not as a triangle parked next to it. The strip
            under its base hides the card's hairline border across that same width. */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: (layout?.tailX ?? 0) - TAIL_HALF_WIDTH,
            top: layout?.below === false ? undefined : -TAIL + 1,
            bottom: layout?.below === false ? -TAIL + 1 : undefined,
            width: TAIL_HALF_WIDTH * 2,
            height: TAIL,
            transform: layout?.below === false ? 'scaleY(-1)' : undefined,
          }}
        >
          <svg width={TAIL_HALF_WIDTH * 2} height={TAIL} style={{ display: 'block' }}>
            <path
              d={`M 0 ${TAIL} L ${TAIL_HALF_WIDTH} 0 L ${TAIL_HALF_WIDTH * 2} ${TAIL}`}
              fill={tailFill}
              stroke="var(--color-border)"
              strokeWidth={1}
              strokeLinejoin="round"
            />
            <rect x={1} y={TAIL - 1} width={TAIL_HALF_WIDTH * 2 - 2} height={2} fill={tailFill} />
          </svg>
        </div>
      </div>
    </div>
  )
}
