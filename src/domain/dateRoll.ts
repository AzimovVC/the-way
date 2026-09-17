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

function overlapArea(
  left: number,
  right: number,
  top: number,
  bottom: number,
  o: RollObstacle,
): number {
  const w = Math.min(right, o.x + o.halfW) - Math.max(left, o.x - o.halfW)
  const h = Math.min(bottom, o.y + o.halfH) - Math.max(top, o.y - o.halfH)
  return w > 0 && h > 0 ? w * h : 0
}

/**
 * С какой стороны круга встать чипу: -1 — слева, +1 — справа.
 *
 * Дорога поворачивает, и слева от круга оказывается то пусто, то соседний день или недельный бокс.
 * Подпись, легшая на кружок, портит обоих, а прятать её на повороте значит терять её там, где
 * человек как раз разбирается, куда дорога пошла. Поэтому сторона не задана, а **выбирается**.
 *
 * Выбор не симметричный: левая сторона — дом. Чип уходит направо, только когда слева ему правда не
 * встать, и возвращается, как только слева снова чисто. Симметричное «где перекрытие меньше» честно
 * по арифметике и невыносимо на глаз: на извилистой дороге обе стороны почти одинаковы, и подпись
 * прыгает через круг каждые несколько дней, хотя мешает ей от силы край соседа.
 *
 * Считается площадь перекрытия, а не расстояние: чип — прямоугольник, и «ближе центр» ничего не
 * говорит о том, задевает он соседа или проходит мимо.
 *
 * Пороги разные в одну и в другую сторону (`current` — где чип стоит сейчас): уходить —
 * при перекрытии шире SIDE_LEAVE_PX, возвращаться — когда осталось меньше SIDE_RETURN_PX. Один
 * порог на оба направления дребезжал бы ровно на нём.
 */
/** Полоска перекрытия во всю высоту чипа, ради которой стоит уйти с левой стороны. */
const SIDE_LEAVE_PX = 6
/** И более узкая, при которой чип уже возвращается домой. */
const SIDE_RETURN_PX = 2

export function rollSide(
  cx: number,
  cy: number,
  chip: RollChipBox,
  obstacles: RollObstacle[],
  current: -1 | 1 = -1,
): -1 | 1 {
  const top = cy - chip.height / 2
  const bottom = cy + chip.height / 2
  const leftEdge = cx - chip.radius - chip.gap
  const rightEdge = cx + chip.radius + chip.gap
  let leftCost = 0
  let rightCost = 0
  for (const o of obstacles) {
    leftCost += overlapArea(leftEdge - chip.width, leftEdge, top, bottom, o)
    rightCost += overlapArea(rightEdge, rightEdge + chip.width, top, bottom, o)
  }
  const threshold = (current < 0 ? SIDE_LEAVE_PX : SIDE_RETURN_PX) * chip.height
  if (leftCost <= threshold) return -1
  // Слева не встать. Направо — только если там действительно свободнее: на узком месте, где заняты
  // обе стороны, прыжок ничего не чинит, а подпись теряет своё привычное место.
  return rightCost < leftCost ? 1 : -1
}
