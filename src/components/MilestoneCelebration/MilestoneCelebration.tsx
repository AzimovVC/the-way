import Icon from '../Icon'
import { dayWord, formatShortDate, timesWord } from '../../domain/calendar'
import { rankAfter, rankLabel, rankMeaning } from '../../domain/ranks'
import { RANK_COLOR, RANK_PLINTH } from '../rankColor'
import { type CelebrationInfo } from '../../state/appState'

/**
 * The moment a habit stops to say how far it has set — a rung of the ladder every habit shares.
 *
 * One button, because there is nothing to decide: the road goes on. This screen used to carry a
 * second kind of moment, the finish the person was given when they picked a difficulty, and with
 * it the question «дальше или хватит» and a «Завершить привычку» button. Both are gone. The app
 * does not ask a person whether they are done with their own habit — that door is the quiet
 * «Завершить» on the habits tab, which never speaks first.
 */
export default function MilestoneCelebration({ celebration, onClose }: { celebration: CelebrationInfo; onClose: () => void }) {
  const { report, rank } = celebration
  const color = RANK_COLOR[rank.id]
  const plinth = RANK_PLINTH[rank.id]
  const toGo = Math.max(0, report.nextRankDays - report.daysWalked)

  return (
    <div className="sk-scrim fixed inset-0 z-40 flex items-center justify-center px-4">
      <div className="sk-dialog flex w-full max-w-sm flex-col gap-4 p-6 text-center">
        <div
          className="mx-auto grid size-[76px] place-items-center rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 6px 0 ${plinth}` }}
        >
          <Icon name="award" size={38} color="var(--ink-950)" />
        </div>

        {/* The eyebrow carries what happened, the big line carries the name. One line reading
            «Цель пройдена — Пробежка 3 км» broke across the dash on a phone and left «км» alone on
            its own row; split in two it also puts the habit's name where the eye lands first. */}
        <p className="sk-eyebrow">{rankLabel(rank)}</p>
        <h2 className="sk-heading text-[22px] text-text-primary">{celebration.taskTitle}</h2>
        <p className="text-[15px] text-text-secondary">{report.message}</p>

        {/* What the rung means, in the same light line the card uses. This is the screen where a
            person asks what they just learned about themselves, and «66 дней» alone does not
            answer it. Only on a level: the finish is the person's own number, and telling them
            what their number means would be the app knowing better. */}
        <p className="text-[13px] text-text-muted">{rankMeaning(rank)}</p>

        {/* Said once, above the numbers: the day count runs from the first day of the habit and
            never restarts, so these count the whole way here. */}
        <p className="sk-eyebrow">
          Всё время · {formatShortDate(report.cycleStartDate)} — {formatShortDate(report.cycleEndDate)}
        </p>

        {/* Three numbers, each said the way a person would say it, and the unit in the value so the
            pair reads as a sentence: «Пропустил 7 дней».
        
            It was six, in report Russian — «Средняя выполняемость», «Среднее восстановление»,
            «Заморозок использовано» — at the happiest moment the app has. Three of them are gone
            and none of them is missed. «Дней пройдено» is the number the sentence above already
            says. «Средняя выполняемость» is a description that needs «в дни, когда спрашивали»
            standing beside it, which does not fit in a tile and lives on the habit's own row where
            it does. And «Среднее восстановление» did not measure returning at all — it measured how
            long the run held between slips, so the label was answering a question nobody asked. */}
        <dl className="grid grid-cols-3 gap-3 text-left text-[12px] text-text-muted">
          <div>
            <dt>Пропустил</dt>
            <dd className="text-[17px] text-text-primary">
              <span className="sk-num font-bold">{report.missedDays}</span> {dayWord(report.missedDays)}
            </dd>
          </div>
          <div>
            {/* The comebacks, not the slips: they are the same count, and this app has no reason to
                name it after the worse half. */}
            <dt>Возвращался</dt>
            <dd className="text-[17px] text-text-primary">
              <span className="sk-num font-bold">{report.missStreakCount}</span> {timesWord(report.missStreakCount)}
            </dd>
          </div>
          <div>
            <dt>Заморозки</dt>
            <dd className="text-[17px] text-text-primary">
              <span className="sk-num font-bold">{report.freezesUsed}</span>
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 pt-2">
          <button type="button" onClick={onClose} className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus">
            Дальше
          </button>
          {/* What the next rung costs, said before the tap rather than discovered on the card
              afterwards. The days already walked count toward it — the day count never restarts —
              so this is the remainder, not the whole next level. */}
          <p className="text-[12px] text-text-muted">
            Дальше «{rankLabel(rankAfter(report.nextRankDays - 1))}», ещё <span className="sk-num">{toGo}</span>{' '}
            {dayWord(toGo)}
          </p>
        </div>
      </div>
    </div>
  )
}
