export interface GoalPreset {
  id: string
  title: string
}

export const GOAL_PRESETS: GoalPreset[] = [
  { id: 'athlete', title: 'Спортсмен' },
  { id: 'french', title: 'Французский' },
  { id: 'savings', title: 'Накопления' },
  { id: 'phone', title: 'Меньше сидеть в телефоне' },
  { id: 'reading', title: 'Больше читать' },
  { id: 'sleep', title: 'Здоровый сон' },
]
