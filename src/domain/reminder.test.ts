import { describe, expect, it } from 'vitest'
import { cleanRemindAt, defaultRemindAt, describeRemindAt } from './reminder'

describe('час напоминания', () => {
  it('берётся из выбранного отрезка дня', () => {
    expect(defaultRemindAt('morning')).toBe('08:00')
    expect(defaultRemindAt('day')).toBe('13:00')
    expect(defaultRemindAt('evening')).toBe('20:00')
  })

  // «Когда угодно» — нормальный ответ про время суток, и напоминание всё равно надо когда-то
  // сказать: у брошенной привычки другого случая и не бывает.
  it('без отрезка дня начинается с вечера', () => {
    expect(defaultRemindAt(undefined)).toBe('20:00')
  })

  it('пустое поле времени часом не становится', () => {
    expect(cleanRemindAt('')).toBeUndefined()
    expect(cleanRemindAt(undefined)).toBeUndefined()
  })

  it('отказывается от того, что не час суток', () => {
    expect(cleanRemindAt('24:00')).toBeUndefined()
    expect(cleanRemindAt('8:00')).toBeUndefined()
    expect(cleanRemindAt('20:60')).toBeUndefined()
    expect(cleanRemindAt('вечером')).toBeUndefined()
  })

  it('пропускает оба края суток', () => {
    expect(cleanRemindAt('00:00')).toBe('00:00')
    expect(cleanRemindAt('23:59')).toBe('23:59')
  })

  it('называет час вместе со словом, из-за которого он такой', () => {
    expect(describeRemindAt('20:00', 'evening')).toBe('Вечером, в 20:00')
    expect(describeRemindAt('09:30', undefined)).toBe('В 09:30')
  })
})
