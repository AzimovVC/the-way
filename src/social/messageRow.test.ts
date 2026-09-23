import { describe, expect, it } from 'vitest'
import { toGif, toGifPage, toMessage, toMessages } from './messageRow'

/**
 * Parsing what the server and the GIF provider send.
 *
 * What is checked is the row that **cannot be shown**, and above all a link that points somewhere
 * other than the provider: the recipient's phone fetches it without being asked, so a link to any
 * other host is a way to learn who opened the road and when.
 */

const LENA = { id: 'u1', handle: 'lena', name: 'Лена' }

const ROW = {
  id: 'm1',
  kind: 'gif',
  sender: LENA,
  gif_id: 'g1',
  preview_url: 'https://static.klipy.com/ii/a/tiny.webp',
  full_url: 'https://static.klipy.com/ii/a/full.mp4',
  width: 220,
  height: 124,
  sent_at: '2026-09-23T10:00:00Z',
}

describe('toMessage', () => {
  it('parses a GIF message whole', () => {
    expect(toMessage(ROW)).toEqual({
      id: 'm1',
      kind: 'gif',
      from: LENA,
      sentAt: '2026-09-23T10:00:00Z',
      gif: {
        id: 'g1',
        preview: 'https://static.klipy.com/ii/a/tiny.webp',
        full: 'https://static.klipy.com/ii/a/full.mp4',
        width: 220,
        height: 124,
      },
    })
  })

  it('drops a link to any host but the provider', () => {
    expect(toMessage({ ...ROW, preview_url: 'https://evil.example/pixel.gif' })).toBeNull()
    expect(toMessage({ ...ROW, full_url: 'http://static.klipy.com/ii/a/full.mp4' })).toBeNull()
    // A look-alike host is not the provider.
    expect(toMessage({ ...ROW, full_url: 'https://klipy.com.evil.example/x.mp4' })).toBeNull()
  })

  it('drops a kind it cannot draw', () => {
    // A voice note from a newer server is a message this build has no drawing for.
    expect(toMessage({ ...ROW, kind: 'voice' })).toBeNull()
  })

  it('drops a row without size or sender', () => {
    expect(toMessage({ ...ROW, width: 0 })).toBeNull()
    expect(toMessage({ ...ROW, sender: null })).toBeNull()
  })

  it('keeps the rest of the list when one row is broken', () => {
    expect(toMessages([ROW, { ...ROW, id: 'm2', kind: 'voice' }, { ...ROW, id: 'm3' }]).map((m) => m.id)).toEqual([
      'm1',
      'm3',
    ])
    expect(toMessages(null)).toEqual([])
  })
})

describe('toGif', () => {
  // Shaped like a real KLIPY answer: the same set of formats every GIF carries, with byte sizes.
  const RESULT = {
    id: 'k1',
    media_formats: {
      gif: { url: 'https://static.klipy.com/big.gif', dims: [498, 280], size: 2_000_000 },
      tinygif: { url: 'https://static.klipy.com/tiny.gif', dims: [220, 124], size: 270_000 },
      nanogif: { url: 'https://static.klipy.com/nano.gif', dims: [90, 51], size: 20_000 },
      webp: { url: 'https://static.klipy.com/full.webp', dims: [220, 124], size: 70_000 },
      mp4: { url: 'https://static.klipy.com/full.mp4', dims: [498, 280], size: 300_000 },
      tinymp4: { url: 'https://static.klipy.com/tiny.mp4', dims: [220, 124], size: 75_000 },
      nanomp4: { url: 'https://static.klipy.com/nano.mp4', dims: [150, 85], size: 10_000 },
      tinygifpreview: { url: 'https://static.klipy.com/still.jpg', dims: [220, 124], size: 7_000 },
    },
  }

  it('takes the lightest preview wide enough, and the lightest mp4', () => {
    expect(toGif(RESULT)).toEqual({
      id: 'k1',
      preview: 'https://static.klipy.com/full.webp',
      full: 'https://static.klipy.com/tiny.mp4',
      width: 220,
      height: 124,
      clip: 'https://static.klipy.com/nano.mp4',
      poster: 'https://static.klipy.com/still.jpg',
    })
  })

  it('does not trade sharpness for bytes: the ~90px nanogif is lighter and still loses', () => {
    expect(toGif(RESULT)?.preview).not.toBe('https://static.klipy.com/nano.gif')
  })

  it('picks whichever is lighter today — a webp can be the heavy one', () => {
    const formats = {
      ...RESULT.media_formats,
      webp: { url: 'https://static.klipy.com/full.webp', dims: [498, 498], size: 1_100_000 },
      tinygif: { url: 'https://static.klipy.com/tiny.gif', dims: [220, 220], size: 405_000 },
    }
    expect(toGif({ ...RESULT, media_formats: formats })?.preview).toBe('https://static.klipy.com/tiny.gif')
  })

  it('falls back to a gif when there is no mp4', () => {
    const { mp4: _, tinymp4: __, nanomp4: ___, ...rest } = RESULT.media_formats
    expect(toGif({ ...RESULT, media_formats: rest })?.full).toBe('https://static.klipy.com/tiny.gif')
  })

  it('skips a format hosted elsewhere and takes the next one', () => {
    const formats = { ...RESULT.media_formats, webp: { url: 'https://cdn.example/x.webp', dims: [220, 124], size: 1 } }
    expect(toGif({ ...RESULT, media_formats: formats })?.preview).toBe('https://static.klipy.com/tiny.gif')
  })

  it('takes the widest when nothing is wide enough', () => {
    const formats = { nanogif: RESULT.media_formats.nanogif, tinymp4: RESULT.media_formats.tinymp4 }
    expect(toGif({ ...RESULT, media_formats: formats })?.preview).toBe('https://static.klipy.com/nano.gif')
  })
})

describe('toGifPage', () => {
  it('reads the next position, and "0" as the end', () => {
    expect(toGifPage({ results: [], next: '24' }).next).toBe('24')
    expect(toGifPage({ results: [], next: '0' }).next).toBeNull()
    expect(toGifPage('nonsense')).toEqual({ gifs: [], next: null })
  })
})
