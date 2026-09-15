import { useMemo, useState } from 'react'
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
 *
 * Nothing here can be forced from outside — no query string, no dev hook. A screen that can be
 * summoned is a screen whose conditions never get tested. The DevPanel renders the two components
 * itself when they need looking at.
 */
export default function ReviewGate() {
  const { state, pendingDayReviewId, dismissDayReview } = useAppState()
  const [weekSeen, setWeekSeen] = useState(readWeekReviewSeen)

  const dayReview = useMemo(
    () => (pendingDayReviewId ? reviewDay(state.days, pendingDayReviewId) : null),
    [state.days, pendingDayReviewId],
  )

  const today = state.days[state.days.length - 1]?.date
  const weekStart = today ? lastCompleteWeekStart(today) : null
  const weekReview = useMemo(
    () => (weekStart && weekSeen !== weekStart ? reviewWeek(state.days, weekStart) : null),
    [state.days, weekStart, weekSeen],
  )

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
