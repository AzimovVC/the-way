import { useMemo } from 'react'
import { COMPARE_MIN_DAYS, TIME_MIN_MARKS } from '../../domain/config'
import type { Day, Goal } from '../../domain/models'
import {
  anchorTask,
  type AnchorTask,
  buildMarks,
  earlyStartLink,
  habitWindow,
  markingStyle,
  pointOfNoReturn,
  timeDrift,
} from '../../domain/timeOfDay'
import CompareBars from './CompareBars'
import DayRail, { type RailRow } from './DayRail'
import Legend from './Legend'

function formatHour(hour: number): string {
  const wrapped = hour >= 24 ? hour - 24 : hour
  const h = Math.floor(wrapped)
  const m = Math.round((wrapped - h) * 60)
  return `${h}:${String(m === 60 ? 0 : m).padStart(2, '0')}`
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

interface Section {
  key: string
  label: string
  body: React.ReactNode
}

/**
 * The anchor's finding, drawn the same way whether it stands alone or rides inside «Порядок дня».
 *
 * The sentence and the comparison are separate claims with separate evidence. Which task opens the
 * day is read off every shared day there is; what happens when it is missed is read off the days it
 * was missed, and someone who almost never misses it has two or three of those. The bars appear
 * only once both sides carry their weight — otherwise the block keeps the sentence and says nothing
 * it cannot back, rather than drawing «0%» across a full-width bar on the strength of two days.
 */
function renderAnchor(anchor: AnchorTask, title: string) {
  const comparable =
    anchor.daysDone >= COMPARE_MIN_DAYS &&
    anchor.daysNotDone >= COMPARE_MIN_DAYS &&
    anchor.restRateWhenDone - anchor.restRateWhenNot > LINK_NOTICEABLE_GAP

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[14px] leading-snug text-text-primary">
        {`Чаще всего день открывает «${title}» — в ${Math.round(anchor.firstShare * 100)}% дней.`}
      </p>
      {comparable && (
        <CompareBars
          rows={[
            { caption: `${title} — сделана`, rate: anchor.restRateWhenDone, days: anchor.daysDone },
            { caption: `${title} — не сделана`, rate: anchor.restRateWhenNot, days: anchor.daysNotDone },
          ]}
          footnote="Доля остальных дел дня."
        />
      )}
    </div>
  )
}

/**
 * What the times of day add up to. Every line here is descriptive — none of it feeds the road, the
 * colour of a day or a milestone. The app judges whether a day was done, never when: a second bar
 * for being late would be the dark twin this one deliberately does without.
 */
export default function TimeOfDayCard({ days, goals }: { days: Day[]; goals: Goal[] }) {
  const titleById = useMemo(() => {
    const map = new Map<string, string>()
    for (const goal of goals) for (const task of goal.tasks) map.set(task.id, task.title)
    return map
  }, [goals])

  const { sections, marksSoFar, style } = useMemo(() => {
    const marks = buildMarks(days)
    const style = markingStyle(days)
    const timed = marks.filter((m) => m.hour !== null).length
    const sections: Section[] = []
    const taskIds = [...titleById.keys()]

    const drifts = new Map(
      taskIds.map((id) => [id, timeDrift(marks, id)] as const).filter(([, d]) => d !== null),
    )

    const rows: RailRow[] = []
    for (const taskId of taskIds) {
      const window = habitWindow(marks, taskId)
      if (!window) continue
      const drift = drifts.get(taskId)
      const drifted = drift && Math.abs(drift.hoursPerWeek) >= DRIFT_NOTICEABLE_HOURS
      rows.push({
        taskId,
        title: titleById.get(taskId) ?? '',
        window,
        point: pointOfNoReturn(marks, taskId),
        wasMedian: drifted ? drift.weeks[0].median : null,
      })
    }

    // The order everything was marked in, for the case where the clock cannot be trusted but the
    // sequence still can.
    const meanOrder = new Map<string, { sum: number; n: number }>()
    for (const mark of marks) {
      if (mark.order === null || mark.askedThatDay < 2) continue
      const acc = meanOrder.get(mark.taskId) ?? { sum: 0, n: 0 }
      acc.sum += mark.order
      acc.n += 1
      meanOrder.set(mark.taskId, acc)
    }
    const order = [...meanOrder.entries()]
      .sort((a, b) => a[1].sum / a[1].n - b[1].sum / b[1].n)
      .map(([id]) => titleById.get(id) ?? '')

    if (rows.length > 0 && !style.batched) {
      sections.push({
        key: 'rail',
        label: 'Когда это происходит',
        body: (
          <div className="flex flex-col gap-3">
            <DayRail rows={rows} />
            <Legend
              hasPoint={rows.some((r) => r.point !== null)}
              hasGhost={rows.some((r) => r.wasMedian !== null)}
            />
          </div>
        ),
      })
    }

    const drifting = [...drifts.entries()].filter(
      ([, d]) => d !== null && Math.abs(d.hoursPerWeek) >= DRIFT_NOTICEABLE_HOURS,
    )
    if (drifting.length > 0 && !style.batched) {
      sections.push({
        key: 'drift',
        label: 'Сдвигается',
        body: (
          <div className="flex flex-col gap-1">
            {drifting.map(([taskId, drift]) => (
              <p key={taskId} className="text-[14px] leading-snug text-text-primary">
                {`«${titleById.get(taskId)}» уходит ${drift!.hoursPerWeek > 0 ? 'позже' : 'раньше'} на ${formatSpan(Math.abs(drift!.hoursPerWeek))} в неделю — с ${formatHour(drift!.weeks[0].median)} до ${formatHour(drift!.weeks[drift!.weeks.length - 1].median)}.`}
              </p>
            ))}
            <p className="text-[12px] text-text-muted">
              Привычка обычно сползает по времени раньше, чем начинает срываться.
            </p>
          </div>
        ),
      })
    }

    const anchor = anchorTask(days)
    const anchorBody = anchor ? renderAnchor(anchor, titleById.get(anchor.taskId) ?? '') : null

    if (style.batched) {
      // Marked all at once: the clock describes the filling-in, so the day's axis would be a
      // confident drawing of nothing. The order is still real, and the anchor is read from the
      // order — so it belongs in this same block rather than under a second heading saying the
      // same thing a different way.
      sections.push({
        key: 'order',
        label: 'Порядок дня',
        body: (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {order.map((title, i) => (
                <span key={title} className="inline-flex items-center gap-1.5">
                  {i > 0 && <span className="text-[13px] text-text-muted">→</span>}
                  <span
                    className="rounded-full px-2.5 py-1 text-[13px] text-text-primary"
                    style={{ backgroundColor: 'var(--color-surface-raised)' }}
                  >
                    {title}
                  </span>
                </span>
              ))}
            </div>
            <p className="text-[12px] text-text-muted">
              Отметки ложатся в одну минуту — в {style.batchedDays} из {style.multiMarkDays} дней. Часы
              тогда показывают, когда ты заполняешь приложение, а порядок — настоящий.
            </p>
            {anchorBody}
          </div>
        ),
      })
    } else if (anchorBody) {
      sections.push({ key: 'anchor', label: 'С чего начинается день', body: anchorBody })
    }

    // Suppressed for the same reason as the rail: an early/late split is a reading of the clock,
    // and the block has just said the clock is measuring the filling-in. Showing it anyway would
    // let the card contradict its own caveat two lines later.
    const link = style.batched ? null : earlyStartLink(days)
    if (link && link.earlyRestRate - link.lateRestRate > LINK_NOTICEABLE_GAP) {
      sections.push({
        key: 'early',
        label: 'Ранний старт',
        body: (
          <CompareBars
            rows={[
              { caption: `до ${formatHour(link.splitHour)}`, rate: link.earlyRestRate, days: link.earlyDays },
              { caption: `после ${formatHour(link.splitHour)}`, rate: link.lateRestRate, days: link.lateDays },
            ]}
            footnote="Доля остальных дел дня. Это совпадение, а не причина: ранние дни могли быть просто удачными."
          />
        ),
      })
    }

    return { sections, marksSoFar: timed, style }
  }, [days, titleById])

  if (sections.length === 0 && !style.batched) {
    return (
      <div className="sk-card">
        <p className="text-[13px] text-text-muted">
          {marksSoFar < TIME_MIN_MARKS
            ? `Время отметок копится — пока их ${marksSoFar} из ${TIME_MIN_MARKS}. Дальше здесь появится, когда ты обычно берёшься за дело и после какого часа уже не берёшься.`
            : 'Пока в отметках не видно закономерности по времени — ни устойчивого часа, ни сдвига.'}
        </p>
      </div>
    )
  }

  return (
    <div className="sk-card flex flex-col gap-5">
      {sections.map((section) => (
        <div key={section.key} className="flex flex-col gap-2">
          <span className="sk-eyebrow">{section.label}</span>
          {section.body}
        </div>
      ))}
    </div>
  )
}
