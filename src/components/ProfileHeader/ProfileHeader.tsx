import { Link } from 'react-router-dom'
import Icon from '../Icon'
import { formatLongDate } from '../../domain/calendar'

interface ProfileHeaderProps {
  name: string
  /** `@ник` без собачки — своё она рисует сама. */
  handle: string
  /** First day the road holds, or null before there is one. */
  startDate: string | null
  today: string
  daysOnRoad: number
  habitCount: number
  /** Сколько друзей, или null — пока слой ещё спрашивает ту сторону. */
  friendCount: number | null
}

/**
 * The person, as a banner rather than a form. It runs to the frame's edges because it is the top
 * of the screen and not a card on it, and it is violet because violet is the profile's colour in
 * the tab bar — a screen whose header disagreed with the tab that opened it would read as a
 * different place.
 *
 * Под именем — ник, потому что это два ответа на один вопрос, и разница между ними в том, кто
 * спрашивает: имя человек пишет для себя, ник дают чужим.
 */
export default function ProfileHeader({
  name,
  handle,
  startDate,
  daysOnRoad,
  habitCount,
  friendCount,
}: ProfileHeaderProps) {
  return (
    <header className="flex flex-col">
      <div
        className="flex flex-col items-center gap-5 px-4 pb-7 pt-5"
        style={{ backgroundColor: 'var(--violet-700)' }}
      >
        <div className="flex w-full items-center justify-between gap-3">
          <h1 className="sk-heading min-w-0 flex-1 truncate text-[28px] text-text-primary">
            {name.trim() || 'Без имени'}
          </h1>
          <Link
            to="/profile/settings"
            aria-label="Настройки"
            className="sk-press sk-focus -mr-1 shrink-0 rounded-[16px] p-1"
          >
            <Icon name="settings" size={26} color="var(--ink-100)" />
          </Link>
        </div>

        {/* A circle kept empty on purpose: this is where the picture goes, and the picture this app
            wants is a crop of the person's own road, which is the path renderer's job and not this
            screen's. Until then, the glyph stands in it. */}
        <div
          className="flex size-[132px] items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--violet-800)', boxShadow: 'inset 0 0 0 3px var(--violet-600)' }}
          aria-hidden
        >
          <Icon name="user" size={64} color="var(--violet-500)" />
        </div>
      </div>

      {/* Ник и дата одной строкой, под баннером, а не в нём: в баннере он спорил бы с именем за
          то же место, а здесь это одна короткая справка — как тебя звать чужим и с какого дня ты
          тут. Дата без числа дней: сколько идёт — уже стоит в ряду ниже. */}
      <p className="sk-eyebrow px-4 pt-5">
        @{handle}
        {startDate !== null && ` · в пути с ${formatLongDate(startDate)}`}
      </p>

      {/* Ряд про то, кто это: сколько людей рядом, чем занят, как давно идёт. Числа записи —
          серия, золотые дни, заморозки — стоят ниже, в «Обзоре», и ни одно из них здесь не
          повторяется: то же число дважды на одном экране читается как два разных факта. */}
      <div className="flex items-start gap-7 px-4 pt-4">
        <Count to="/profile/friends" value={friendCount} label="друзья" />
        <Count value={habitCount} label="привычки" />
        <Count value={daysOnRoad} label="дней в пути" />
      </div>

      {/* Кнопка во всю ширину, обведённая, а не залитая: залитая читалась бы как главное действие
          экрана, а главное здесь — сам человек и его запись. Она ведёт туда же, куда счётчик
          друзей, но отвечает на другой вопрос: тот — «кто у меня есть», эта — «позвать ещё». */}
      <div className="px-4 pt-4">
        {/* Плинт цветом рамки: обведённая кнопка на цветном плинте читалась бы как две рамки, а на
            своей собственной — просто утолщается снизу и жмётся, как все кнопки в системе. */}
        <Link
          to="/profile/friends/add"
          style={{ minHeight: 48, fontSize: 17, ['--plinth-color' as string]: 'var(--color-border)' }}
          className="sk-btn sk-btn-outline sk-btn-block sk-plinth sk-focus"
        >
          <Icon name="user-plus" size={21} color="var(--color-text-primary)" />
          Добавить друзей
        </Link>
      </div>
    </header>
  )
}

/**
 * Одно число ряда. Нажимается только то, за чем правда есть экран: счётчик с шевроном, ведущий
 * в никуда, обещает страницу, которой нет.
 */
function Count({ value, label, to }: { value: number | null; label: string; to?: string }) {
  const body = (
    <>
      {/* Пока ответ не пришёл, стоит тире, а не ноль: ноль — это утверждение, что друзей нет. */}
      <span className="sk-num text-[20px] font-semibold leading-none text-text-primary">
        {value === null ? '—' : value}
      </span>
      <span className="text-[12px] leading-tight text-text-muted">{label}</span>
    </>
  )

  // Числа стоят у левого края, а не растянуты на треть экрана каждое: ряд читают слева направо
  // как строку, а расставленные по центрам своих третей числа читаются как три отдельные колонки.
  const shared = 'flex flex-col items-start gap-1 rounded-[14px] px-1 py-1 -mx-1'
  if (to === undefined) return <div className={shared}>{body}</div>
  return (
    <Link to={to} className={`${shared} sk-press sk-focus`}>
      {body}
    </Link>
  )
}
