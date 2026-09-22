import { useEffect } from 'react'
import { getLogicalToday } from '../../domain/pathEngine'
import { partnerDoneOn, partnerExcusedOn } from '../../social/circles'
import { useSocial } from '../../social/socialState'
import { useAppState } from '../../state/appState'

/**
 * Единственное место, где чужая отметка доходит до собственной дороги, — и доходит она **выводом**,
 * а не данными.
 *
 * Привычка, отмеченная «только вместе», закрывает свою строку не тапом, а парой тапов: твой уже
 * записан (`DayTask.pending`), и здесь ждут второй. Как только он есть, наружу из этого файла
 * уходит одно действие — «эту строку можно закрывать», — и ничего из `src/social/` в `AppState`
 * по-прежнему не попадает.
 *
 * Рисует он `null` нарочно: сказать об ожидании — работа карточки дня, которая и так рядом с
 * галочкой. Отдельного экрана у такой новости нет, потому что это не новость, а конец ожидания.
 *
 * Два правила, которые легко нарушить:
 *
 * - **за один проход одно действие.** `dispatch` пишет то состояние, которое видел этот рендер, и
 *   два вызова подряд означали бы, что второй затрёт первый. Эффект встаёт заново на каждое
 *   изменение состояния, поэтому очередь разбирается сама, по одной строке за кадр — тот же
 *   порядок, которым выдаются уровни;
 * - **освобождённый день считается ответом.** Она заморозилась — это «сегодня с меня не спросят»,
 *   а не «я не сделала», и держать твою строку открытой из-за её болезни значило бы наказать тебя
 *   её днём. То же правило, что в `pairVerdict`.
 */
export default function CircleWatch() {
  const { state, dispatch } = useAppState()
  const { circles } = useSocial()

  useEffect(() => {
    const today = getLogicalToday(new Date())
    const day = state.days.find((d) => d.date === today)
    const live = new Map(circles.circles.filter((c) => c.leftAt === undefined).map((c) => [c.taskId, c]))
    // Приглашения, на которые ещё не ответили. Привычка, позванная ими, режим уже носит — но
    // ждать ей пока некого, и это разные вещи.
    const invited = new Set(circles.outgoing.map((item) => item.taskId))

    for (const goal of state.user.goals) {
      if (goal.archived) continue
      for (const task of goal.tasks) {
        if (task.together !== true) continue

        const row = day?.tasks.find((t) => t.taskTemplateId === task.id)
        const circle = live.get(task.id)

        if (circle === undefined) {
          // Пары нет — ждать некого. Но «ещё не согласилась» и «уже ушла» здесь разные новости,
          // и разводит их отправленное приглашение.
          if (invited.has(task.id)) {
            // Согласия ещё нет. Режим человек выбрал и он останется выбранным — а день ждать
            // никого не должен: ожидание ответа от того, кто даже не сказал «да», это красный
            // день за чужое молчание, на которое никто не подписывался.
            if (row?.pending === true) {
              dispatch({ kind: 'settleTogether', dayId: day!.id, taskTemplateId: task.id })
              return
            }
            continue
          }
          // Ни пары, ни приглашения: привычка снова обычная. Выход не отбирает дни — застрявшая
          // отметка засчитывается там же, в действии.
          dispatch({ kind: 'stopWaiting', taskId: task.id })
          return
        }

        if (row?.pending !== true) continue
        if (!partnerDoneOn(circle, today) && !partnerExcusedOn(circle, today)) continue

        dispatch({ kind: 'settleTogether', dayId: day!.id, taskTemplateId: task.id })
        return
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dispatch is redefined every render
  }, [state, circles])

  return null
}
