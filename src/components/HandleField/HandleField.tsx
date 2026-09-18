import { useState } from 'react'
import { HANDLE_MAX_LENGTH, handleProblem, normalizeHandle } from '../../domain/handle'

interface HandleFieldProps {
  /** Ник, который стоит сейчас: свой или подсказка, подобранная по имени. */
  value: string
  onChange: (handle: string) => void
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
export default function HandleField({ value, onChange }: HandleFieldProps) {
  // Своё состояние на время правки: нормализация в общем состоянии не даёт стереть последний
  // символ — «se» короче минимума, и запись откатывалась бы к прежнему нику под пальцем.
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? value
  const problem = draft === null ? null : handleProblem(draft)

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
      {problem && (
        <span className="px-1 text-[12px]" style={{ color: 'var(--color-day-red)' }}>
          {problem}
        </span>
      )}
    </span>
  )
}
