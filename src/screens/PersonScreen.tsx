import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import Icon from '../components/Icon'
import { dayWord, habitWord } from '../domain/calendar'
import type { Acquaintance } from '../social/client'
import { useSocial } from '../social/socialState'

/**
 * Чужой профиль — то, куда ведут строки списков и ссылка-приглашение.
 *
 * Показывается ровно то, что прислала та сторона. Решать, что чужому видно, а что нет, — работа
 * сервера: у нас нет ни его дней, ни права их спрашивать, и клиент, скрывающий поля по своему
 * усмотрению, делал бы вид, что защищает то, что ему уже отдали.
 *
 * Дороги здесь нет и не будет. Дорога — запись человека о себе, она читается вместе с карточками
 * дней и метками изменений, и чужой, листающий её, судил бы прожитую не им жизнь по картинке.
 * Числа — другое дело: они про него и рассказаны им самим.
 */
export default function PersonScreen() {
  const { handle = '' } = useParams()
  const navigate = useNavigate()
  const { client, view, busy, request, cancel, accept, decline, remove } = useSocial()

  const [found, setFound] = useState<Acquaintance | null | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)

  // Перечитывается вместе со связями: принявший заявку должен увидеть «вы друзья» здесь же, а не
  // после возвращения на список.
  useEffect(() => {
    let alive = true
    client
      .profile(handle)
      .then((result) => {
        if (alive) setFound(result)
      })
      .catch(() => {
        if (alive) setFound(null)
      })
    return () => {
      alive = false
    }
  }, [client, handle, view])

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Назад"
            className="sk-press sk-focus -ml-2 rounded-[16px] p-2"
          >
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </button>
        </div>

        {found === undefined && <p className="text-[13px] text-text-muted">Загружаю…</p>}

        {found === null && (
          <p className="text-[13px] text-text-muted">
            Никого с ником @{handle}. Ник набирается целиком — это не поиск по имени.
          </p>
        )}

        {found !== undefined && found !== null && (
          <>
            <header className="flex flex-col items-center gap-3">
              <span
                className="grid size-[112px] place-items-center rounded-full text-[44px] font-bold"
                style={{ backgroundColor: 'var(--violet-800)', color: 'var(--violet-400)' }}
                aria-hidden
              >
                {found.person.name.trim().slice(0, 1).toUpperCase() || '?'}
              </span>
              <div className="flex flex-col items-center gap-1">
                <h1 className="sk-heading text-[26px] text-text-primary">{found.person.name}</h1>
                <p className="sk-eyebrow">@{found.person.handle}</p>
                {/* Кто он тебе — сказано словом, а не одной лишь кнопкой внизу: «Убрать из
                    друзей» отвечает на это между делом, а вопрос задают первым. */}
                {found.state === 'friends' && (
                  <p className="text-[13px]" style={{ color: 'var(--color-brand)' }}>Вы друзья</p>
                )}
              </div>
            </header>

            {/* Числа стоят строками, как в своём «Обзоре», и ровно теми же словами: один и тот же
                факт, названный на двух экранах по-разному, читается как два разных. */}
            <div className="flex flex-col gap-3">
              {found.person.daysOnRoad !== undefined && (
                <Line
                  icon="flag"
                  color="var(--color-day-green)"
                  text={`${found.person.daysOnRoad} ${dayWord(found.person.daysOnRoad)} в пути`}
                />
              )}
              {found.person.currentStreak !== undefined && (
                <Line
                  icon="flame"
                  color="var(--color-streak-flame)"
                  text={`${found.person.currentStreak} ${dayWord(found.person.currentStreak)} подряд`}
                />
              )}
              {found.person.habitCount !== undefined && (
                <Line icon="list-checks" color="var(--color-brand)" text={`${found.person.habitCount} ${habitWord(found.person.habitCount)}`} />
              )}
            </div>

            <div className="flex flex-col gap-2">
              {found.state === 'none' && (
                <button
                  type="button"
                  onClick={() => void request(found.person.id)}
                  disabled={busy.has(found.person.id)}
                  className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus"
                >
                  Позвать в друзья
                </button>
              )}

              {found.state === 'outgoing' && (
                <>
                  <p className="text-center text-[13px] text-text-muted">Заявка отправлена</p>
                  <button
                    type="button"
                    onClick={() => void cancel(found.person.id)}
                    disabled={busy.has(found.person.id)}
                    className="sk-btn sk-btn-outline sk-btn-block sk-press sk-focus"
                  >
                    Отменить заявку
                  </button>
                </>
              )}

              {found.state === 'incoming' && (
                <>
                  <button
                    type="button"
                    onClick={() => void accept(found.person.id)}
                    disabled={busy.has(found.person.id)}
                    className="sk-btn sk-btn-primary sk-btn-block sk-plinth sk-focus"
                  >
                    Принять заявку
                  </button>
                  <button
                    type="button"
                    onClick={() => void decline(found.person.id)}
                    disabled={busy.has(found.person.id)}
                    className="sk-btn sk-btn-ghost sk-btn-block sk-press sk-focus"
                  >
                    Отклонить
                  </button>
                </>
              )}

              {/* Убирают из друзей только здесь и только в два шага. Дружбу складывали вдвоём, и
                  кнопка, снимающая её одним промахом по списку, слишком дёшево стоит. */}
              {found.state === 'friends' &&
                (confirming ? (
                  <>
                    <p className="text-center text-[13px] text-text-muted">Убрать {found.person.name} из друзей?</p>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirming(false)
                        void remove(found.person.id)
                      }}
                      disabled={busy.has(found.person.id)}
                      className="sk-btn sk-btn-danger sk-btn-block sk-plinth sk-focus"
                    >
                      Убрать
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="sk-btn sk-btn-ghost sk-btn-block sk-press sk-focus"
                    >
                      Оставить
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="sk-btn sk-btn-ghost sk-btn-block sk-press sk-focus"
                  >
                    Убрать из друзей
                  </button>
                ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}

function Line({ icon, color, text }: { icon: 'flag' | 'flame' | 'list-checks'; color: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon name={icon} size={22} color={color} />
      <span className="sk-num text-[16px] font-semibold text-text-primary">{text}</span>
    </div>
  )
}
