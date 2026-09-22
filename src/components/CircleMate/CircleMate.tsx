import type { CircleRowState } from '../../social/circles'
import type { Person } from '../../social/types'
import Avatar from '../Avatar'
import Icon from '../Icon'

interface CircleMateProps {
  partner: Person
  state: CircleRowState
  /** Она освободила этот день заморозкой. С отметкой не совпадает: строка одна на день. */
  excused?: boolean
}

/**
 * Её половина строки кружка: кружок с буквой и галочка на нём, когда она отметилась.
 *
 * Стоит **справа от названия, отдельной вещью**, а не второй клеткой слева от него. Слева живёт
 * твоя галочка — то, что ты нажимаешь, — и вторая клетка рядом читалась бы как «два из двух»,
 * то есть как счётчик внутри задачи. `isDone` двоичное, и «наполовину выполненной» задачи здесь
 * не заводится: твоя строка закрыта тогда, когда закрыл её ты.
 *
 * Не отметилась — круг просто тише. Ни креста, ни минуса: «ещё не отметилась» и «не сделала» —
 * разные новости, а до конца дня правда всегда первая. Приложение, натравливающее одного человека
 * на другого, начинается ровно с этого знака.
 *
 * **Заморозилась — луна.** Это третье состояние, а не оттенок второго: «ещё не отметилась» до конца
 * дня может стать галочкой, а освобождённый день уже никогда — он честно закрыт, и общий счёт идёт
 * дальше именно поэтому. Одинаковый тихий круг на оба случая оставлял бы человека гадать, почему
 * «вместе N дней» не порвалось, — то есть прятал бы причину там, где она и есть весь ответ.
 *
 * Знак — та же луна и тот же `--color-freeze`, что у заморозки везде. Второй знак для того же
 * смысла стоил бы дороже любой картинки, а этот человек уже знает: он видел его на своём дне.
 *
 * Подпись — «Лена: отмечено», а не «Лена отметилась»: глагол в русском выдаёт род, а его человек
 * здесь нигде не называл. Имя он написал сам, какое захотел, включая «kate» и «Мама».
 */
export default function CircleMate({ partner, state, excused = false }: CircleMateProps) {
  const done = state === 'both' || state === 'them'
  // Подпись без глагола: он в русском выдаёт род, а его человек здесь нигде не называл.
  // «Заморозка» — существительное, и поэтому годится там, где «заморозилась» не годится.
  const said = done ? 'отмечено' : excused ? 'заморозка' : 'пока нет'
  const marked = done || excused

  return (
    <span
      className="relative flex shrink-0 items-center pr-3"
      aria-label={`${partner.name}: ${said}`}
      title={`${partner.name}: ${said}`}
    >
      <Avatar name={partner.name} size={28} className={marked ? undefined : 'opacity-45'} />
      {marked && (
        <span
          className="absolute bottom-0 right-2 grid size-[15px] place-items-center rounded-full"
          style={{
            backgroundColor: done ? 'var(--color-day-gold)' : 'var(--color-freeze)',
            boxShadow: '0 0 0 2px var(--color-surface-raised)',
          }}
          aria-hidden
        >
          <Icon
            name={done ? 'check' : 'moon'}
            size={10}
            color={done ? 'var(--color-text-on-brand)' : 'var(--color-text-primary)'}
          />
        </span>
      )}
    </span>
  )
}
