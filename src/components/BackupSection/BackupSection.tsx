import { useRef, useState } from 'react'
import Icon from '../Icon'
import { dayWord } from '../../domain/calendar'
import { getLogicalToday } from '../../domain/pathEngine'
import {
  clearQuarantine,
  exportStateJson,
  readBackup,
  readQuarantine,
  type QuarantinedRecord,
} from '../../storage/appStorage'
import { useAppState } from '../../state/appState'

function download(filename: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * The app has no backend, so this screen is the only place a person can get their history out of
 * the browser that happens to hold it. That is not a power-user feature here: a new phone, a
 * cleared site, or an iOS eviction of a PWA that was not added to the home screen all end the
 * same way otherwise.
 */
export interface BackupSectionProps {
  /**
   * The onboarding form of the section: no explainer, no save button. A path that does not exist
   * yet cannot be copied — but this is exactly where someone arriving with a backup from an old
   * phone, or whose record was quarantined a moment ago, has to be able to get back in.
   */
  compact?: boolean
}

export default function BackupSection({ compact = false }: BackupSectionProps) {
  const { state, replaceState } = useAppState()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [quarantined, setQuarantined] = useState<QuarantinedRecord | null>(() => readQuarantine())

  const dayCount = state.days.length

  function saveCopy() {
    setError(null)
    download(`the-way-${getLogicalToday(new Date())}.json`, exportStateJson(state))
  }

  async function restoreFrom(file: File) {
    setError(null)
    const outcome = readBackup(await file.text())

    if (outcome.kind === 'empty') return setError('Файл пустой.')
    if (outcome.kind === 'unreadable') return setError(`Это не похоже на копию The Way: ${outcome.reason}.`)

    const incoming = outcome.state.days.length
    const lastDate = outcome.state.days.at(-1)?.date ?? '—'
    const replacing =
      dayCount > 0
        ? `Сейчас в пути ${dayCount} ${dayWord(dayCount)} — они будут заменены.`
        : 'Текущий путь пуст.'
    if (!confirm(`Восстановить копию от ${lastDate} (${incoming} ${dayWord(incoming)})?\n${replacing}`)) return

    replaceState(outcome.state)
  }

  return (
    <section className={compact ? 'flex w-full flex-col gap-3' : 'sk-card flex flex-col gap-4'}>
      {!compact && (
        <div className="flex flex-col gap-1.5">
          <span className="sk-eyebrow">Резервная копия</span>
          <p className="text-[13px] text-text-muted">
            Путь хранится только в этом браузере. Очистка данных, переезд на другой телефон или
            долгий перерыв — и история исчезнет. Копия — единственный способ её вернуть.
          </p>
        </div>
      )}

      {/* Stacked, not side by side: at 390px the two labels do not fit on one row in Russian. */}
      <div className="flex flex-col gap-2">
        {!compact && (
          <button type="button" onClick={saveCopy} disabled={dayCount === 0} className="sk-btn sk-btn-outline sk-btn-block">
            <Icon name="arrow-down" size={16} />
            Сохранить копию
          </button>
        )}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className={`sk-btn sk-btn-block ${compact ? 'sk-btn-ghost' : 'sk-btn-outline'}`}
        >
          <Icon name="arrow-up" size={16} />
          Восстановить из копии
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Cleared right away, or picking the same file twice in a row fires no change event.
          e.target.value = ''
          if (file) void restoreFrom(file)
        }}
      />

      {error && (
        <p className="text-[13px]" style={{ color: 'var(--color-day-red)' }}>
          {error}
        </p>
      )}

      {quarantined && (
        <div className="sk-card-nested flex flex-col gap-2 text-left">
          <p className="text-[13px] text-text-primary">
            При запуске нашлась запись, которую не удалось прочитать
            {' '}({quarantined.reason}). Она отложена целиком и не стёрта.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => download(`the-way-quarantine-${quarantined.at.slice(0, 10)}.json`, quarantined.raw)}
              className="sk-btn sk-btn-outline sk-btn-sm flex-1"
            >
              Скачать её
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirm('Удалить отложенную запись навсегда?')) return
                clearQuarantine()
                setQuarantined(null)
              }}
              className="sk-btn sk-btn-ghost sk-btn-sm flex-1"
            >
              Удалить
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
