/**
 * The shareable PNG of a period's numbers, and the shape it is drawn from.
 *
 * Kept apart from the card that shows the same numbers on screen because this is canvas work, not
 * a component: it mirrors design tokens by hand, lays text out by measuring it, and ends in a
 * download. Sharing a file with the component would also cost the card its fast refresh in dev,
 * which is the one place a card is looked at over and over.
 */
import type { Rebound, StreakInfo } from '../../domain/analytics'

export interface WrappedData {
  periodLabel: string
  streak: StreakInfo
  longestDeclineLength: number
  bestRebound: Rebound | null
  patterns: string[]
}

/* The canvas cannot read CSS custom properties, so the handful of tokens the
   export needs are mirrored here. Keep them in step with index.css. */
const INK_900 = '#0e1014'
const INK_300 = '#6e7889'
const MARIGOLD = '#ffc93d'
const TEXT_PRIMARY = '#f5f7fa'
const DISPLAY_FONT = "'Fredoka', system-ui, sans-serif"
const UI_FONT = "'Figtree', system-ui, sans-serif"

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

function renderToCanvas(data: WrappedData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 360
  canvas.height = 640
  const ctx = canvas.getContext('2d')!

  // Flat fill, never a gradient — the export has to look like the app it came from.
  ctx.fillStyle = INK_900
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = MARIGOLD
  ctx.font = `600 26px ${DISPLAY_FONT}`
  ctx.fillText('The Way', 24, 58)

  ctx.fillStyle = INK_300
  ctx.font = `700 11px ${UI_FONT}`
  ctx.fillText(data.periodLabel.toUpperCase(), 24, 84)

  let y = 130
  // «не было» rather than «0 дн.», to match the card this picture is a copy of: a zero set in the
  // same weight as the other figures reads as an achievement, and the picture is the half that
  // leaves the app.
  const stats: [string, string][] = [
    ['Золотых дней подряд', String(data.streak.currentGoldStreak)],
    ['Золотых дней всего', String(data.streak.totalGoldDays)],
    ['Самый долгий спад', data.longestDeclineLength > 0 ? `${data.longestDeclineLength} дн.` : 'не было'],
    ['Самый быстрый подъём', data.bestRebound ? `${data.bestRebound.length} дн.` : 'не было'],
  ]

  for (const [label, value] of stats) {
    ctx.fillStyle = TEXT_PRIMARY
    ctx.font = `600 32px ${DISPLAY_FONT}`
    ctx.fillText(value, 24, y)
    ctx.fillStyle = INK_300
    ctx.font = `500 13px ${UI_FONT}`
    ctx.fillText(label, 24, y + 20)
    y += 64
  }

  y += 20
  ctx.fillStyle = TEXT_PRIMARY
  ctx.font = `500 15px ${UI_FONT}`
  for (const pattern of data.patterns) {
    const lines = wrapText(ctx, pattern, canvas.width - 48)
    for (const line of lines) {
      ctx.fillText(line, 24, y)
      y += 20
    }
    y += 10
  }

  return canvas
}

export function exportWrappedImage(data: WrappedData) {
  const canvas = renderToCanvas(data)
  const link = document.createElement('a')
  link.download = `the-way-${data.periodLabel.replace(/\s+/g, '-')}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
