export function readItem<T>(key: string): T | null {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  return JSON.parse(raw) as T
}

export function writeItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function removeItem(key: string): void {
  localStorage.removeItem(key)
}
