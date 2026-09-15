import { exportWrappedImage, type WrappedData } from './wrappedImage'

export default function WrappedCard({ data }: { data: WrappedData }) {
  return (
    <div className="sk-card flex flex-col gap-4">
      <div>
        <h3 className="sk-heading text-[22px] text-brand">The Way</h3>
        <p className="sk-eyebrow">{data.periodLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Золотых дней подряд" value={data.streak.currentGoldStreak} />
        <Stat label="Золотых дней всего" value={data.streak.totalGoldDays} />
        <Stat label="Самый долгий откат" value={`${data.longestDeclineLength} дн.`} />
        <Stat label="Лучшее восстановление" value={data.bestRebound ? `${data.bestRebound.length} дн.` : '—'} />
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
        className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus"
      >
        Сохранить как картинку
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="sk-num text-[26px] font-semibold text-text-primary">{value}</p>
      <p className="text-[12px] text-text-muted">{label}</p>
    </div>
  )
}
