export type TaskIconKind = 'dumbbell' | 'book' | 'headphones' | 'coin' | 'phone' | 'sleep' | 'generic'

const KEYWORD_MAP: [RegExp, TaskIconKind][] = [
  [/спорт|трениров|бег|качал|зал|отжима/i, 'dumbbell'],
  [/книг|читат|франц|язык|учи|слов/i, 'book'],
  [/подкаст|музык|слуша|наушник/i, 'headphones'],
  [/деньг|коплен|коин|бюджет|наклад|финанс/i, 'coin'],
  [/телефон|скролл|соцсет/i, 'phone'],
  [/сон|спать|ложись/i, 'sleep'],
]

export function taskIconKind(title: string): TaskIconKind {
  for (const [pattern, kind] of KEYWORD_MAP) {
    if (pattern.test(title)) return kind
  }
  return 'generic'
}
