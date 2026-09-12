import type { Rebound, StreakInfo } from '../../domain/analytics'

export interface WrappedData {
  periodLabel: string
  streak: StreakInfo
  longestDeclineLength: number
  bestRebound: Rebound | null
  patterns: string[]
}

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

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
  gradient.addColorStop(0, '#1a1a1f')
  gradient.addColorStop(1, '#0f0f12')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#e0b04c'
  ctx.font = '600 22px system-ui, sans-serif'
  ctx.fillText('The Way', 24, 56)

  ctx.fillStyle = '#9a9aa2'
  ctx.font = '400 14px system-ui, sans-serif'
  ctx.fillText(data.periodLabel, 24, 82)

  let y = 130
  const stats: [string, string][] = [
    ['Золотых дней подряд', String(data.streak.currentGoldStreak)],
    ['Золотых дней всего', String(data.streak.totalGoldDays)],
    ['Самый долгий откат', `${data.longestDeclineLength} дн.`],
  ]
  if (data.bestRebound) {
    stats.push(['Лучшее восстановление', `${data.bestRebound.length} дн.`])
  }

  for (const [label, value] of stats) {
    ctx.fillStyle = '#f5f5f2'
    ctx.font = '700 28px system-ui, sans-serif'
    ctx.fillText(value, 24, y)
    ctx.fillStyle = '#9a9aa2'
    ctx.font = '400 13px system-ui, sans-serif'
    ctx.fillText(label, 24, y + 20)
    y += 64
  }

  y += 20
  ctx.fillStyle = '#f5f5f2'
  ctx.font = '400 14px system-ui, sans-serif'
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

export default function WrappedCard({ data }: { data: WrappedData }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div>
        <h3 className="text-lg font-semibold text-accent">The Way</h3>
        <p className="text-sm text-text-secondary">{data.periodLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Золотых дней подряд" value={data.streak.currentGoldStreak} />
        <Stat label="Золотых дней всего" value={data.streak.totalGoldDays} />
        <Stat label="Самый долгий откат" value={`${data.longestDeclineLength} дн.`} />
        <Stat label="Лучшее восстановление" value={data.bestRebound ? `${data.bestRebound.length} дн.` : '—'} />
      </div>

      {data.patterns.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm text-text-primary">
          {data.patterns.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => exportWrappedImage(data)}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-bg"
      >
        Сохранить как картинку
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  )
}
