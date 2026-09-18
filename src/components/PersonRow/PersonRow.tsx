import Icon from '../Icon'
import { formatHandle } from '../../domain/handle'
import type { FriendState, Person } from '../../social/types'
import { useSocial } from '../../social/socialState'

interface PersonRowProps {
  person: Person
  state: FriendState
  /** Открыть чужой профиль. Пока его нет — строка просто не нажимается. */
  onOpen?: () => void
}

/**
 * Человек одной строкой: кружок, имя, ник и одно действие справа.
 *
 * Действие живёт **здесь**, а не на экранах: «позвать», «принять», «отменить» одинаковы в поиске,
 * в предложениях и в списке заявок, и три копии этой кнопки разошлись бы на первой же правке.
 *
 * Чего в строке нет — кнопки «убрать из друзей». Убирают с чужого профиля, в два тапа: дружба
 * складывалась вдвоём, и снять её промахом по списку нельзя.
 */
export default function PersonRow({ person, state, onOpen }: PersonRowProps) {
  const { busy, request, cancel, accept, decline } = useSocial()
  const waiting = busy.has(person.id)

  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-border p-3" style={{ backgroundColor: 'var(--color-surface-raised)' }}>
      <button
        type="button"
        onClick={onOpen}
        disabled={onOpen === undefined}
        className="sk-focus flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        {/* Фотографий нет, поэтому кружок несёт букву. Он фиолетовый — тем же цветом, что профиль
            в таббаре: фиолетовый в этом приложении значит «человек», и второго смысла у него нет.
            Цвета дня и ступени сюда не заходят — они заняты тем, как идут дела. */}
        <span
          className="grid size-11 shrink-0 place-items-center rounded-full text-[18px] font-bold"
          style={{ backgroundColor: 'var(--violet-800)', color: 'var(--violet-400)' }}
          aria-hidden
        >
          {person.name.trim().slice(0, 1).toUpperCase() || '?'}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold text-text-primary">{person.name}</span>
          <span className="truncate text-[13px] text-text-muted">{formatHandle(person.handle)}</span>
        </span>
      </button>

      <span className="flex shrink-0 items-center gap-2">
        {state === 'none' && (
          <button
            type="button"
            onClick={() => void request(person.id)}
            disabled={waiting}
            className="sk-btn sk-btn-primary sk-btn-sm sk-plinth sk-press sk-focus"
          >
            Позвать
          </button>
        )}

        {state === 'outgoing' && (
          <button
            type="button"
            onClick={() => void cancel(person.id)}
            disabled={waiting}
            className="sk-btn sk-btn-outline sk-btn-sm sk-press sk-focus"
          >
            Отменить
          </button>
        )}

        {state === 'incoming' && (
          <>
            <button
              type="button"
              onClick={() => void accept(person.id)}
              disabled={waiting}
              className="sk-btn sk-btn-primary sk-btn-sm sk-plinth sk-press sk-focus"
            >
              Принять
            </button>
            <button
              type="button"
              onClick={() => void decline(person.id)}
              disabled={waiting}
              aria-label="Отклонить"
              className="sk-press sk-focus rounded-[14px] p-2"
            >
              <Icon name="x" size={18} color="var(--color-text-muted)" />
            </button>
          </>
        )}

        {state === 'friends' && <Icon name="users" size={20} color="var(--color-text-muted)" />}
      </span>
    </div>
  )
}
