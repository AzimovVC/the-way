import { exportWrappedImage, type WrappedData } from './wrappedImage'

export default function WrappedCard({ data }: { data: WrappedData }) {
  return (
    <div className="sk-card flex flex-col gap-4">
      <div>
        <h3 className="sk-heading text-[22px] text-brand">The Way</h3>
        <p className="sk-eyebrow">{data.periodLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Золотых дней подряд" value={data.streak.currentGoldStreak} zero={data.streak.currentGoldStreak === 0} />
        <Stat label="Золотых дней всего" value={data.streak.totalGoldDays} zero={data.streak.totalGoldDays === 0} />
        <Stat label="Самый долгий спад" value={data.longestDeclineLength > 0 ? `${data.longestDeclineLength} дн.` : 'не было'} zero={data.longestDeclineLength === 0} />
        <Stat label="Самый быстрый подъём" value={data.bestRebound ? `${data.bestRebound.length} дн.` : 'не было'} zero={!data.bestRebound} />
      </div>

      {data.patterns.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-[15px] text-text-secondary">
          {data.patterns.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => exportWrappedImage(data)}
        className="sk-btn sk-btn-outline sk-btn-block sk-focus"
      >
        Сохранить как картинку
      </button>
    </div>
  )
}

/**
 * A zero is not an achievement, and set in the same weight as «19» it reads as one. It keeps its
 * place — the grid must not reflow as the numbers arrive — but steps back to muted ink.
 */
function Stat({ label, value, zero }: { label: string; value: string | number; zero?: boolean }) {
  return (
    <div>
      <p className={`sk-num text-[26px] font-semibold ${zero ? 'text-text-muted' : 'text-text-primary'}`}>{value}</p>
      <p className="text-[12px] text-text-muted">{label}</p>
    </div>
  )
}
