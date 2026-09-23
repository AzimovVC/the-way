import { GIF_MEDIA_FILTER, toGifPage, type GifPage } from './messageRow'

/**
 * GIF search at KLIPY, in the Tenor v2 format KLIPY speaks.
 *
 * Tenor was the first choice; Google shut its API down on 30 June 2026. KLIPY took the same request
 * shape, so this file is written against Tenor's and the provider is the base URL below — moving to
 * another Tenor-compatible provider (GIPHY has a compatibility layer too) is that line and the host
 * check in `isProviderUrl` and migration 0013.
 *
 * The call goes from the phone straight to KLIPY, with a key in the bundle, the way Tenor keys were
 * always used. What that key can do is search; what reaches another person is fenced on our server,
 * where the links are pinned to the provider's hosts. When the key starts being abused, the move is
 * a Supabase Edge Function in front of this one call — nothing else changes.
 *
 * KLIPY asks for its name in the search bar: the picker's placeholder says it.
 */

const BASE = 'https://api.klipy.com/v2'
const KEY = import.meta.env.VITE_KLIPY_API_KEY

/** Without a key there is nothing to search, and the picker says so rather than showing nothing. */
export const gifSearchConfigured = typeof KEY === 'string' && KEY !== ''

/**
 * Two dozen per page — a phone screen and a bit, which is what one scroll costs. Every tile is a
 * download, and the person asked for the app to be sparing with it.
 */
const PAGE = 24

/**
 * One page. An empty query is the trending list — the picker opens on something rather than on a
 * blank grid waiting for a word.
 *
 * `contentfilter=medium`: these arrive in a friend's app unasked, and a safer default is cheaper
 * than a report.
 */
export async function searchGifs(query: string, pos: string | null, signal?: AbortSignal): Promise<GifPage> {
  if (!gifSearchConfigured) throw new Error('GIF search is not configured')

  const q = query.trim()
  const params = new URLSearchParams({
    key: KEY!,
    client_key: 'the-way',
    limit: String(PAGE),
    contentfilter: 'medium',
    media_filter: GIF_MEDIA_FILTER,
    locale: typeof navigator === 'undefined' ? 'ru_RU' : navigator.language.replace('-', '_'),
  })
  if (q !== '') params.set('q', q)
  if (pos !== null) params.set('pos', pos)

  const response = await fetch(`${BASE}/${q === '' ? 'featured' : 'search'}?${params}`, { signal })
  if (!response.ok) throw new Error(`GIF search failed: ${response.status}`)
  return toGifPage(await response.json())
}
