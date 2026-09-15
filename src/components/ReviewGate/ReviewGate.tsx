import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Day } from '../../domain/models'
import { lastCompleteWeekStart, reviewDay, reviewWeek } from '../../domain/review'
import { markWeekReviewSeen, readWeekReviewSeen } from '../../storage/reviewSeen'
import { useAppState } from '../../state/appState'
import DayReviewScreen from '../DayReviewScreen'
import WeekReviewScreen from '../WeekReviewScreen'

/**
 * Decides which summary the road has earned the right to show, and shows at most one.
 *
 * The day comes first when both are due. It was closed a second ago by the person's own tap; the
 * week has been waiting since Monday and can wait one more screen.
 */
export default function ReviewGate() {
  const { state, pendingDayReviewId, dismissDayReview } = useAppState()
  const [searchParams] = useSearchParams()

  // Dev-only: ?review=day / ?review=week previews a screen against the real history, so the two
  // moments can be looked at without waiting for a Monday or for the last task of the day.
  const preview = import.meta.env.DEV ? searchParams.get('review') : null

  const [weekSeen, setWeekSeen] = useState(readWeekReviewSeen)

  const dayReview = useMemo(() => {
    const id = pendingDayReviewId ?? (preview === 'day' ? lastGoldDayId(state.days) : null)
    return id ? reviewDay(state.days, id) : null
  }, [state.days, pendingDayReviewId, preview])

  const today = state.days[state.days.length - 1]?.date
  const weekStart = today ? lastCompleteWeekStart(today) : null
  const weekReview = useMemo(() => {
    if (!weekStart) return null
    if (preview !== 'week' && weekSeen === weekStart) return null
    return reviewWeek(state.days, weekStart)
  }, [state.days, weekStart, weekSeen, preview])

  if (dayReview) return <DayReviewScreen review={dayReview} onClose={dismissDayReview} />

  if (weekReview && weekStart) {
    return (
      <WeekReviewScreen
        review={weekReview}
        onClose={() => {
          markWeekReviewSeen(weekStart)
          setWeekSeen(weekStart)
        }}
      />
    )
  }

  return null
}

/** Dev preview only: the most recent day that would have earned a screen. */
function lastGoldDayId(days: Day[]): string | null {
  return [...days].reverse().find((d) => d.colorTier === 'gold')?.id ?? null
}
