/**
 * Hand the browser a file to save. Shared so the backup card, the full backup section and the
 * quarantine rescue all produce the same thing — the copy is the only route the history has out
 * of this browser, and three slightly different ways of making it is three ways to get it wrong.
 */
export function downloadJson(filename: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
