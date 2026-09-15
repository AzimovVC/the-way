import { useMemo } from 'react'
import { TIME_MIN_MARKS } from '../../domain/config'
import type { Day, Goal } from '../../domain/models'
import {
  anchorTask,
  buildMarks,
  earlyStartLink,
  habitWindow,
  markingStyle,
  pointOfNoReturn,
  timeDrift,
} from '../../domain/timeOfDay'

/** Logical hours run 3..27, so anything past midnight comes back down to a clock reading. */
function formatHour(hour: number): string {
  const wrapped = hour >= 24 ? hour - 24 : hour
  const h = Math.floor(wrapped)
  const m = Math.round((wrapped - h) * 60)
  return `${h}:${String(m === 60 ? 0 : m).padStart(2, '0')}`
}

function percent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

/** «0,8 ч» reads like a spreadsheet; under an hour and a half, minutes are what a person thinks in. */
function formatSpan(hours: number): string {
  if (hours < 1.5) return `${Math.round(hours * 60)} мин`
  return `${hours.toFixed(1).replace('.', ',')} ч`
}

/** Hours per week below this read as noise, not as a habit sliding. */
const DRIFT_NOTICEABLE_HOURS = 0.5
/** Difference in outcome below this is not worth stating as a finding. */
const LINK_NOTICEABLE_GAP = 0.1
const MAX_WINDOWS_SHOWN = 3
/** Narrower than this and «между 8:14 и 8:19» is a worse way of saying «около 8:15». */
const WINDOW_COLLAPSE_HOURS = 1 / 6

interface Finding {
  key: string
  label: string
  text: string
}

/**
 * What the times of day add up to. Every line here is descriptive — none of it feeds the road,
 * the colour of a day or a milestone. The app judges whether a day was done, never when: a second
 * bar for being late would be the dark twin this one deliberately does without.
 */
export default function TimeOfDayCard({ days, goals }: { days: Day[]; goals: Goal[] }) {
  const titleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const goal of goals) for (const task of goal.tasks) map.set(task.id, task.title)
    return map
  }, [goals])

  const { findings, marksSoFar, style } = useMemo(() => {
    const marks = buildMarks(days)
    const style = markingStyle(days)
    const timed = marks.filter((m) => m.hour !== null).length
    const found: Finding[] = []

    // When marks are all made in one sitting the clock describes the filling-in, not the doing.
    // Nothing is withheld for it — the wording is simply the true reading of that record.
    const doing = style.batched ? 'отмечаешь' : 'делаешь'

    const taskIds = [...titleById.keys()]

    for (const taskId of taskIds) {
      const window = habitWindow(marks, taskId)
      if (!window || found.filter((f) => f.key.startsWith('window:')).length >= MAX_WINDOWS_SHOWN) continue
      found.push({
        key: `window:${taskId}`,
        label: 'Обычное время',
        text:
          window.high - window.low < WINDOW_COLLAPSE_HOURS
            ? `«${titleById.get(taskId)}» ты ${doing} около ${formatHour(window.median)}.`
            : `«${titleById.get(taskId)}» ты ${doing} между ${formatHour(window.low)} и ${formatHour(window.high)}.`,
      })
    }

    for (const taskId of taskIds) {
      const drift = timeDrift(marks, taskId)
      if (!drift || Math.abs(drift.hoursPerWeek) < DRIFT_NOTICEABLE_HOURS) continue
      const later = drift.hoursPerWeek > 0
      found.push({
        key: `drift:${taskId}`,
        label: later ? 'Сдвигается позже' : 'Сдвигается раньше',
        text: `«${titleById.get(taskId)}» уходит ${later ? 'позже' : 'раньше'} примерно на ${formatSpan(Math.abs(drift.hoursPerWeek))} в неделю.${
          later ? ' Привычка обычно сползает по времени раньше, чем начинает срываться.' : ''
        }`,
      })
    }

    for (const taskId of taskIds) {
      const point = pointOfNoReturn(marks, taskId)
      if (!point) continue
      found.push({
        key: `point:${taskId}`,
        label: 'Точка невозврата',
        text: `После ${formatHour(point.hour)} «${titleById.get(taskId)}» почти не случается: из ${point.openDays} дней, где к этому часу её не было, она состоялась в ${percent(point.chance)}.`,
      })
    }

    const link = earlyStartLink(days)
    if (link && link.earlyRestRate - link.lateRestRate > LINK_NOTICEABLE_GAP) {
      found.push({
        key: 'early',
        label: 'Ранний старт',
        text: `Когда первая задача закрывалась до ${formatHour(link.splitHour)}, остальные дела дня доходили до ${percent(link.earlyRestRate)}; когда позже — до ${percent(link.lateRestRate)}. Это совпадение, а не причина: ранние дни могли быть просто удачными.`,
      })
    }

    const anchor = anchorTask(days)
    if (anchor && anchor.restRateWhenDone - anchor.restRateWhenNot > LINK_NOTICEABLE_GAP) {
      found.push({
        key: 'anchor',
        label: 'С чего начинается день',
        text: `Чаще всего день открывает «${titleById.get(anchor.taskId)}» — в ${percent(anchor.firstShare)} дней. Когда она сделана, остальное закрывается на ${percent(anchor.restRateWhenDone)}; когда нет — на ${percent(anchor.restRateWhenNot)}.`,
      })
    }

    return { findings: found, marksSoFar: timed, style }
  }, [days, titleById])

  if (findings.length === 0) {
    return (
      <div className="sk-card flex flex-col gap-2">
        <p className="text-[13px] text-text-muted">
          {marksSoFar < TIME_MIN_MARKS
            ? `Время отметок копится — пока их ${marksSoFar} из ${TIME_MIN_MARKS}. Дальше здесь появится, когда ты обычно берёшься за дело и после какого часа уже не берёшься.`
            : 'Пока в отметках не видно закономерности по времени — ни устойчивого часа, ни сдвига.'}
        </p>
      </div>
    )
  }

  return (
    <div className="sk-card flex flex-col gap-4">
      {findings.map((finding, i) => (
        <div
          key={finding.key}
          className={finding.label === findings[i - 1]?.label ? 'flex flex-col gap-1 -mt-2' : 'flex flex-col gap-1'}
        >
          {/* Two tasks with the same kind of finding sit under one heading rather than repeating it. */}
          {finding.label !== findings[i - 1]?.label && <span className="sk-eyebrow">{finding.label}</span>}
          <p className="text-[14px] leading-snug text-text-primary">{finding.text}</p>
        </div>
      ))}

      {style.batched && (
        <p className="text-[13px] text-text-muted">
          Похоже, ты отмечаешь всё разом: в {style.batchedDays} из {style.multiMarkDays} дней отметки
          легли в одну минуту. Поэтому выше — время отметки, а не время дела. Порядок задач и связи
          от этого не страдают, а часы станут настоящими, если ставить время вручную.
        </p>
      )}
    </div>
  )
}
