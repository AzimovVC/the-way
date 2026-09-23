import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { gifSearchConfigured, searchGifs } from '../../social/gifSearch'
import type { Gif } from '../../social/messages'
import type { Person } from '../../social/types'
import Avatar from '../Avatar'
import Icon from '../Icon'

interface Props {
  friends: Person[]
  /** Who is already chosen — the sender, when this opens as a reply. */
  initialRecipientId?: string
  onSend: (recipientId: string, gif: Gif) => Promise<boolean>
  onClose: () => void
}

/**
 * Send a friend a GIF.
 *
 * Who first, then what: the row of faces sits above the search, and a single friend is chosen
 * already — asking somebody with one friend "to whom?" is a question with one answer. One tap on a
 * GIF sends it. There is no text field and no confirm step: a GIF is a nudge, and a nudge that asks
 * "are you sure?" is a form.
 *
 * Search waits for a pause in typing before it asks, and pages come two dozen at a time: every tile
 * is a download, and the app is asked to be sparing with the phone.
 */
export default function GifPicker({ friends, initialRecipientId, onSend, onClose }: Props) {
  const navigate = useNavigate()
  const [recipientId, setRecipientId] = useState<string | null>(
    initialRecipientId ?? (friends.length === 1 ? friends[0].id : null),
  )
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [sending, setSending] = useState<{ id: string; state: 'going' | 'sent' | 'failed' } | null>(null)
  const sentinel = useRef<HTMLDivElement | null>(null)
  const pending = useRef<AbortController | null>(null)

  function load(q: string, pos: string | null) {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    setLoading(true)
    setFailed(false)
    searchGifs(q, pos, controller.signal)
      .then((page) => {
        setGifs((current) => (pos === null ? page.gifs : [...current, ...page.gifs]))
        setNext(page.next)
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setFailed(true)
      })
      .finally(() => {
        if (pending.current === controller) setLoading(false)
      })
  }

  // A new word starts a new list — after a pause, so "котик" is one request and not five.
  useEffect(() => {
    if (!gifSearchConfigured) return
    const timer = setTimeout(() => load(query, null), query === '' ? 0 : 350)
    return () => clearTimeout(timer)
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => () => pending.current?.abort(), [])

  // The next page is asked when the end of the grid comes into view, not by a button: the grid is
  // the thing being scrolled, and a button at its end is a stop in the middle of a gesture.
  useEffect(() => {
    const node = sentinel.current
    if (!node || next === null) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loading) load(query, next)
    })
    observer.observe(node)
    return () => observer.disconnect()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [next, loading, query])

  async function send(gif: Gif) {
    if (recipientId === null || sending?.state === 'going') return
    setSending({ id: gif.id, state: 'going' })
    const ok = await onSend(recipientId, gif)
    setSending({ id: gif.id, state: ok ? 'sent' : 'failed' })
    // A beat on the check before closing, so the person sees it went rather than the sheet simply
    // vanishing under their finger.
    if (ok) setTimeout(onClose, 600)
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Отправить гифку" className="sk-rise absolute inset-0 z-40 flex flex-col bg-bg">
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="sk-press sk-focus flex h-10 w-10 items-center justify-center rounded-full"
        >
          <Icon name="x" size={22} color="var(--color-text-secondary)" />
        </button>
        {/* The title does not carry the name: «для Лены» needs the name declined, and a name the
            app cannot decline is better left to the ring around the face below. */}
        <span className="sk-heading flex-1 pr-10 text-center text-[17px]">Гифка другу</span>
      </div>

      {friends.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-[16px] text-text-secondary">Гифки ходят только между друзьями. Сначала добавь друга.</p>
          <button
            type="button"
            onClick={() => {
              onClose()
              navigate('/profile/friends/add')
            }}
            className="sk-btn sk-btn-primary sk-plinth sk-focus"
          >
            Найти друга
          </button>
        </div>
      ) : (
        <>
          {/* The faces. Chosen wears the cobalt ring — the pair the app uses everywhere for "this
              one is selected". */}
          <div className="hide-scrollbar flex shrink-0 gap-3 overflow-x-auto px-4 pb-3">
            {friends.map((friend) => {
              const chosen = friend.id === recipientId
              const name = friend.name.trim() || `@${friend.handle}`
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => setRecipientId(friend.id)}
                  aria-pressed={chosen}
                  className="sk-press sk-focus flex w-16 shrink-0 flex-col items-center gap-1 rounded-[12px]"
                >
                  <span
                    className="rounded-full p-[3px]"
                    style={{ boxShadow: chosen ? 'inset 0 0 0 3px var(--cobalt-500)' : undefined }}
                  >
                    <Avatar name={name} size={44} />
                  </span>
                  <span
                    className="w-full truncate text-center text-[12px]"
                    style={{ color: chosen ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
                  >
                    {name}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="shrink-0 px-4 pb-3">
            <label
              className="flex items-center gap-2 rounded-[16px] border border-border px-3"
              style={{ backgroundColor: 'var(--color-surface-raised)' }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // KLIPY asks for its name in the search bar; this is where it goes.
                placeholder="Поиск в KLIPY"
                enterKeyHint="search"
                aria-label="Поиск гифок"
                className="sk-focus min-h-[48px] flex-1 rounded-[12px] bg-transparent text-[16px] text-text-primary placeholder:text-text-muted"
              />
              {query !== '' && (
                <button type="button" onClick={() => setQuery('')} aria-label="Стереть" className="sk-press p-1">
                  <Icon name="x" size={18} color="var(--color-text-muted)" />
                </button>
              )}
            </label>
            {recipientId === null && (
              <p className="pt-2 text-[13px] text-text-muted">Сначала выбери, кому отправить.</p>
            )}
          </div>

          <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-8">
            {!gifSearchConfigured ? (
              <p className="pt-8 text-center text-[15px] text-text-secondary">Поиск гифок пока выключен.</p>
            ) : failed && gifs.length === 0 ? (
              <p className="pt-8 text-center text-[15px] text-text-secondary">Не получилось найти гифки. Проверь связь.</p>
            ) : !loading && gifs.length === 0 ? (
              <p className="pt-8 text-center text-[15px] text-text-secondary">Ничего не нашлось. Попробуй другое слово.</p>
            ) : (
              // Two columns, each tile holding its GIF's own shape: the grid does not jump as the
              // pictures arrive, and nothing is cropped into a square it was not drawn for.
              <div className="columns-2 gap-2">
                {gifs.map((gif) => {
                  const state = sending?.id === gif.id ? sending.state : null
                  return (
                    <button
                      key={gif.id}
                      type="button"
                      onClick={() => void send(gif)}
                      disabled={recipientId === null}
                      aria-label="Отправить эту гифку"
                      className="sk-press sk-focus relative mb-2 block w-full overflow-hidden rounded-[12px] disabled:opacity-50"
                      style={{ aspectRatio: `${gif.width} / ${gif.height}`, backgroundColor: 'var(--color-surface-raised)' }}
                    >
                      <GifTile gif={gif} />
                      {state !== null && (
                        <span
                          className="absolute inset-0 grid place-items-center text-[14px] font-semibold"
                          style={{ backgroundColor: 'rgba(11,13,17,.6)', color: 'var(--color-text-primary)' }}
                        >
                          {state === 'going' ? '…' : state === 'sent' ? <Icon name="check" size={32} color="var(--color-day-green)" /> : 'Не ушло'}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
            <div ref={sentinel} className="h-8" />
            {loading && gifs.length > 0 && <p className="text-center text-[13px] text-text-muted">Ищу ещё…</p>}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * One tile of the grid. A small mp4 over a still jpg, and the clip is fetched and played **only
 * while the tile is on screen**: `preload="none"` until it scrolls in, paused when it scrolls out.
 * A grid of two dozen that all downloaded and played at once is what made the first version heavy;
 * this way a page costs the eight or so tiles a phone shows, not twenty-four.
 *
 * A GIF without a clip falls back to its animated preview, lazily loaded.
 */
function GifTile({ gif }: { gif: Gif }) {
  const video = useRef<HTMLVideoElement | null>(null)
  const [visible, setVisible] = useState(false)
  // Once fetched, kept: scrolling a tile out and back in should not download it twice.
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    const node = video.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting)
        if (entry.isIntersecting) setFetched(true)
      },
      { rootMargin: '100px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  // Played after the render that gave it a source — calling play() from the observer ran before
  // React had set `src`, and the first showing of every tile stayed still.
  useEffect(() => {
    const node = video.current
    if (!node) return
    if (!visible || !fetched) {
      node.pause()
      return
    }
    void node.play().catch(() => {
      // Autoplay refused (low-power mode on iOS): the still stays, and the GIF still sends.
    })
  }, [visible, fetched])

  if (gif.clip === undefined) {
    return <img src={gif.preview} alt="" loading="lazy" className="h-full w-full object-cover" />
  }
  return (
    <video
      ref={video}
      src={fetched ? gif.clip : undefined}
      poster={gif.poster}
      preload="none"
      loop
      muted
      playsInline
      className="h-full w-full object-cover"
    />
  )
}
