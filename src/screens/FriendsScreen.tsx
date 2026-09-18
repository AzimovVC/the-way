import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import PersonRow from '../components/PersonRow'
import { useSocial } from '../social/socialState'
import type { Person } from '../social/types'

/**
 * Друзья и заявки.
 *
 * Пришедшие заявки стоят **сверху**: это единственное на экране, что ждёт ответа, а список друзей
 * ничего не просит. Отправленные — внизу и тихо: они тоже ждут, но не тебя.
 *
 * Чужих чисел на этом экране нет — ни серий, ни дней. Список друзей отвечает на «кто здесь», а не
 * «кто лучше»; строка «31 день подряд» рядом с чужим именем превращает его в место в таблице, а
 * рейтингов в этом приложении нет и не будет. Числа друга живут на его собственном профиле, где
 * они — рассказ о нём, а не сравнение с тобой.
 */
export default function FriendsScreen() {
  const { view, loading, error, reload } = useSocial()
  const empty = view.friends.length === 0 && view.incoming.length === 0 && view.outgoing.length === 0

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Link to="/profile" aria-label="Назад в профиль" className="sk-press sk-focus -ml-2 rounded-[16px] p-2">
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </Link>
          <h1 className="sk-heading text-[32px] text-text-primary">Друзья</h1>
        </div>

        {error !== null && (
          <div className="flex items-center gap-3 rounded-[20px] border border-border p-3.5">
            <p className="flex-1 text-[13px]" style={{ color: 'var(--color-day-red)' }}>{error}</p>
            <button type="button" onClick={reload} className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus">
              Ещё раз
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-[13px] text-text-muted">Загружаю…</p>
        ) : (
          <>
            {view.incoming.length > 0 && (
              <Section title="Тебя зовут" people={view.incoming} state="incoming" />
            )}

            {view.friends.length > 0 && <Section title="Твои друзья" people={view.friends} state="friends" />}

            {view.outgoing.length > 0 && <Section title="Ты позвал" people={view.outgoing} state="outgoing" />}

            {empty && error === null && (
              <p className="text-[13px] text-text-muted">
                Пока никого. Друга находят по нику — его говорят вслух, как номер телефона.
              </p>
            )}
          </>
        )}

        {/* Оговорка стоит на экране, а не за тапом, — то же правило, что у метрик. Человек,
            отправивший заявку в пустоту и не знающий об этом, будет ждать ответа неделю. */}
        <p className="text-[12px] text-text-muted">
          Настоящих людей здесь пока нет: сеть ещё не подключена, и заявка никуда не уходит.
        </p>
      </div>
    </AppShell>
  )
}

function Section({ title, people, state }: { title: string; people: Person[]; state: 'incoming' | 'friends' | 'outgoing' }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <h2 className="sk-eyebrow flex-1">{title}</h2>
        <span className="sk-num text-[12px] text-text-muted">{people.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {people.map((person) => (
          <PersonRow key={person.id} person={person} state={state} />
        ))}
      </div>
    </section>
  )
}
