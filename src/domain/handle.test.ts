import { describe, expect, it } from 'vitest'
import { handleOf, handleProblem, normalizeHandle, suggestHandle, HANDLE_MAX_LENGTH } from './handle'

describe('normalizeHandle', () => {
  it('переводит кириллицу в латиницу', () => {
    expect(normalizeHandle('Женя')).toBe('zhenya')
    expect(normalizeHandle('Сергей')).toBe('sergei')
  })

  it('склеивает пробелы в подчёркивание и не оставляет его на конце', () => {
    expect(normalizeHandle('  Иван   Петров  ')).toBe('ivan_petrov')
  })

  it('не выпускает ничего длиннее предела', () => {
    expect(normalizeHandle('a'.repeat(50))).toHaveLength(HANDLE_MAX_LENGTH)
  })

  it('имя из одних недопустимых знаков даёт пустую строку, а не мусор', () => {
    expect(normalizeHandle('!!!')).toBe('')
  })
})

describe('handleProblem', () => {
  it('молчит на нормальном нике', () => {
    expect(handleProblem('sergey')).toBeNull()
  })

  it('жалуется на короткий и на ник без единой буквы', () => {
    expect(handleProblem('ab')).not.toBeNull()
    expect(handleProblem('12345')).not.toBeNull()
  })
})

describe('suggestHandle', () => {
  it('разводит двух тёзок хвостом из id', () => {
    const a = suggestHandle('Сергей', 'aaaa-1111')
    const b = suggestHandle('Сергей', 'bbbb-2222')
    expect(a).not.toBe(b)
  })

  it('подбирает ник и человеку без имени', () => {
    const handle = suggestHandle('', 'ccee-3333')
    expect(handleProblem(handle)).toBeNull()
  })

  it('держится предела длины даже с длинным именем', () => {
    expect(suggestHandle('Константин', 'dddd-4444').length).toBeLessThanOrEqual(HANDLE_MAX_LENGTH)
  })
})

describe('handleOf', () => {
  it('отдаёт свой ник, когда он есть, и подсказку, когда его нет', () => {
    expect(handleOf({ id: 'u1', name: 'Сергей', handle: 'seryoga' })).toBe('seryoga')
    expect(handleOf({ id: 'u1', name: 'Сергей' })).toBe(suggestHandle('Сергей', 'u1'))
  })
})
