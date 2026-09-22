import type { Circle } from '../../social/circles'
import { pairLine, pairProgress } from '../../social/circles'
import type { Notice } from '../../social/notices'
import { noticeDay, noticeHeadline, noticeReassurance } from '../../social/notices'
import type { Day } from '../../domain/models'
import Avatar from '../Avatar'

interface CircleFarewellProps {
  notice: Notice
  /** Кружок, о котором сообщение. Его может уже не быть — тогда карточка идёт без чисел. */
  circle: Circle | undefined
  days: Day[]
  today: string
  onClose: () => void
}

/**
 * «Лена больше не в кружке».
 *
 * Карточка существует потому, что второй узнаёт о выходе **сообщением, а не пропажей**: молча
 * исчезнувшая вторая кнопка — худший способ сообщить такую новость (решение 3 в docs/circle.md).
 * Инбокса ради этого не заводится — сообщение приходит туда, где кружок и жил.
 *
 * Три вещи на ней, и порядок несущий:
 *
 * - **что случилось** — одной фразой и без глагола: глагол в русском выдаёт род, а его человек
 *   здесь нигде не называл;
 * - **что осталось** — «вместе 34 дня». Это не утешение, а запись: пара была, и она была вот
 *   такой длины. Считается число **здесь**, из твоих дней и уцелевших отметок, потому что своя
 *   половина читается из твоей дороги, а дороги на сервере нет;
 * - **что не отобрали** — привычка остаётся твоей со всеми днями. Человек, прочитавший первую
 *   строку, в первую секунду думает именно о том, что он потерял, и ответить на это надо раньше,
 *   чем он успеет спросить.
 *
 * Кнопка одна: решать нечего. Она же уносит запись о паре — до неё всё лежит на месте, иначе
 * числу выше было бы неоткуда взяться.
 */
export default function CircleFarewell({ notice, circle, days, today, onClose }: CircleFarewellProps) {
  const progress = circle === undefined ? null : pairProgress(circle, days, today)

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-border bg-surface-raised p-4">
      <div className="flex items-center gap-3">
        <Avatar name={notice.partnerName} size={40} className="opacity-45" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-text-primary">{noticeHeadline(notice)}</p>
          {/* Название и день одной строкой: две пары с одним названием иначе дают две
              неразличимые карточки, и человек читает вторую как дубль первой. */}
          <p className="truncate text-[12px] text-text-muted">
            «{notice.title}» · {noticeDay(notice)}
          </p>
        </div>
      </div>

      {/*
        Числа стоят, только когда их есть чем посчитать. Пары, не дожившей до первого общего дня,
        «вместе 0 дней» не говорят: ноль здесь рисуется как ничего, а не как «0», — то же правило,
        по которому на витрине нет пустых ячеек.
      */}
      {progress !== null && progress.together > 0 && (
        <p className="text-[13px] text-text-secondary">{pairLine(progress)}</p>
      )}

      <p className="text-[13px] text-text-secondary">{noticeReassurance(notice)}</p>

      <button
        type="button"
        onClick={onClose}
        className="h-11 rounded-[14px] bg-surface-sunken text-[15px] text-text-primary"
      >
        Понятно
      </button>
    </section>
  )
}
