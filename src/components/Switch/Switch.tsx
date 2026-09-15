export interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  /** What the switch is called, for people who hear the screen instead of seeing it. */
  label: string
  disabled?: boolean
}

/**
 * The toggle the rest of the system is built on: a sunken track when off, the brand colour when
 * on, and a knob that keeps its own plinth so the control reads as a physical thing in both
 * states. Colour alone never carries the state — the knob also moves, which is what a person
 * sees first and what survives a screenshot in greyscale.
 */
export default function Switch({ checked, onChange, label, disabled = false }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="sk-focus relative h-[32px] w-[52px] shrink-0 rounded-full border transition-colors"
      style={{
        backgroundColor: checked ? 'var(--color-brand)' : 'var(--ink-950)',
        borderColor: checked ? 'var(--color-brand-plinth)' : 'var(--color-border)',
        boxShadow: checked ? 'none' : 'var(--shadow-inset-well)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      <span
        className="absolute top-[2px] size-[24px] rounded-full"
        style={{
          left: checked ? '24px' : '2px',
          backgroundColor: checked ? 'var(--ink-950)' : 'var(--ink-400)',
          boxShadow: '0 2px 0 rgba(0, 0, 0, 0.35)',
          transition: 'left var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out)',
        }}
      />
    </button>
  )
}
