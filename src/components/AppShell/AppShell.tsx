import type { ReactNode } from 'react'
import TabBar from '../TabBar'

interface AppShellProps {
  children: ReactNode
  /** Screens that scroll (stats, profile); the path screen sizes itself instead. */
  scrollable?: boolean
}

/**
 * The single 440px-max phone column every tab-level screen lives in — the app
 * has no responsive desktop layout, so on a wide viewport the column becomes a
 * device frame rather than stretching.
 *
 * The frame is the positioning context for sheets and dialogs, which is why it
 * is `relative`: an `absolute inset-0` overlay inside a screen covers the tab
 * bar too, as it should.
 */
export default function AppShell({ children, scrollable = false }: AppShellProps) {
  return (
    <div className="flex h-dvh justify-center bg-surface-sunken sm:h-screen sm:py-6">
      <div className="relative flex h-full w-full max-w-[390px] flex-col overflow-hidden bg-bg sm:h-[844px] sm:rounded-[28px] sm:border sm:border-border sm:shadow-[0_18px_44px_rgba(0,0,0,.48)]">
        <div className={`flex min-h-0 flex-1 flex-col ${scrollable ? 'hide-scrollbar overflow-y-auto' : ''}`}>
          {children}
        </div>
        <TabBar />
      </div>
    </div>
  )
}
