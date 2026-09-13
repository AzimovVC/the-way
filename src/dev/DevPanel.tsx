import { useState } from 'react'
import { simulateFutureDays } from '../domain/dayLifecycle'
import { clearState } from '../storage/appStorage'
import { useAppState } from '../state/AppStateContext'
import {
  setAvoidanceStrength,
  setMaxTurnPerDay,
  setMinPointSeparation,
  setZigzagAmplitude,
  useAvoidanceStrength,
  useMaxTurnPerDay,
  useMinPointSeparation,
  useZigzagAmplitude,
} from './pathTuning'

const PRESETS: { label: string; rate: number | 'random' }[] = [
  { label: '100%', rate: 1 },
  { label: '80%', rate: 0.8 },
  { label: '50%', rate: 0.5 },
  { label: '20%', rate: 0.2 },
  { label: '0%', rate: 0 },
  { label: 'случайно', rate: 'random' },
]

/** Dev-only fast-forward tool: appends N future days at a chosen completion rate so the path's bend over weeks can be previewed without waiting in real time. Never rendered in production builds. */
export default function DevPanel() {
  const { state, setState } = useAppState()
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState(7)
  const [rate, setRate] = useState<number | 'random'>(1)
  const maxTurnPerDay = useMaxTurnPerDay()
  const minPointSeparation = useMinPointSeparation()
  const zigzagAmplitude = useZigzagAmplitude()
  const avoidanceStrength = useAvoidanceStrength()

  function runSimulation() {
    const completionRateFor = rate === 'random' ? () => Math.random() : () => rate
    setState(simulateFutureDays(state, days, completionRateFor))
  }

  function resetAll() {
    if (!confirm('Стереть весь прогресс и начать заново?')) return
    clearState()
    window.location.reload()
  }

  const lastDate = state.days.reduce((max, d) => (d.date > max ? d.date : max), state.days[0]?.date ?? '—')

  return (
    <div className="fixed bottom-3 left-3 z-50 font-sans text-xs" style={{ colorScheme: 'dark' }}>
      {open ? (
        <div className="w-64 max-h-[85vh] overflow-y-auto rounded-xl border-2 border-dashed border-amber-400 bg-black/90 p-3 text-white shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold uppercase tracking-wide text-amber-400">Dev · перемотка времени</span>
            <button type="button" onClick={() => setOpen(false)} className="text-white/60">
              ✕
            </button>
          </div>

          <p className="mb-2 text-white/50">Последний день: {lastDate}</p>

          <label className="mb-1 block text-white/70">Дней вперёд</label>
          <input
            type="number"
            min={1}
            max={120}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
            className="mb-2 w-full rounded border border-white/20 bg-white/10 px-2 py-1 text-white"
          />

          <label className="mb-1 block text-white/70">Выполнение каждого дня</label>
          <div className="mb-3 grid grid-cols-3 gap-1">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setRate(p.rate)}
                className={`rounded px-2 py-1 ${rate === p.rate ? 'bg-amber-400 text-black' : 'bg-white/10 text-white'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={runSimulation}
            className="mb-2 w-full rounded bg-amber-400 px-2 py-1.5 font-semibold text-black"
          >
            Добавить {days} {days === 1 ? 'день' : 'дней'}
          </button>

          <button type="button" onClick={resetAll} className="mb-3 w-full rounded border border-white/20 px-2 py-1.5 text-white/70">
            Сбросить весь прогресс
          </button>

          <label className="mb-1 flex items-center justify-between text-white/70">
            <span>Макс. поворот пути в день</span>
            <span className="text-amber-400">{maxTurnPerDay}°</span>
          </label>
          <input
            type="range"
            min={2}
            max={45}
            step={1}
            value={maxTurnPerDay}
            onChange={(e) => setMaxTurnPerDay(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Меньше — путь плавнее и не пересекает сам себя, но медленнее реагирует на смену тренда.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Мин. расстояние между кружками</span>
            <span className="text-amber-400">{minPointSeparation}px</span>
          </label>
          <input
            type="range"
            min={40}
            max={100}
            step={1}
            value={minPointSeparation}
            onChange={(e) => setMinPointSeparation(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Больше — кружки гарантированно дальше друг от друга при резких разворотах.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Хаотичность (амплитуда смещения)</span>
            <span className="text-amber-400">{zigzagAmplitude}px</span>
          </label>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={zigzagAmplitude}
            onChange={(e) => setZigzagAmplitude(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Больше — кружки заметнее уходят влево-вправо от строгой линии, как в Duolingo.</p>

          <label className="mb-1 mt-3 flex items-center justify-between text-white/70">
            <span>Сила объезда столкновений</span>
            <span className="text-amber-400">{avoidanceStrength}°</span>
          </label>
          <input
            type="range"
            min={0}
            max={45}
            step={1}
            value={avoidanceStrength}
            onChange={(e) => setAvoidanceStrength(Number(e.target.value))}
            className="w-full accent-amber-400"
          />
          <p className="mt-1 text-white/40">Доп. поворот, которым путь заранее огибает соседний кружок вместо резкого сдвига точки.</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border-2 border-dashed border-amber-400 bg-black/90 px-3 py-2 text-amber-400 shadow-xl"
        >
          🛠 dev
        </button>
      )}
    </div>
  )
}
