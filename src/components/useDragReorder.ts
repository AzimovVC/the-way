import { useRef, useState } from 'react'

export interface DragState {
  /** Что тащим — id строки в списке. */
  id: string
  /** Откуда взяли и куда встанет, если отпустить сейчас. */
  from: number
  to: number
  /** Сдвиг пальца от места захвата. */
  dy: number
  /** Высота захваченной строки вместе с зазором — на столько уступают соседи. */
  step: number
}

/**
 * Перетаскивание строк пальцем — без библиотеки и без спора со скроллом.
 *
 * Жест начинается **только с ручки**, поэтому список по-прежнему скроллится с любого другого
 * места, а тап по строке остаётся тапом. Это и есть цена, которую платят за палец: без ручки
 * одно и то же движение означало бы «листать» и «двигать», и выигрывал бы всегда список.
 *
 * Строки при этом никуда не переставляются, пока палец не отпущен: рисуется только сдвиг
 * (`transform`), а настоящий порядок меняется один раз, в конце. Переставлять по дороге значит
 * пересчитывать то, из чего считаются сами позиции, — и строка начинает дрожать под пальцем.
 */
export function useDragReorder(onDrop: (id: string, toIndex: number) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  // Прямоугольники строк, снятые в момент захвата. Читать их на каждом движении нельзя: строки
  // в этот момент уже сдвинуты нашим же transform, и следующий кадр считался бы от них.
  const rects = useRef<DOMRect[]>([])
  const startY = useRef(0)

  /** `rows` — сами элементы строк группы, в том порядке, в каком они стоят на экране. */
  function onPointerDown(event: React.PointerEvent, id: string, index: number, rows: (HTMLElement | null)[]) {
    const present = rows.filter((row): row is HTMLElement => row !== null)
    if (present.length < 2) return
    event.preventDefault()
    // Захват пальца — удобство, а не условие: без него движение теряется, стоит пальцу уйти за
    // край ручки. Но он умеет бросать (палец уже отпущен, WebKit), и падать из-за этого жест не
    // должен — дальше он работает и на всплывающих событиях.
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // без захвата
    }

    rects.current = present.map((row) => row.getBoundingClientRect())
    startY.current = event.clientY
    const own = rects.current[index]
    const next = rects.current[index + 1] ?? rects.current[index - 1]
    // Зазор между строками входит в шаг: сосед уступает место целиком, вместе с промежутком.
    const step = next ? Math.abs(next.top - own.top) : own.height
    setDrag({ id, from: index, to: index, dy: 0, step })
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drag) return
    const dy = event.clientY - startY.current
    const own = rects.current[drag.from]
    const center = own.top + own.height / 2 + dy

    // Куда встанет строка: первая позиция, чья середина ниже нашей. Сравнение по серединам, а не
    // по краям, — иначе строка меняется местами с соседом, едва задев его, и на длинном списке
    // это читается как дрожь.
    let to = 0
    for (let i = 0; i < rects.current.length; i++) {
      const r = rects.current[i]
      if (center > r.top + r.height / 2) to = i
    }
    setDrag({ ...drag, dy, to })
  }

  function onPointerUp() {
    if (!drag) return
    if (drag.to !== drag.from) onDrop(drag.id, drag.to)
    setDrag(null)
  }

  /** Насколько сдвинуть строку `index`, пока палец держит строку `drag.from`. */
  function offsetOf(index: number): number {
    if (!drag) return 0
    if (index === drag.from) return drag.dy
    if (drag.from < drag.to && index > drag.from && index <= drag.to) return -drag.step
    if (drag.from > drag.to && index >= drag.to && index < drag.from) return drag.step
    return 0
  }

  return { drag, offsetOf, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp } }
}
