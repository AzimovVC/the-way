import Icon, { type IconName } from '../Icon'

interface StatTileProps {
  icon: IconName
  /** The metric's own colour — fixed per metric by the tokens, never picked per screen. */
  color: string
  /** Число вместе со своим словом: «12 дней подряд». Склонение — забота того, кто зовёт. */
  text: string
}

/**
 * Одно число обзора: значок слева, фраза справа, и всё это одной строкой.
 *
 * Раньше здесь была карточка с числом покрупнее и подписью под ним. Разница не косметическая:
 * карточка — это предмет, который просят рассмотреть, а обзор просят **пробежать глазами**. Четыре
 * рамки на пол-экрана весили больше, чем то, что в них написано, а подпись под числом заставляла
 * читать в два приёма — сперва «26», потом «золотых дней». Строка «26 золотых дней» читается разом
 * и говорит то же самое.
 *
 * Отсюда и `text` вместо пары «число + подпись»: слово при числе склоняется («1 заморозка»,
 * «2 заморозки»), а склонять подпись, оторванную от числа, нечем.
 */
export default function StatTile({ icon, color, text }: StatTileProps) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon name={icon} size={22} color={color} />
      <span className="sk-num text-[16px] font-semibold text-text-primary">{text}</span>
    </div>
  )
}
