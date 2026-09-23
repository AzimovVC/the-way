import { toPerson } from './friendRow'
import { isProviderUrl, type Gif, type Message } from './messages'

/**
 * What arrives from the server and from the GIF provider, and everything that can be said about it
 * without asking either — pure TypeScript with a test beside it, like `feedRow.ts`.
 *
 * Distrustful for the same reason: the migration ships before the build, the build lives on the
 * phone for weeks, and the provider answers in a format that is not ours. A row that cannot be
 * shown is dropped quietly — one GIF fewer is more honest than a broken bubble.
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function size(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : null
}

function link(value: unknown): string | null {
  const url = text(value)
  return url !== null && isProviderUrl(url) ? url : null
}

/** One message from `messages_view`. */
export function toMessage(value: unknown): Message | null {
  if (!isObject(value)) return null
  if (value.kind !== 'gif') return null

  const id = text(value.id)
  const from = toPerson(value.sender)
  const sentAt = text(value.sent_at)
  const gifId = text(value.gif_id)
  const preview = link(value.preview_url)
  const full = link(value.full_url)
  const width = size(value.width)
  const height = size(value.height)
  if (id === null || from === null || sentAt === null || !Number.isFinite(Date.parse(sentAt))) return null
  if (gifId === null || preview === null || full === null || width === null || height === null) return null

  return { id, kind: 'gif', from, sentAt, gif: { id: gifId, preview, full, width, height } }
}

export function toMessages(value: unknown): Message[] {
  if (!Array.isArray(value)) return []
  return value.map(toMessage).filter((message): message is Message => message !== null)
}

/**
 * Which formats may stand in for which job, and the smallest width each job can live with.
 *
 * No fixed order wins. Measured on KLIPY's answers (23 Sep 2026): the same search gave one GIF whose
 * `webp` weighed 45 KB against a 18 KB `tinygif`, and another whose `webp` was 1.1 MB against a
 * 405 KB `tinygif` — and the reverse on the next page. So each job takes the **lightest** of its
 * formats, by the byte size the provider reports, among those wide enough not to blur.
 *
 * The preview plays in a grid tile about 170 px wide and in the bubble by today's circle; below
 * 150 px (`nanogif` is ~90) it goes soft on a phone screen. The full one opens across the sheet and
 * is an mp4 where there is one — the same seconds as a .gif at a fraction of the bytes.
 */
const PREVIEW_FORMATS = ['tinywebp', 'webp', 'tinygif', 'nanowebp', 'nanogif', 'gif'] as const
const FULL_FORMATS = ['tinymp4', 'mp4', 'loopedmp4', 'tinygif', 'gif'] as const
const PREVIEW_MIN_WIDTH = 150
const FULL_MIN_WIDTH = 200

/**
 * The picker's grid: a small mp4 and a still to hold the tile. Same 150 px floor as the preview —
 * it is the same tile.
 */
const CLIP_FORMATS = ['nanomp4', 'tinymp4', 'mp4'] as const
const POSTER_FORMATS = ['tinygifpreview', 'gifpreview', 'nanogifpreview'] as const

/** The formats asked for — no more than the lists above can use. */
export const GIF_MEDIA_FILTER = [
  ...new Set([...PREVIEW_FORMATS, ...FULL_FORMATS, ...CLIP_FORMATS, ...POSTER_FORMATS]),
].join(',')

interface Media {
  url: string
  width: number
  height: number
  bytes: number
}

function media(formats: Record<string, unknown>, wanted: readonly string[], minWidth: number): Media | null {
  const found: Media[] = []
  for (const name of wanted) {
    const one = formats[name]
    if (!isObject(one)) continue
    const url = link(one.url)
    const dims = Array.isArray(one.dims) ? one.dims : []
    const width = size(dims[0])
    const height = size(dims[1])
    // A format without a size is not ruled out, only put last: the list order breaks the tie.
    const bytes = size(one.size) ?? Number.POSITIVE_INFINITY
    if (url !== null && width !== null && height !== null) found.push({ url, width, height, bytes })
  }
  // Wide enough first; if nothing is, the widest there is beats nothing at all.
  const sharp = found.filter((m) => m.width >= minWidth)
  const pool = sharp.length > 0 ? sharp : found.sort((a, b) => b.width - a.width).slice(0, 1)
  return pool.reduce<Media | null>((best, m) => (best === null || m.bytes < best.bytes ? m : best), null)
}

/**
 * One result from the provider's search (Tenor v2 format, which KLIPY speaks). The size is the
 * preview's: that is the shape the tile and the bubble hold, and the full one has the same aspect.
 */
export function toGif(value: unknown): Gif | null {
  if (!isObject(value) || !isObject(value.media_formats)) return null
  const id = text(value.id)
  const preview = media(value.media_formats, PREVIEW_FORMATS, PREVIEW_MIN_WIDTH)
  const full = media(value.media_formats, FULL_FORMATS, FULL_MIN_WIDTH)
  if (id === null || preview === null || full === null) return null
  const gif: Gif = { id, preview: preview.url, full: full.url, width: preview.width, height: preview.height }
  const clip = media(value.media_formats, CLIP_FORMATS, PREVIEW_MIN_WIDTH)
  const poster = media(value.media_formats, POSTER_FORMATS, PREVIEW_MIN_WIDTH)
  if (clip !== null) gif.clip = clip.url
  if (poster !== null) gif.poster = poster.url
  return gif
}

export interface GifPage {
  gifs: Gif[]
  /** Where the next page starts; `null` when there is none. */
  next: string | null
}

export function toGifPage(value: unknown): GifPage {
  if (!isObject(value)) return { gifs: [], next: null }
  const gifs = Array.isArray(value.results)
    ? value.results.map(toGif).filter((gif): gif is Gif => gif !== null)
    : []
  const next = text(value.next)
  return { gifs, next: next === null || next === '0' ? null : next }
}
