import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { feedAge } from '../../domain/feed'
import { getLogicalToday } from '../../domain/pathEngine'
import { isVideoUrl, type Message } from '../../social/messages'
import Avatar from '../Avatar'
import Icon from '../Icon'

interface Props {
  messages: Message[]
  /** Close, handing back which ones were seen — those are dropped, the rest keep waiting. */
  onClose: (seen: string[]) => void
  /** Answer the sender with a GIF of your own: the picker opens with them already chosen. */
  onReply: (personId: string) => void
}

/**
 * The GIFs by today's circle, opened.
 *
 * One at a time, oldest first — read in the order they were sent, the way letters are. A grid of
 * them would turn a friend's hello into a gallery to scan, and the point of each one is the single
 * moment it plays.
 *
 * A GIF is dropped once it has been **seen**, not once the sheet opened: closing on the first of
 * three leaves the other two by the road. Seen means shown on this sheet, and that is the only
 * "read" state there is — the row existing is what "unread" means, as with notices.
 */
export default function GifInbox({ messages, onClose, onReply }: Props) {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  // Kept in a ref as well as rendered: closing reads it, and a close that raced a step would
  // otherwise drop one GIF fewer than the person saw.
  const seen = useRef(new Set<string>())
  // Read once, when the sheet opens: the age under a GIF is not a clock, and a label that ticked
  // while the person watched would be the one moving thing on a sheet about a GIF.
  const [now] = useState(() => Date.now())
  const current = messages[Math.min(index, messages.length - 1)]

  useEffect(() => {
    if (current) seen.current.add(current.id)
  }, [current])

  if (!current) return null

  const close = () => onClose([...seen.current])
  const last = index >= messages.length - 1
  const age = feedAge(getLogicalToday(new Date(current.sentAt)), getLogicalToday(new Date(now)), current.sentAt, now)
  const name = current.from.name.trim() || `@${current.from.handle}`

  return (
    <div role="dialog" aria-modal="true" aria-label="Гифки от друзей" className="absolute inset-0 z-40 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Закрыть"
        onClick={close}
        className="absolute inset-0"
        style={{ backgroundColor: 'var(--scrim)' }}
      />
      <div className="sk-rise relative flex flex-col gap-4 rounded-t-[24px] bg-bg px-4 pt-4 pb-8">
        <div className="flex items-center gap-3">
          {/* The person leads to their profile — the same gesture as everywhere a friend appears,
              and the way to block or report if a GIF was not a friendly one. */}
          <button
            type="button"
            onClick={() => {
              close()
              navigate(`/u/${current.from.handle}`)
            }}
            className="sk-press sk-focus flex min-w-0 flex-1 items-center gap-3 rounded-[12px] text-left"
          >
            <Avatar name={name} size={40} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[16px] font-semibold text-text-primary">{name}</span>
              <span className="text-[13px] text-text-muted">{age}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Закрыть"
            className="sk-press sk-focus flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          >
            <Icon name="x" size={22} color="var(--color-text-secondary)" />
          </button>
        </div>

        {/* The box holds the GIF's own shape before a byte of it has arrived, so nothing jumps when
            it does. Capped in height: a tall GIF would otherwise push the buttons off the phone. */}
        <div
          className="mx-auto w-full overflow-hidden rounded-[20px]"
          style={{
            aspectRatio: `${current.gif.width} / ${current.gif.height}`,
            maxHeight: '48vh',
            maxWidth: `calc(48vh * ${current.gif.width / current.gif.height})`,
            backgroundColor: 'var(--violet-800)',
            border: '3px solid var(--violet-500)',
          }}
        >
          {isVideoUrl(current.gif.full) ? (
            <video
              key={current.id}
              src={current.gif.full}
              poster={current.gif.preview}
              autoPlay
              loop
              muted
              playsInline
              className="h-full w-full object-cover"
            />
          ) : (
            <img key={current.id} src={current.gif.full} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <span className="-mt-2 text-center text-[11px] text-text-muted">via KLIPY</span>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              close()
              onReply(current.from.id)
            }}
            className="sk-btn sk-btn-outline sk-press sk-focus flex-1"
          >
            Ответить
          </button>
          <button
            type="button"
            onClick={() => (last ? close() : setIndex(index + 1))}
            className="sk-btn sk-btn-primary sk-plinth sk-focus flex-1"
          >
            {last ? 'Готово' : 'Дальше'}
          </button>
        </div>
      </div>
    </div>
  )
}
