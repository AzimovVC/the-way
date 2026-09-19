import type { CircleRowState } from '../../social/circles'
import type { Person } from '../../social/types'
import Avatar from '../Avatar'
import Icon from '../Icon'

interface CircleMateProps {
  partner: Person
  state: CircleRowState
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
 * Подпись — «Лена: отмечено», а не «Лена отметилась»: глагол в русском выдаёт род, а его человек
 * здесь нигде не называл. Имя он написал сам, какое захотел, включая «kate» и «Мама».
 */
export default function CircleMate({ partner, state }: CircleMateProps) {
  const done = state === 'both' || state === 'them'

  return (
    <span
      className="relative flex shrink-0 items-center pr-3"
      aria-label={`${partner.name}: ${done ? 'отмечено' : 'пока нет'}`}
      title={`${partner.name}: ${done ? 'отмечено' : 'пока нет'}`}
    >
      <Avatar name={partner.name} size={28} className={done ? undefined : 'opacity-45'} />
      {done && (
        <span
          className="absolute bottom-0 right-2 grid size-[15px] place-items-center rounded-full"
          style={{ backgroundColor: 'var(--color-day-gold)', boxShadow: '0 0 0 2px var(--color-surface-raised)' }}
          aria-hidden
        >
          <Icon name="check" size={10} color="var(--color-text-on-brand)" />
        </span>
      )}
    </span>
  )
}
