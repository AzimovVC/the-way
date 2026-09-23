import type { Person } from './types'

/**
 * What one friend sends another: for now a GIF, later voice and video notes (docs/ideas.md).
 *
 * One mechanism with a closed list of kinds — the same list as the `kind` check in migration 0013.
 * A new kind is a branch here and a line there, not a second table beside the first.
 *
 * Like everything in `src/social/`, a message **never enters `AppState`** and nothing about a day
 * reads it. It lives in memory, beside friends and circles, and is not written to the phone's
 * storage at all: the server holds it for a week, and a copy here would be one more place for it to
 * go stale.
 */

/**
 * One GIF as the provider hands it out. The bytes stay at the provider; what travels is two links
 * and the size, so the tile and the bubble can hold their shape before the picture arrives.
 */
export interface Gif {
  /** The provider's id — what a report or a second look at the same GIF would name. */
  id: string
  /** Small animated picture: the search grid and the bubble by today's circle. */
  preview: string
  /** The big one, opened in the sheet. An mp4 when the provider has it — a fraction of a .gif. */
  full: string
  width: number
  height: number
  /**
   * Search only, never sent: a small mp4 and a still jpg for the picker's grid. A grid of animated
   * images weighed about 5 MB a page on KLIPY's real answers; the same page as mp4 is under 1 MB,
   * and the jpg holds the tile until its clip plays. The bubble by the road cannot use them — an
   * SVG `<image>` does not play video — so what travels is `preview` and `full`.
   */
  clip?: string
  poster?: string
}

export interface GifMessage {
  id: string
  kind: 'gif'
  from: Person
  gif: Gif
  sentAt: string
}

export type Message = GifMessage

/** Everything the send needs: the key is minted by the sender, like every key in the app. */
export interface OutgoingGif {
  id: string
  recipientId: string
  gif: Gif
}

export interface MessageMethods {
  /** What is waiting for me, oldest first. */
  messages(): Promise<Message[]>
  /**
   * Send. Returns nothing: the sender's own view does not change — what was sent is in the other
   * person's inbox, not in yours.
   */
  messageSend(message: OutgoingGif): Promise<void>
  /** Drop what was seen, and answer with what is left. */
  messagesDismiss(ids: string[]): Promise<Message[]>
}

/**
 * Whether a link may be fetched on somebody else's say-so. The same rule as the check on the
 * server: the recipient's phone loads these the moment the road opens, and a link to any other
 * host would tell that host who opened it and when. Checked on both sides — the server's check is
 * the rule, this one keeps a stale server from being the only thing between a row and the screen.
 */
export function isProviderUrl(url: string): boolean {
  return /^https:\/\/([a-z0-9-]+\.)*klipy\.com\//.test(url)
}

/** A full link that plays as video rather than an image. */
export function isVideoUrl(url: string): boolean {
  return /\.mp4(\?|$)/i.test(url)
}

/** Fired by the DevPanel to lay a sample GIF by today's circle; heard only in a dev build. */
export const DEV_SAMPLE_GIF_EVENT = 'the-way:dev-sample-gif'
