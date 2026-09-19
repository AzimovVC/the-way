import { afterEach, describe, expect, it, vi } from 'vitest'
import { newId } from './ids'

/**
 * Проверяется не «даёт ли UUID» — это видно глазами, — а тот случай, в котором приложение уже
 * один раз перестало открываться целиком: `crypto.randomUUID` есть только в защищённом
 * контексте, и по адресу вида `http://192.168.1.12:5173` его нет. Падение случалось на первом
 * кадре, до всякого экрана, поэтому тест на форму ключа здесь важнее обычного.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('newId', () => {
  it('даёт UUID v4', () => {
    expect(newId()).toMatch(UUID_V4)
  })

  it('даёт его и там, где `randomUUID` не существует — то есть по обычному http', () => {
    const insecure = { getRandomValues: crypto.getRandomValues.bind(crypto) }
    vi.stubGlobal('crypto', insecure)
    expect(newId()).toMatch(UUID_V4)
  })

  it('ключи не повторяются', () => {
    const many = new Set(Array.from({ length: 500 }, () => newId()))
    expect(many.size).toBe(500)
  })
})
