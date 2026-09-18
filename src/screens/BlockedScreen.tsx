import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import PersonRow from '../components/PersonRow'
import { useSocial } from '../social/socialState'

/**
 * Заблокированные, своим экраном в настройках.
 *
 * Отдельно от друзей, и это не про порядок в меню. Блокировка значит «я больше его не вижу», а
 * полка, показывающая заблокированных вместе с друзьями, отменяла бы ровно то, о чём её просили:
 * человек, которого убрали с глаз, встречал бы тебя при каждом открытии списка. Настройки — место,
 * куда приходят нарочно, и прийти сюда можно только специально.
 *
 * Без этого экрана разблокировать можно было только по нику: заблокированный пропадает из поиска,
 * а его профиль открывается лишь тому, кто помнит адрес наизусть. Блокировка, которую нельзя снять,
 * — это не решение, а ловушка, и хуже всего она для того, кто нажал сгоряча.
 */
export default function BlockedScreen() {
  const { view, loading } = useSocial()

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Link
            to="/profile/settings"
            aria-label="Назад в настройки"
            className="sk-press sk-focus -ml-2 rounded-[16px] p-2"
          >
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </Link>
          <h1 className="sk-heading text-[32px] text-text-primary">Заблокированные</h1>
        </div>

        {loading ? (
          <p className="text-[13px] text-text-muted">Загружаю…</p>
        ) : view.blocked.length === 0 ? (
          <p className="text-[13px] text-text-muted">
            Здесь пусто. Заблокированный не находит тебя в поиске и не может прислать заявку.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              {view.blocked.map((person) => (
                <PersonRow key={person.id} person={person} state="blocked" />
              ))}
            </div>
            {/* Сказано заранее, а не после нажатия: человек, ждавший, что снятая блокировка вернёт
                ему друга, узнал бы правду в тот момент, когда уже ничего не выбирает. */}
            <p className="text-[12px] text-text-muted">
              Разблокировка возвращает человека в «никто», а не в друзья: дружбу складывали вдвоём,
              и позвать придётся заново.
            </p>
          </>
        )}
      </div>
    </AppShell>
  )
}
