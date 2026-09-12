export interface GoalPreset {
  id: string
  title: string
  defaultAntiGoal: string
}

export const GOAL_PRESETS: GoalPreset[] = [
  { id: 'athlete', title: 'Спортсмен', defaultAntiGoal: 'Диван и лень' },
  { id: 'french', title: 'Французский', defaultAntiGoal: 'Забыть язык' },
  { id: 'savings', title: 'Накопления', defaultAntiGoal: 'Спускать всё на мелочи' },
  { id: 'phone', title: 'Меньше сидеть в телефоне', defaultAntiGoal: 'Бесконечный скролл' },
  { id: 'reading', title: 'Больше читать', defaultAntiGoal: 'Залипать в ленты' },
  { id: 'sleep', title: 'Здоровый сон', defaultAntiGoal: 'Сидеть допоздна' },
]

export function defaultAntiGoalFor(title: string): string {
  const preset = GOAL_PRESETS.find((p) => p.title === title)
  return preset ? preset.defaultAntiGoal : `Не ${title.charAt(0).toLowerCase()}${title.slice(1)}`
}
