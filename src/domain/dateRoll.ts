/**
 * Окошко с датой — то, что стоит у дороги, пока листаешь назад, и меняет число, как перекидные часы.
 *
 * Всё здесь считается от **позиции скролла**, а не от времени. Это главное правило: перекидной
 * календарь тратит на лепесток около 200 мс, а на быстром листании дней проходит десяток в секунду
 * — анимация со своей длительностью либо копит очередь и врёт о том, где ты, либо глотает кадры.
 * Здесь очереди нет: у окна всегда есть одна верная цель, и переход к ней всякий раз
 * перенацеливается с того места, где застал.
 */
export interface RollPlacement {
  /** Сдвиг всей ленты, px: строка дня под фокусом встаёт в середину окна. */
  offsetPx: number
}

export function rollPlacement(index: number, rowHeightPx: number, boxHeightPx: number): RollPlacement {
  // Строка дня i стоит на i * rowHeightPx от начала ленты; лента двигается так, чтобы эта строка
  // пришлась ровно на середину окна.
  return { offsetPx: boxHeightPx / 2 - rowHeightPx / 2 - index * rowHeightPx }
}

/**
 * Какой день показан в окне при такой позиции скролла.
 *
 * Округление, а не дробный индекс, — и в этом вся разница между **читаемым числом и лентой**.
 * В окне высотой в одну строку дробная позиция значит две половины дат разом: ни одну из них не
 * прочитать, а стоит скролл почти всегда между днями, потому что к дням он не липнет. Округлённый
 * день показан целиком и меняется на середине перегона — ровно там, где человек и сам сказал бы,
 * что смотрит уже на следующий.
 */
export function rollDayShown(indexFloat: number): number {
  return Math.round(indexFloat)
}

export interface MonthRows {
  /** Месяцы в порядке появления, по одной строке на месяц: 'YYYY-MM'. */
  rows: string[]
  /** Для дня i — номер его строки в `rows`. */
  rowOfIndex: number[]
}

/**
 * Лента месяцев рядом с лентой чисел.
 *
 * Дата в окне — это две вещи, которые меняются с разной частотой: число каждый день, месяц раз в
 * тридцать дней. Одной лентой они едут вместе, и «авг» перекидывается на «авг» тридцать раз подряд
 * — мелькание без новостей, из-за которого не прочитать и само число. Здесь у месяца своя лента и
 * своя строка на месяц: она стоит неподвижно весь месяц и трогается ровно там, где месяц меняется.
 */
export function rollMonthRows(dates: string[]): MonthRows {
  const rows: string[] = []
  const rowOfIndex: number[] = []
  for (const date of dates) {
    const month = date.slice(0, 7)
    if (rows[rows.length - 1] !== month) rows.push(month)
    rowOfIndex.push(rows.length - 1)
  }
  return { rows, rowOfIndex }
}

/** Прямоугольник на экране, который чипу занимать нельзя: круг соседнего дня, недельный бокс, веха. */
export interface RollObstacle {
  x: number
  y: number
  halfW: number
  halfH: number
}

export interface RollChipBox {
  /** Ширина и высота самого чипа, px экрана. */
  width: number
  height: number
  /** Зазор от края круга до чипа. */
  gap: number
  /** Радиус круга, у которого чип стоит, px экрана. */
  radius: number
}

/** Экран, за который чипу нельзя вылезать. */
export interface RollBounds {
  width: number
  height: number
  /** Сколько чип оставляет себе от края. */
  edge: number
}

export interface RollAnchor {
  /** Центр чипа на экране, px. */
  x: number
  y: number
  /** С какой из двух сторон дороги он встал: -1 — «домашняя», +1 — другая. */
  side: -1 | 1
}

function overlapArea(cx: number, cy: number, chip: RollChipBox, o: RollObstacle): number {
  const w = Math.min(cx + chip.width / 2, o.x + o.halfW) - Math.max(cx - chip.width / 2, o.x - o.halfW)
  const h = Math.min(cy + chip.height / 2, o.y + o.halfH) - Math.max(cy - chip.height / 2, o.y - o.halfH)
  return w > 0 && h > 0 ? w * h : 0
}

/** Сколько чипа вылезло за экран — в тех же единицах площади, что и наложение на чужое. */
function offscreenArea(cx: number, cy: number, chip: RollChipBox, bounds: RollBounds): number {
  const over = (v: number) => Math.max(0, v)
  const left = over(bounds.edge - (cx - chip.width / 2))
  const right = over(cx + chip.width / 2 - (bounds.width - bounds.edge))
  const top = over(bounds.edge - (cy - chip.height / 2))
  const bottom = over(cy + chip.height / 2 - (bounds.height - bounds.edge))
  return (left + right) * chip.height + (top + bottom) * chip.width
}

/** Полоска перекрытия во всю высоту чипа, ради которой стоит уйти с домашней стороны. */
const SIDE_LEAVE_PX = 6
/** И более узкая, при которой чип уже возвращается домой. */
const SIDE_RETURN_PX = 2

function place(
  focus: { x: number; y: number },
  nx: number,
  ny: number,
  /** -1 — домашняя сторона, вдоль нормали; +1 — против неё. */
  side: -1 | 1,
  chip: RollChipBox,
  /** Сдвиг вдоль дороги, px: 0 — точно напротив дня, ± — назад и вперёд по ходу. */
  slide: number,
  dx: number,
  dy: number,
): { x: number; y: number } {
  // Отступ считается по проекции самого чипа на нормаль: у прямоугольника «половина размера» зависит
  // от того, каким боком он повёрнут к дороге, и одна и та же цифра дала бы на диагонали то дыру,
  // то наезд.
  const half = (Math.abs(nx) * chip.width + Math.abs(ny) * chip.height) / 2
  const d = chip.radius + chip.gap + half
  const sign = side < 0 ? 1 : -1
  return {
    x: focus.x + sign * nx * d + slide * dx,
    y: focus.y + sign * ny * d + slide * dy,
  }
}

/**
 * Куда встать чипу у круга: не «слева или справа», а **по нормали к дороге**.
 *
 * Свободное место у дороги всегда перпендикулярно её ходу. Шаг дороги — 64 px, круг — 22 в радиусе,
 * и на диагонали между двумя соседними днями по горизонтали остаётся около 64/√2 ≈ 45 px: подпись,
 * отодвинутая строго вбок, ложится на соседа с любой стороны, и никакой выбор из двух горизонталей
 * этого не чинит. Отодвинутая по нормали — проходит между ними, потому что именно там дорога и
 * оставила зазор.
 *
 * Нормалей две, и выбор между ними тот же, что раньше был между «слева» и «справа»: одна из них —
 * **дом** (та, что уводит чип влево, а на горизонтальном участке — вверх), и чип уходит на вторую,
 * только когда дома ему правда не встать. Пороги разные в одну и в другую сторону (`current` — где
 * чип стоит сейчас): уходить — при перекрытии шире SIDE_LEAVE_PX, возвращаться — когда осталось
 * меньше SIDE_RETURN_PX. Один порог на оба направления дребезжал бы ровно на нём.
 *
 * Считается площадь: наложение на чужое и вылезшее за экран — в одних единицах, поэтому «вылез за
 * край» и «лёг на кружок» сравниваются между собой, а не решаются по очереди.
 */
export function rollAnchor(
  focus: { x: number; y: number },
  direction: { x: number; y: number },
  chip: RollChipBox,
  obstacles: RollObstacle[],
  bounds: RollBounds,
  current: -1 | 1 = -1,
): RollAnchor {
  const len = Math.hypot(direction.x, direction.y)
  // Дорога без направления бывает только на истории из одного дня; там она смотрит вверх.
  const dx = len > 0 ? direction.x / len : 0
  const dy = len > 0 ? direction.y / len : -1
  // Нормаль — поворот направления на прямой угол. Для дороги, идущей вверх, это (-1, 0): влево.
  let nx = dy
  let ny = -dx
  // Домашняя сторона — левая; на горизонтальном участке, где «левее» не существует, — верхняя.
  if (nx > 0 || (nx === 0 && ny > 0)) {
    nx = -nx
    ny = -ny
  }
  // Сдвиг вдоль дороги — третья свобода, без которой крутой поворот неразрешим: там обе нормали
  // упираются в соседние дни, и «выбрать сторону получше» значит выбрать, на какой кружок лечь.
  // Сдвинувшись вдоль дороги, чип проходит между ними и остаётся при своём дне. Величина — ровно
  // «встать у плеча своего дня»: его радиус, зазор и половина самого чипа вдоль дороги. Берётся из
  // размеров, а не из длины переданного вектора: направление имеет право прийти любой длины.
  const alongHalf = (Math.abs(dx) * chip.width + Math.abs(dy) * chip.height) / 2
  const step = chip.radius + chip.gap + alongHalf
  const slides = [0, step, -step]
  const best = (side: -1 | 1) => {
    let bestCost = Infinity
    let bestPoint = place(focus, nx, ny, side, chip, 0, dx, dy)
    for (const slide of slides) {
      const p = place(focus, nx, ny, side, chip, slide, dx, dy)
      let total = offscreenArea(p.x, p.y, chip, bounds)
      for (const o of obstacles) total += overlapArea(p.x, p.y, chip, o)
      // Сдвиг вдоль дороги — уступка, а не свобода: ровно напротив своего дня подпись читается без
      // вопросов, поэтому съехавшая позиция обязана быть заметно чище, а не просто не хуже.
      const preference = slide === 0 ? 0 : SIDE_RETURN_PX * chip.height
      if (total + preference < bestCost) {
        bestCost = total + preference
        bestPoint = p
      }
    }
    return { cost: bestCost, point: bestPoint }
  }
  const home = best(-1)
  const threshold = (current < 0 ? SIDE_LEAVE_PX : SIDE_RETURN_PX) * chip.height
  if (home.cost <= threshold) return { x: home.point.x, y: home.point.y, side: -1 }
  // Дома не встать. На другую сторону — только если там действительно свободнее: на узком месте,
  // где заняты обе, прыжок ничего не чинит, а подпись теряет своё привычное место.
  const away = best(1)
  return away.cost < home.cost
    ? { x: away.point.x, y: away.point.y, side: 1 }
    : { x: home.point.x, y: home.point.y, side: -1 }
}
