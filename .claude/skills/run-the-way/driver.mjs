#!/usr/bin/env node
/**
 * Драйвер приложения «The Way» — управление живым приложением из командной строки.
 *
 * Говорит с Chrome напрямую по Chrome DevTools Protocol через встроенный в Node
 * WebSocket (Node >= 22). Зависимостей нет и ставить нечего: ни puppeteer, ни
 * playwright, ни chromium-cli в этом окружении нет, а Chrome — есть.
 *
 * Читает команды из stdin по одной в строке, поэтому годится и для пайпа
 * (`printf '...' | node driver.mjs`), и для интерактивной сессии.
 *
 * Команды:
 *   goto [url|/путь]        открыть dev-сервер; относительный путь — от него же (/stats)
 *   ss [имя]                скриншот -> печатает абсолютный путь
 *   click <css>             клик по центру элемента (настоящий mouse event)
 *   clicktext <текст>       клик по первому элементу, содержащему текст
 *   clickday <n|today>      клик по кругу дня на пути (0 — самый старый, today — сегодня)
 *   type <css> <текст>      ввести текст; селектор с пробелами берите в 'одинарные кавычки'
 *   text <css>              напечатать innerText элемента
 *   html [css]              напечатать outerHTML (по умолчанию — #root)
 *   wait <css> [мс]         ждать появления элемента (по умолчанию 5000 мс)
 *   eval <js>               выполнить JS в странице, напечатать результат
 *   state [expr]            сохранённое состояние (переждав debounce); в expr доступна `s`
 *   seed                    записать в localStorage готовое состояние с историей
 *   reset                   очистить localStorage приложения и перезагрузить
 *   reload                  перезагрузить страницу
 *   errors                  напечатать накопленные ошибки консоли и страницы
 *   quit                    закрыть браузер и выйти
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const CHROME = process.env.CHROME_BIN
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const SHOT_DIR = process.env.SHOT_DIR || join(tmpdir(), 'the-way-shots')
const PORT = Number(process.env.CDP_PORT || 9333)

// Телефонный вьюпорт: приложение мобильное, на широком окне путь читается иначе.
const VIEWPORT = { width: 390, height: 844, dpr: 2 }

mkdirSync(SHOT_DIR, { recursive: true })

let baseUrl = null

/**
 * Находит работающий dev-сервер Vite. Порт не фиксирован: Vite берёт первый свободный
 * начиная с 5173, поэтому забытые с прошлых запусков серверы сдвигают адрес.
 *
 * Это важнее, чем кажется: localStorage привязан к origin, то есть к порту. Записать
 * состояние на :5173 и открыть :5175 — значит увидеть пустой онбординг вместо своих
 * данных. Поэтому адрес определяется один раз и переиспользуется, а команда `goto`
 * принимает относительные пути.
 */
async function findDevServer() {
  if (baseUrl) return baseUrl
  if (process.env.APP_URL) {
    baseUrl = process.env.APP_URL
    return baseUrl
  }
  for (let port = 5173; port <= 5180; port++) {
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(500) })
      const body = await res.text()
      if (body.includes('/src/main.tsx') || body.includes('The Way')) {
        baseUrl = `http://localhost:${port}/`
        return baseUrl
      }
    } catch {
      /* порт молчит — пробуем следующий */
    }
  }
  throw new Error('dev-сервер не найден на портах 5173-5180. Запустите `npm run dev`.')
}

let msgId = 0
const pending = new Map()
const consoleErrors = []
let ws
let sessionId

function send(method, params = {}, useSession = true) {
  const id = ++msgId
  const msg = { id, method, params }
  if (useSession && sessionId) msg.sessionId = sessionId
  ws.send(JSON.stringify(msg))
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`CDP-таймаут: ${method}`))
      }
    }, 30000)
  })
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text)
  }
  return res.result.value
}

/** Центр элемента в CSS-пикселях, или null. Клик шлём настоящей мышью, а не el.click(). */
async function centerOf(selector) {
  return evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })()`)
}

async function mouseClick(x, y) {
  const base = { x, y, button: 'left', clickCount: 1, buttons: 1 }
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base })
  await settle()
}

/**
 * Ждёт, пока React перерисуется И закончатся CSS-переходы.
 *
 * Без этого клик по элементу, который ещё едет (карточка дня выезжает 300 мс,
 * duration-300 в DayCard.tsx), попадает мимо — и, что хуже, молча: элемент
 * находится, координаты берутся из промежуточного положения, обработчик не
 * срабатывает, а драйвер рапортует «ok».
 */
async function settle(timeoutMs = 2000) {
  await evaluate(`new Promise(resolve => {
    const deadline = performance.now() + ${timeoutMs}
    const tick = () => {
      const running = document.getAnimations().some(a => a.playState === 'running')
      if (!running || performance.now() > deadline) {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      } else {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  })`)
}

/** Разбирает «<селектор> <значение>», где селектор может быть взят в одинарные кавычки. */
function splitSelectorAndValue(arg) {
  if (arg.startsWith("'")) {
    const end = arg.indexOf("'", 1)
    if (end === -1) throw new Error('незакрытая кавычка в селекторе')
    return { sel: arg.slice(1, end), value: arg.slice(end + 1).trim() }
  }
  const gap = arg.indexOf(' ')
  if (gap === -1) throw new Error('нужно: type <селектор> <текст>')
  return { sel: arg.slice(0, gap), value: arg.slice(gap + 1) }
}

async function screenshot(name) {
  const file = join(SHOT_DIR, `${name || `shot-${Date.now()}`}.png`)
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const { writeFileSync } = await import('node:fs')
  writeFileSync(file, Buffer.from(data, 'base64'))
  return file
}

/**
 * Состояние с готовой историей: цель, одна ежедневная задача и 40 дней позади.
 * Записывается прямо в localStorage под ключом конверта — так тестовый прогон
 * минует онбординг и сразу показывает интересную геометрию пути.
 * Дни намеренно смешанные: сплошная серия рисует прямую дорогу и ничего не проверяет.
 */
function seedScript() {
  return `(() => {
    const today = new Date()
    const iso = (d) => d.toISOString().slice(0, 10)
    const goalId = 'seed-goal'
    const taskId = 'seed-task'
    const days = []
    for (let i = 39; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const date = iso(d)
      // Хороший разгон, провал в середине, восстановление — дорога успевает
      // развернуться вниз и снова вверх.
      const age = 39 - i
      const done = age < 12 ? true : age < 22 ? age % 4 === 0 : true
      const rate = done ? 1 : 0
      days.push({
        id: 'day-' + date,
        date,
        tasks: [{ id: 'dt-' + date, taskTemplateId: taskId, dayId: 'day-' + date, isDone: done, skipped: false, completedAt: done ? d.toISOString() : null }],
        completionRate: rate,
        pathAngleDelta: 0,
        columnDriftX: 0,
        colorTier: rate >= 1 ? 'gold' : 'red',
        frozen: false,
      })
    }
    const state = {
      user: {
        id: 'seed-user',
        name: 'Тестер',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        notificationsEnabled: true,
        freezesRemaining: 2,
        freezesRefilledMonth: iso(today).slice(0, 7),
        goals: [{
          id: goalId,
          title: 'Бегать по утрам',
          antiGoalTitle: 'Снова забросить',
          archived: false,
          tasks: [{
            id: taskId, goalId, title: 'Пробежка 3 км', frequency: 'daily',
            habitLevel: 3, habitExp: 120, targetDays: 66,
            currentTier: 'none', cycleStartDate: days[0].date,
          }],
        }],
      },
      days,
    }
    localStorage.setItem('the-way:v1', JSON.stringify({ version: 1, state }))
    return 'записано дней: ' + days.length
  })()`
}

async function connect() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'the-way-chrome-'))
  const chrome = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    // Без этого страница в фоне троттлится и React рендерит с задержкой.
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    'about:blank',
  ], { stdio: 'ignore' })
  chrome.unref()

  let wsUrl
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(400) })
      wsUrl = (await res.json()).webSocketDebuggerUrl
      break
    } catch {
      await new Promise((r) => setTimeout(r, 200))
    }
  }
  if (!wsUrl) throw new Error(`Chrome не поднял отладочный порт ${PORT}. Проверьте CHROME_BIN.`)

  ws = new WebSocket(wsUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
      return
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push('page error: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text))
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) {
      consoleErrors.push(msg.params.type + ': ' + msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
    }
  })

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, false)
  const attached = await send('Target.attachToTarget', { targetId, flatten: true }, false)
  sessionId = attached.sessionId

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: VIEWPORT.dpr,
    mobile: true,
  })
  return chrome
}

async function goto(url) {
  await send('Page.navigate', { url })
  // Ждём, пока React смонтируется: #root перестанет быть пустым.
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    try {
      const ready = await evaluate('!!document.querySelector("#root") && document.querySelector("#root").children.length > 0')
      if (ready) {
        await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
        return
      }
    } catch {
      /* навигация ещё идёт — Runtime контекст пересоздаётся */
    }
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('приложение не смонтировалось за 15 с (см. `errors`)')
}

async function handle(line) {
  const trimmed = line.trim()
  if (!trimmed) return true
  const sp = trimmed.indexOf(' ')
  const cmd = sp === -1 ? trimmed : trimmed.slice(0, sp)
  const arg = sp === -1 ? '' : trimmed.slice(sp + 1).trim()

  switch (cmd) {
    case 'goto': {
      const base = await findDevServer()
      // Относительный путь разрешается от найденного сервера — иначе легко уйти на
      // соседний порт, где лежит другой localStorage.
      const url = !arg ? base : arg.startsWith('http') ? arg : new URL(arg, base).href
      await goto(url)
      console.log('ok: ' + url)
      return true
    }
    case 'ss':
      console.log(await screenshot(arg))
      return true
    case 'click': {
      const pt = await centerOf(arg)
      if (!pt) throw new Error(`не найден или невидим: ${arg}`)
      await mouseClick(pt.x, pt.y)
      console.log(`ok: клик ${arg}`)
      return true
    }
    case 'clicktext': {
      const sel = await evaluate(`(() => {
        // Сравнение регистронезависимое: часть подписей в приложении выглядит
        // заглавными только из-за CSS text-transform, а в DOM лежит обычным регистром
        // («Отдалить» рисуется как «ОТДАЛИТЬ»).
        const needle = ${JSON.stringify(arg)}.toLocaleLowerCase('ru')
        const els = [...document.querySelectorAll('button, a, [role="button"], label, div, span')]
        const hit = els.reverse().find(el => el.textContent.trim().toLocaleLowerCase('ru').includes(needle) && el.getBoundingClientRect().width > 0)
        if (!hit) return null
        hit.setAttribute('data-driver-hit', '1')
        return '[data-driver-hit="1"]'
      })()`)
      if (!sel) throw new Error(`текст не найден: ${arg}`)
      const pt = await centerOf(sel)
      await mouseClick(pt.x, pt.y)
      await evaluate(`document.querySelectorAll('[data-driver-hit]').forEach(e => e.removeAttribute('data-driver-hit'))`)
      console.log(`ok: клик по тексту «${arg}»`)
      return true
    }
    case 'clickday': {
      // Дни — это SVG-группы без стабильных атрибутов, поэтому ищем их по форме: у группы дня
      // прямым ребёнком лежит <path> подставки, а лицо — <circle> во вложенной <g> (она и есть
      // то, что поднимает лифт). Считать круги поштучно нельзя: значки вехи и изменений дня
      // рисуют свои во вложенных <g>, и день с меткой переставал находиться.
      //
      // Дни впереди устроены так же — это нарочно (см. «Дорога после сегодня» в CLAUDE.md), —
      // и отличаются приглушённостью, записанной в style: у прожитого дня там только курсор.
      const which = arg || 'today'
      const pt = await evaluate(`(() => {
        const svg = document.querySelector('svg[width="100%"]')
        if (!svg) return null
        const days = [...svg.querySelectorAll('g[style*="cursor"]')]
          .filter(g => g.style.opacity === ''
            && [...g.children].some(c => c.tagName === 'path')
            && g.querySelector(':scope > g > circle'))
        if (days.length === 0) return null
        const want = ${JSON.stringify(which)}
        const idx = want === 'today' ? days.length - 1 : Number(want)
        const g = days[idx < 0 ? days.length + idx : idx]
        if (!g) return null
        // Лицо дня; по нему и бьём, подставка ниже и уже.
        const face = g.querySelector(':scope > g > circle')
        const r = face.getBoundingClientRect()
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, count: days.length }
      })()`)
      if (!pt) throw new Error(`день не найден: ${which} (путь ещё не отрисован?)`)
      await mouseClick(pt.x, pt.y)
      console.log(`ok: клик по дню ${which} (всего дней на пути: ${pt.count})`)
      return true
    }
    case 'type': {
      // Селектор может сам содержать пробелы (input[placeholder="Название задачи"]),
      // поэтому режем не по первому пробелу, а по закрывающей кавычке, если селектор
      // взят в кавычки.
      const { sel, value } = splitSelectorAndValue(arg)
      const pt = await centerOf(sel)
      if (!pt) throw new Error(`не найден: ${sel}`)
      await mouseClick(pt.x, pt.y)
      for (const ch of value) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch })
        await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch })
      }
      console.log(`ok: введено в ${sel}`)
      return true
    }
    case 'text':
      console.log(await evaluate(`document.querySelector(${JSON.stringify(arg)})?.innerText ?? '(нет элемента)'`))
      return true
    case 'html':
      console.log(await evaluate(`document.querySelector(${JSON.stringify(arg || '#root')})?.outerHTML ?? '(нет элемента)'`))
      return true
    case 'wait': {
      const parts = arg.split(' ')
      const timeout = Number(parts[parts.length - 1]) || 5000
      const sel = Number(parts[parts.length - 1]) ? parts.slice(0, -1).join(' ') : arg
      const deadline = Date.now() + timeout
      while (Date.now() < deadline) {
        if (await evaluate(`!!document.querySelector(${JSON.stringify(sel)})`)) {
          console.log(`ok: есть ${sel}`)
          return true
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      throw new Error(`не дождались: ${sel}`)
    }
    case 'eval':
      console.log(JSON.stringify(await evaluate(arg), null, 2))
      return true
    case 'state': {
      // Запись в localStorage дебаунсится на 400 мс (appStorage.ts), поэтому читать сразу
      // после клика — значит прочитать прошлое. Ждём дольше окна и только потом читаем.
      const expr = arg || `({
        days: s.days.length,
        last: s.days.at(-1)?.date,
        lastDone: s.days.at(-1)?.tasks.map(t => t.isDone),
        completionRate: s.days.at(-1)?.completionRate,
        goals: s.user.goals.map(g => g.title),
      })`
      const out = await evaluate(`new Promise(r => setTimeout(() => {
        const raw = localStorage.getItem('the-way:v1')
        if (!raw) return r('(в localStorage пусто)')
        const s = JSON.parse(raw).state
        r(${JSON.stringify('')} + JSON.stringify((() => (${expr}))(), null, 2))
      }, 600))`)
      console.log(out)
      return true
    }
    case 'seed':
      console.log(await evaluate(seedScript()))
      return true
    case 'seedtest': {
      // The app's own dev seed (src/dev/seedHistory.ts), so a scripted run and a manual one
      // start from exactly the same history: two schedules, real rest days, a slump and a
      // recovery, today left unticked. DEV builds only — DevPanel installs the hook.
      const res = await evaluate(
        `(() => { if (typeof seedTestHistory !== 'function') return 'нет хука seedTestHistory (dev-сборка?)'; seedTestHistory(); return 'ok: тестовая история засеяна' })()`,
      )
      await new Promise((r) => setTimeout(r, 600))
      console.log(res)
      return true
    }
    case 'reset':
      await evaluate(`localStorage.removeItem('the-way:v1')`)
      await send('Page.reload')
      await new Promise((r) => setTimeout(r, 800))
      console.log('ok: состояние очищено')
      return true
    case 'reload':
      await send('Page.reload')
      await new Promise((r) => setTimeout(r, 800))
      console.log('ok: перезагружено')
      return true
    case 'errors':
      console.log(consoleErrors.length ? consoleErrors.join('\n') : '(ошибок нет)')
      return true
    case 'quit':
      return false
    default:
      throw new Error(`неизвестная команда: ${cmd}`)
  }
}

const chrome = await connect()
console.log(`драйвер готов. скриншоты -> ${SHOT_DIR}`)

const rl = createInterface({ input: process.stdin, terminal: false })
let failed = false
for await (const line of rl) {
  try {
    if (!(await handle(line))) break
  } catch (err) {
    failed = true
    console.error('ОШИБКА: ' + err.message)
  }
}

try {
  await send('Browser.close', {}, false)
} catch {
  chrome.kill()
}
ws?.close()
process.exit(failed ? 1 : 0)
