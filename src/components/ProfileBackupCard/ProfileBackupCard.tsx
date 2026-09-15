import { useState } from 'react'
import Icon from '../Icon'
import { dayWord, daysBetween, formatLongDate } from '../../domain/calendar'
import { getLogicalToday } from '../../domain/pathEngine'
import { exportStateJson, markBackupSaved, readLastBackupDate } from '../../storage/appStorage'
import { downloadJson } from '../../storage/download'
import { useAppState } from '../../state/appState'

/**
 * The one card on the profile that asks for something. It is here and not buried in the settings
 * because there is no backend: this browser holds the only copy, and a copy nobody ever made is
 * the single way a person loses everything. Restoring lives in the settings instead — it is the
 * rare half, and it is destructive.
 */
export default function ProfileBackupCard() {
  const { state } = useAppState()
  const [savedOn, setSavedOn] = useState<string | null>(() => readLastBackupDate())

  const today = getLogicalToday(new Date())
  const dayCount = state.days.length
  const age = savedOn === null ? null : daysBetween(savedOn, today)

  function saveCopy() {
    downloadJson(`the-way-${today}.json`, exportStateJson(state))
    markBackupSaved(today)
    setSavedOn(today)
  }

  const status =
    savedOn === null || age === null
      ? 'Копии ещё нет'
      : age === 0
        ? 'Копия сохранена сегодня'
        : `Копия от ${formatLongDate(savedOn)} — ${age} ${dayWord(age)} назад`

  return (
    <section className="sk-card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Icon name="arrow-down" size={22} color="var(--color-brand)" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-semibold text-text-primary">{status}</span>
          <span className="text-[13px] text-text-muted">Путь хранится только в этом браузере.</span>
        </div>
      </div>
      <button
        type="button"
        onClick={saveCopy}
        disabled={dayCount === 0}
        className="sk-btn sk-btn-primary sk-btn-block sk-plinth"
      >
        Сохранить копию
      </button>
    </section>
  )
}
