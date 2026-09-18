interface AvatarProps {
  /** Имя человека — из него берётся буква. */
  name: string
  /** Диаметр круга в пикселях; буква считается от него, а не задаётся отдельно. */
  size: number
  /**
   * Обвести круг. Нужно там, где он стоит на цветном баннере: без ободка фиолетовый круг на
   * фиолетовом фоне теряет край и читается как пятно.
   */
  ring?: boolean
  className?: string
}

/**
 * Человек кружком. Фотографий в этом приложении нет, поэтому в круге стоит буква имени.
 *
 * Круг **фиолетовый** — тем же цветом, что профиль в таббаре: фиолетовый здесь значит «человек»,
 * и второго смысла у него нет. Цвета дня и ступени сюда не заходят — они заняты тем, как идут
 * дела, и человек, покрашенный в цвет дня, читался бы как оценка.
 */
export default function Avatar({ name, size, ring = false, className }: AvatarProps) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-bold${className === undefined ? '' : ` ${className}`}`}
      style={{
        width: size,
        height: size,
        // Буква занимает примерно половину круга: на 44px это 20px, на 132px — 60. Отдельным
        // размером шрифта это разъехалось бы на первом же круге нового размера.
        fontSize: Math.round(size * 0.45),
        backgroundColor: 'var(--violet-800)',
        color: 'var(--violet-400)',
        boxShadow: ring ? 'inset 0 0 0 3px var(--violet-600)' : undefined,
      }}
      aria-hidden
    >
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  )
}
