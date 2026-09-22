import { useState } from 'react'
import { newId } from '../domain/ids'
import { useAppState } from '../state/appState'
import { useSocial } from './socialState'
import type { CircleInvite } from './circles'

/**
 * Saying yes to a shared-habit invitation, written once for the two screens that ask.
 *
 * The accept is not one call but three things that have to happen together: the habit is created
 * **the ordinary way**, through the same `applyAction` as one made by hand, so what lands in the
 * state is the result of your consent and not somebody else's data; the prediction is asked, the
 * habit being new and the question being about it rather than about where the word came from;
 * and only then does the pair get told. Copied into a second screen, the middle step is the one
 * that silently goes missing.
 *
 * The two screens differ in shape, not in this: the friends screen answers with a card, the feed
 * with a row, and both mean exactly the same sentence.
 */
export function useCircleInviteAccept(invite: CircleInvite): { accept: () => void; busy: boolean } {
  const { state, dispatch, askAboutNewHabits } = useAppState()
  const { acceptInvite } = useSocial()
  const [busy, setBusy] = useState(false)

  function accept(): void {
    if (busy) return
    setBusy(true)
    const taskId = newId()
    const next = dispatch({
      kind: 'addGoal',
      input: {
        id: newId(),
        title: invite.title,
        tasks: [{ id: taskId, title: invite.title, weekdays: invite.weekdays, icon: invite.icon, paired: true }],
      },
    })
    askAboutNewHabits(state, next)
    void acceptInvite(invite.id, newId(), taskId)
  }

  return { accept, busy }
}
