import { useRef, useState } from 'react'
import Icon from '../Icon'
import { dayWord, formatShortDate } from '../../domain/calendar'
import { getLogicalToday } from '../../domain/pathEngine'
import {
  clearQuarantine,
  exportStateJson,
  markBackupSaved,
  readBackup,
  readQuarantine,
  type QuarantinedRecord,
} from '../../storage/appStorage'
import { downloadJson } from '../../storage/download'
import { localDateOf } from '../../storage/roadPlan'
import type { RoadSnapshot } from '../../storage/roadSync'
import { useAppState } from '../../state/appState'
import { useRoadSync } from '../../state/roadSyncState'

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
  const sync = useRoadSync()
  const fileInput = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [quarantined, setQuarantined] = useState<QuarantinedRecord | null>(() => readQuarantine())
  /** `null` — ещё не спрашивали. Пустой массив — спросили, аккаунт ничего не помнит. */
  const [snapshots, setSnapshots] = useState<RoadSnapshot[] | null>(null)

  const dayCount = state.days.length

  /** Одна и та же оговорка перед любой заменой: человек должен видеть, что теряет, а не что берёт. */
  function replacingLine() {
    return dayCount > 0
      ? `Сейчас в пути ${dayCount} ${dayWord(dayCount)} — они будут заменены.`
      : 'Текущий путь пуст.'
  }

  /**
   * Дорога есть и здесь, и в аккаунте. Приложение не выбирает молча — «последняя запись побеждает»
   * это способ однажды стереть человеку месяц, — и спрашивает здесь же, где спрашивает про файл:
   * вопрос один и тот же, и стоять он должен в одном месте.
   */
  async function takeFromAccount() {
    setError(null)
    setBusy(true)
    try {
      const outcome = await sync.fetchRemote()
      if (outcome.kind === 'empty') return setError('В аккаунте пусто.')
      if (outcome.kind === 'unreadable') return setError(`Копию из аккаунта не удалось прочитать: ${outcome.reason}.`)

      const incoming = outcome.state.days.length
      const lastDate = outcome.state.days.at(-1)?.date ?? '—'
      if (!confirm(`Взять из аккаунта копию от ${lastDate} (${incoming} ${dayWord(incoming)})?\n${replacingLine()}`)) return

      sync.acceptRemote(outcome.state)
    } catch {
      setError('Не получилось забрать копию. Проверь связь.')
    } finally {
      setBusy(false)
    }
  }

  async function keepThisRoad() {
    setError(null)
    if (!confirm(`Оставить дорогу с этого телефона (${dayCount} ${dayWord(dayCount)})?\nКопия в аккаунте будет переписана ею.`)) return
    setBusy(true)
    try {
      await sync.keepLocal()
    } finally {
      setBusy(false)
    }
  }

  /**
   * Ранние копии спрашиваются **по нажатию**, а не сами. Это редкий разговор — «сюда уехало что-то
   * не то», — и лишний запрос на каждое открытие настроек он не стоит.
   */
  async function loadSnapshots() {
    setError(null)
    setBusy(true)
    try {
      setSnapshots(await sync.listSnapshots())
    } catch {
      setError('Не получилось спросить аккаунт про ранние копии. Проверь связь.')
    } finally {
      setBusy(false)
    }
  }

  async function takeSnapshot(snapshot: RoadSnapshot) {
    setError(null)
    setBusy(true)
    try {
      const outcome = await sync.fetchSnapshot(snapshot.takenOn)
      if (outcome.kind === 'empty') return setError('Этой копии в аккаунте уже нет.')
      if (outcome.kind === 'unreadable') return setError(`Эту копию не удалось прочитать: ${outcome.reason}.`)

      const incoming = outcome.state.days.length
      const ending = outcome.state.days.at(-1)?.date ?? '—'
      if (!confirm(`Вернуть копию, которая кончается ${ending} (${incoming} ${dayWord(incoming)})?\n${replacingLine()}`)) return

      // Тот же путь, что у копии из аккаунта: `replaceState` доводит дорогу до сегодня, а дальше
      // она уезжает обратно сама — и по дороге туда оставляет снимок того, что мы сейчас бросаем.
      sync.acceptRemote(outcome.state)
    } catch {
      setError('Не получилось забрать копию. Проверь связь.')
    } finally {
      setBusy(false)
    }
  }

  function saveCopy() {
    setError(null)
    const today = getLogicalToday(new Date())
    downloadJson(`the-way-${today}.json`, exportStateJson(state))
    markBackupSaved(today)
  }

  async function restoreFrom(file: File) {
    setError(null)
    const outcome = readBackup(await file.text())

    if (outcome.kind === 'empty') return setError('Файл пустой.')
    if (outcome.kind === 'unreadable') return setError(`Это не похоже на копию The Way: ${outcome.reason}.`)

    const incoming = outcome.state.days.length
    const lastDate = outcome.state.days.at(-1)?.date ?? '—'
    if (!confirm(`Восстановить копию от ${lastDate} (${incoming} ${dayWord(incoming)})?\n${replacingLine()}`)) return

    replaceState(outcome.state)
  }

  return (
    <section className={compact ? 'flex w-full flex-col gap-3' : 'sk-card flex flex-col gap-4'}>
      {!compact && (
        <div className="flex flex-col gap-1.5">
          <span className="sk-eyebrow">Резервная копия</span>
          {/* Пока копия не уходит в аккаунт, это правда целиком: другой копии нет. Как только
              уходит — первая фраза становится ложью, и оставить её значило бы пугать человека
              тем, от чего он уже защищён. Файл при этом не отменяется: он ни от кого не зависит. */}
          {sync.phase === 'syncing' ? (
            <p className="text-[13px] text-text-muted">
              Путь лежит на этом телефоне, а копия уходит в аккаунт сама. Файл всё равно стоит
              хранить: он не зависит ни от связи, ни от аккаунта.
            </p>
          ) : (
            <p className="text-[13px] text-text-muted">
              Путь хранится только в этом браузере. Очистка данных, переезд на другой телефон или
              долгий перерыв — и история исчезнет. Копия — единственный способ её вернуть.
            </p>
          )}
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

      {sync.phase === 'ask' && (
        <div className="sk-card-nested flex flex-col gap-2 text-left">
          <p className="text-[13px] text-text-primary">
            В аккаунте лежит копия
            {sync.remote ? ` от ${formatShortDate(localDateOf(sync.remote.updatedAt))}` : ''}, а на этом
            телефоне — {dayCount} {dayWord(dayCount)} пути. Пока не выберешь, в аккаунт ничего не уходит.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void takeFromAccount()} className="sk-btn sk-btn-outline sk-btn-sm flex-1">
              Взять из аккаунта
            </button>
            <button type="button" disabled={busy} onClick={() => void keepThisRoad()} className="sk-btn sk-btn-ghost sk-btn-sm flex-1">
              Оставить эту
            </button>
          </div>
        </div>
      )}

      {/* Только в настройках: на онбординге разбираться, какой из четырнадцати дней настоящий,
          человеку нечем — он ещё ничего не прожил, и пустому устройству история приезжает сама. */}
      {!compact && sync.phase !== 'off' && sync.phase !== 'loading' && (
        <div className="sk-card-nested flex flex-col gap-2 text-left">
          <p className="text-[13px] text-text-muted">
            Аккаунт помнит и то, что лежало в нём в прошлые дни — две недели назад. Это на случай,
            если сюда уехало не то.
          </p>
          {snapshots === null ?
            <button type="button" disabled={busy} onClick={() => void loadSnapshots()} className="sk-btn sk-btn-outline sk-btn-sm">
              Показать ранние копии
            </button>
          : snapshots.length === 0 ?
            <p className="text-[13px] text-text-muted">Ранних копий нет: аккаунт ещё ничего не заменял.</p>
          : <ul className="flex flex-col">
              {snapshots.map((snapshot) => (
                <li key={snapshot.takenOn} className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-[13px] text-text-primary">
                    {snapshot.lastDate === null ?
                      `Пустой путь · ${formatShortDate(snapshot.takenOn)}`
                    : `${formatShortDate(snapshot.lastDate)} · ${snapshot.dayCount} ${dayWord(snapshot.dayCount)}`}
                  </span>
                  <button type="button" disabled={busy} onClick={() => void takeSnapshot(snapshot)} className="sk-btn sk-btn-ghost sk-btn-sm">
                    Вернуть
                  </button>
                </li>
              ))}
            </ul>
          }
        </div>
      )}

      {sync.phase === 'blocked' && (
        <p className="text-[13px] text-text-muted">
          Копия в аккаунте сделана более новой версией приложения ({sync.blockedReason}). Она не
          трогается: обнови приложение и открой этот экран снова.
        </p>
      )}

      {(error ?? sync.error) && (
        <p className="text-[13px]" style={{ color: 'var(--color-day-red)' }}>
          {error ?? sync.error}
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
              onClick={() => downloadJson(`the-way-quarantine-${quarantined.at.slice(0, 10)}.json`, quarantined.raw)}
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
