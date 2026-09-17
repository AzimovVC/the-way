/**
 * Правила, которые записаны в CLAUDE.md словами «нельзя заводить обратно».
 *
 * Они не про поведение одной функции, а про то, кто кого имеет право читать, — обычным тестом
 * такое не ловится: код продолжает работать, просто начинает судить человека тем, чем не должен.
 * Поэтому здесь читаются сами исходники. Тест падает в тот день, когда правило нарушено, а не
 * через полгода, когда это заметят на экране.
 *
 * Файлы берутся через import.meta.glob, а не через node:fs: тот потребовал бы типы Node в
 * конфиге браузерного приложения — то есть открыл бы самому приложению дверь, ради которой и
 * написан этот файл.
 */
import { describe, expect, it } from 'vitest'

const RAW = import.meta.glob('../**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/**
 * Всё под src/, кроме тестов, — путями от src/. Ключи приходят относительно этого файла, и у
 * соседей по папке они начинаются с './', а не с '../domain/', — отсюда две замены.
 */
const SOURCES = Object.entries(RAW)
  .map(([key, text]) => [key.replace(/^\.\//, 'domain/').replace(/^\.\.\//, ''), text] as const)
  .filter(([file]) => !file.includes('.test.'))

function read(file: string): string {
  const found = SOURCES.find(([name]) => name === file)
  if (!found) throw new Error(`нет такого файла: ${file}`)
  return found[1]
}

describe('время суток ничего не судит', () => {
  // Точный час читается как обещание, а «утром» опоздать нельзя — но только пока partOfDay не
  // попал в то, что считает. Один импорт отсюда превращает порядок в списке во второй приговор.
  const judges = [
    'domain/pathEngine.ts', 'domain/ranks.ts', 'domain/milestones.ts', 'domain/milestoneAward.ts',
    'domain/streak.ts', 'domain/comeback.ts', 'domain/review.ts', 'domain/monthReview.ts',
    'domain/dayLifecycle.ts', 'domain/schedule.ts', 'domain/freezes.ts',
  ]

  it.each(judges)('%s does not read partOfDay', (file) => {
    expect(read(file)).not.toContain('partOfDay')
  })
})

describe('выходной и заморозка — один предикат', () => {
  // `isDayExcused` существует потому, что проверка `day.frozen` вразброс однажды пропустит
  // выходной и запишет его в провал. Список ниже — места, которые заморозку *называют* (рисуют
  // луну, пишут «под заморозкой», тратят кредит), а не судят по ней.
  const allowed = new Set([
    'domain/schedule.ts', // сам предикат
    'domain/freezes.ts', // тратит и накладывает кредиты
    'domain/milestones.ts', // отличает заморозку от выходного в отчёте, и об этом там написано
    'domain/feed.ts', // строка ленты «в этот день была заморозка»
    'domain/todayBrief.ts', // «Сегодня под заморозкой» против «Сегодня выходной»
    'components/DayCard/DayCard.tsx', // кнопка заморозки и значок в шапке
    'components/PathView/PathView.tsx', // луна на круге дня
  ])

  it('nobody else reads day.frozen', () => {
    const readers = SOURCES.filter(([file, text]) => {
      // Запись поля вычёркивается: `frozen: day.frozen` — это перенос флага дальше (дорога отдаёт
      // его отрисовке, чтобы та нарисовала луну), а не суждение по нему.
      return /\.frozen\b/.test(text.replace(/frozen:\s*[\w.]+/g, '')) && !allowed.has(file)
    }).map(([file]) => file)

    expect(readers, 'судить о дне надо через isDayExcused, а не по day.frozen').toEqual([])
  })
})

describe('выкинутое не возвращается', () => {
  // Каждое из этих полей уже жило в состоянии и было убрано шагом миграции: вторая лестница
  // (habitExp/habitLevel), дубликат расписания (frequency) и личная цель привычки (targetDays).
  // Вернуть их в models.ts легко и незаметно — здесь это стоит теста в одну строку.
  it.each(['habitExp', 'habitLevel', 'frequency', 'targetDays'])('models.ts declares no %s', (field) => {
    expect(read('domain/models.ts')).not.toContain(field)
  })
})
