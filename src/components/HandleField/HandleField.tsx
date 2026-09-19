import { useEffect, useState } from 'react'
import { HANDLE_MAX_LENGTH, handleProblem, normalizeHandle } from '../../domain/handle'

/**
 * Сколько ждать перед вопросом «занят ли». Ник набирают посимвольно, и вопрос на каждую букву —
 * это запрос за каждое промежуточное слово, `s`, `se`, `ser`, ответ на которое уже никому не нужен.
 */
const CHECK_DEBOUNCE_MS = 400

interface HandleFieldProps {
  /** Ник, который стоит сейчас: свой или подсказка, подобранная по имени. */
  value: string
  onChange: (handle: string) => void
  /**
   * Свободен ли такой ник — спрашивается у той стороны, пока человек печатает. Нет функции —
   * значит спрашивать некого: без сервера ник не у кого занимать, и поле молчит.
   */
  checkFree?: (handle: string) => Promise<boolean>
}

/**
 * Поле ника. Собачка нарисована слева и не набирается: она часть адреса, а не часть имени, и
 * человек, стирающий её из поля, каждый раз чинил бы то, чего не ломал.
 *
 * Набранное приводится к форме **на лету** (`normalizeHandle`), а не проверяется после: «Сергей»
 * превращается в `sergey` под пальцем, и это объясняет правило лучше любой подписи под полем.
 * Жалоба показывается только на то, что нельзя исправить заменой символа, — на слишком короткий
 * ник и на ник без единой буквы.
 */
export default function HandleField({ value, onChange, checkFree }: HandleFieldProps) {
  // Своё состояние на время правки: нормализация в общем состоянии не даёт стереть последний
  // символ — «se» короче минимума, и запись откатывалась бы к прежнему нику под пальцем.
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  const problem = draft === null ? null : handleProblem(draft)

  // Занятость — вопрос ко всем пользователям сразу, и ответить на него локально нечем. Ответ
  // хранится **вместе с ником, про который он ответ**: иначе «занят» про предыдущее слово
  // висело бы над уже исправленным, а флаг «проверяю» разошёлся бы с полем на отменённом запросе.
  const [checked, setChecked] = useState<{ handle: string; free: boolean } | null>(null)
  const taken = draft !== null && checked !== null && checked.handle === draft && !checked.free

  useEffect(() => {
    if (!checkFree || draft === null || handleProblem(draft) !== null) return
    let alive = true
    const timer = setTimeout(() => {
      checkFree(draft)
        .then((free) => {
          if (alive) setChecked({ handle: draft, free })
        })
        .catch(() => {
          // Нет связи — нет и жалобы: молчание тут значит «пока не знаю», а не «свободен»,
          // и настоящий отказ придёт от записи.
        })
    }, CHECK_DEBOUNCE_MS)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [draft, checkFree])

  const complaint = problem ?? (taken ? 'Этот ник занят' : null)

  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="flex items-center">
        <span className="text-[15px] font-medium text-text-muted">@</span>
        <input
          value={shown}
          onChange={(e) => {
            const next = normalizeHandle(e.target.value)
            setDraft(next)
            if (handleProblem(next) === null) onChange(next)
          }}
          onBlur={() => setDraft(null)}
          maxLength={HANDLE_MAX_LENGTH}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Ник"
          className="sk-focus w-[150px] rounded-[8px] bg-transparent px-1 py-0.5 text-right text-[15px] font-medium text-text-primary"
        />
      </span>
      {complaint && (
        <span className="px-1 text-[12px]" style={{ color: 'var(--color-day-red)' }}>
          {complaint}
        </span>
      )}
    </span>
  )
}
