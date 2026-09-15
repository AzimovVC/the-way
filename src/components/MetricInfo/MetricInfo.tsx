import { useState, type ReactNode } from 'react'

/**
 * A «?» beside a heading that opens what the metric actually measures.
 *
 * The split is deliberate: **definitions** go behind the button, **caveats** stay on the screen.
 * How a gold day is counted is something you look up once; «это совпадение, а не причина» is
 * something you have to read at the moment you read the number, and a caveat you must tap for is
 * a caveat that has been hidden.
 */
export default function MetricInfo({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Что такое «${title}»`}
        className="sk-focus flex size-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-text-muted"
        style={{ boxShadow: 'inset 0 0 0 1px var(--color-border)' }}
      >
        ?
      </button>

      {open && (
        <div
          className="sk-scrim absolute inset-0 z-30 flex items-end justify-center px-4 pb-6 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="sk-dialog flex w-full max-w-xs flex-col gap-3 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="sk-heading text-[19px] text-text-primary">{title}</h3>
            <div className="flex flex-col gap-2 text-[14px] leading-snug text-text-secondary">{children}</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="sk-btn sk-btn-neutral sk-btn-block sk-plinth sk-focus"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </>
  )
}
