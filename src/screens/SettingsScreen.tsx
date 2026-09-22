import { useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/AppShell'
import BackupSection from '../components/BackupSection'
import HandleField from '../components/HandleField'
import Icon from '../components/Icon'
import SettingsRow from '../components/SettingsRow'
import SettingsSection from '../components/SettingsSection'
import Switch from '../components/Switch'
import { dayWord, habitWord } from '../domain/calendar'
import { FREEZE_MONTHLY_ALLOWANCE } from '../domain/config'
import { handleOf } from '../domain/handle'
import { useSocial } from '../social/socialState'
import { clearState } from '../storage/appStorage'
import { forgetSeenScreens } from '../storage/reviewSeen'
import { eraseRoad } from '../storage/roadSync'
import { useAuth } from '../supabase/authState'
import { useAppState } from '../state/appState'

/**
 * Everything the profile used to be, grouped the way a phone's own settings are: short titled
 * lists instead of one long form. The grouping is the navigation here — there are no sub-screens
 * yet, and a person looking for «уведомления» finds the word «НАПОМИНАНИЯ» before they find a row.
 *
 * Rows marked `soon` are drawn but not wired. They are in the file on purpose: the shape of the
 * screen is easier to argue about with the future sitting in it, and a dimmed «скоро» never lies
 * about what the app does today.
 */
export default function SettingsScreen() {
  const { state, dispatch } = useAppState()
  const { view } = useSocial()
  const { configured, status, email, error: authError, checkHandleFree } = useAuth()
  const { user } = state
  // Сколько привычек сейчас о себе напомнят. Завершённые цели не считаются: они уже ни о чём
  // не спрашивают, и час, оставшийся у них в поле, никого не разбудит.
  const remindingCount = user.goals
    .filter((goal) => !goal.archived)
    .reduce((n, goal) => n + goal.tasks.filter((task) => task.remindAt !== undefined).length, 0)

  return (
    <AppShell scrollable>
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="flex items-center gap-2">
          <Link to="/profile" aria-label="Назад в профиль" className="sk-press sk-focus -ml-2 rounded-[16px] p-2">
            <Icon name="chevron-left" size={24} color="var(--color-text-secondary)" />
          </Link>
          <h1 className="sk-heading text-[32px] text-text-primary">Настройки</h1>
        </div>

        {/* Жалоба на ник стоит над списком, а не под полем: она приходит с той стороны через
            секунду после того, как палец ушёл с клавиатуры, и под полем её уже никто не читает. */}
        <SettingsSection title="Ты" note={authError ?? undefined}>
          <SettingsRow
            label="Имя"
            right={
              <input
                value={user.name}
                onChange={(e) => dispatch({ kind: 'updateProfile', patch: { name: e.target.value } })}
                placeholder="Как тебя называть?"
                aria-label="Имя"
                className="sk-focus w-[170px] rounded-[8px] bg-transparent px-1 py-0.5 text-right text-[15px] font-medium text-text-primary placeholder:text-text-muted"
              />
            }
          />
          {/* Ник стоит прямо под именем: это два ответа на один вопрос — как тебя звать, — и
              разница между ними в том, кто спрашивает. Подписи про латиницу нет, её говорит
              само поле, переписывая набранное под пальцем. */}
          <SettingsRow
            label="Ник"
            hint={
              configured && status === 'signed-in'
                ? 'По нему тебя найдут друзья. Занимается сразу'
                : 'По нему тебя найдут друзья'
            }
            right={
              <HandleField
                value={handleOf(user)}
                onChange={(handle) => dispatch({ kind: 'updateProfile', patch: { handle } })}
                // Спрашивать «занят ли» есть у кого только у вошедшего: без сервера ник не у кого
                // занимать, и строка «Этот ник занят» сообщала бы о беде, которой нет.
                checkFree={configured && status === 'signed-in' ? checkHandleFree : undefined}
              />
            }
          />
          <SettingsRow
            label="Часовой пояс"
            right={
              <input
                value={user.timezone}
                onChange={(e) => dispatch({ kind: 'updateProfile', patch: { timezone: e.target.value } })}
                aria-label="Часовой пояс"
                className="sk-focus w-[170px] rounded-[8px] bg-transparent px-1 py-0.5 text-right text-[15px] font-medium text-text-primary"
              />
            }
          />
          <SettingsRow label="Фото профиля" right={<Icon name="chevron-right" size={20} color="var(--color-text-muted)" />} soon />
          {/* Строки нет вовсе, пока нет сервера: «Аккаунт → скоро» в приложении, которое и без
              него работает целиком, обещает то, чего человек не просил. */}
          {configured && (
            <SettingsRow
              label="Аккаунт"
              hint={
                status === 'signed-in'
                  ? (email ?? 'Ты вошёл')
                  : 'Вход по почте. Дорога останется на телефоне'
              }
              to="/profile/settings/account"
            />
          )}
        </SettingsSection>

        {/* Список заблокированных живёт тут, а не среди друзей: там он показывал бы при каждом
            открытии ровно тех, кого человек убрал с глаз. Число стоит справа, чтобы за пустым
            списком не ходили. */}
        <SettingsSection
          title="Люди"
          note="«Привычки видны всем» сохранится сейчас, а заработает вместе с сетью: своего профиля пока никто не запрашивает."
        >
          {/* Умолчание — «только друзьям», и подпись говорит, что видно всегда. Переключатель,
              молчащий о второй половине правила, человек читает как «выключено — значит меня не
              видно вовсе», а имя и ник видны по нику всегда: на то он и ник. */}
          <SettingsRow
            label="Привычки видны всем"
            hint="Иначе — только друзьям. Имя, ник и дни в пути видны по нику всегда."
            right={
              <Switch
                label="Привычки видны всем"
                checked={user.habitsPublic === true}
                onChange={(next) => dispatch({ kind: 'updateProfile', patch: { habitsPublic: next } })}
              />
            }
          />
          <SettingsRow
            label="Заблокированные"
            to="/profile/settings/blocked"
            right={<span className="sk-num text-[15px] text-text-muted">{view.blocked.length}</span>}
          />
        </SettingsSection>

        <SettingsSection
          title="Напоминания"
          note={user.notificationsEnabled ? 'Пуши появятся позже — пока это только настройка.' : undefined}
        >
          <SettingsRow
            label="Уведомления"
            right={
              <Switch
                label="Уведомления"
                checked={user.notificationsEnabled}
                onChange={(next) => dispatch({ kind: 'updateProfile', patch: { notificationsEnabled: next } })}
              />
            }
          />
          {/* Час напоминания живёт на привычке, а не здесь, и поэтому строка **уводит** отсюда,
              а не показывает число. Один час на всё приложение звонил бы про утреннюю зарядку и
              вечерние таблетки в одну и ту же секунду — то есть был бы прав ровно для одной из
              них. Строка при этом настоящая, без «скоро»: она ведёт туда, где час действительно
              ставится. */}
          <SettingsRow
            label="Время напоминаний"
            hint="У каждой привычки своё — в её настройках."
            to="/profile/habits"
            right={<span className="sk-num text-[15px] text-text-muted">{remindingCount}</span>}
          />
          <SettingsRow
            label="Молчать, когда день уже закрыт"
            right={<Switch label="Молчать, когда день уже закрыт" checked={false} onChange={() => {}} disabled />}
            soon
          />
          <SettingsRow label="Тихие часы" right={<span className="sk-num text-[15px] text-text-muted">23:00 — 8:00</span>} soon />
        </SettingsSection>

        <SettingsSection title="Дорога">
          <SettingsRow
            label="Анимации"
            right={<Switch label="Анимации" checked={false} onChange={() => {}} disabled />}
            soon
          />
          <SettingsRow
            label="Вибрация"
            right={<Switch label="Вибрация" checked={false} onChange={() => {}} disabled />}
            soon
          />
          <SettingsRow
            label="Ободряющие фразы"
            right={<Switch label="Ободряющие фразы" checked={false} onChange={() => {}} disabled />}
            soon
          />
          <SettingsRow
            label="Открывать дорогу целиком"
            right={<Switch label="Открывать дорогу целиком" checked={false} onChange={() => {}} disabled />}
            soon
          />
        </SettingsSection>

        <SettingsSection
          title="Заморозки"
          note={`Раз в месяц запас пополняется до ${FREEZE_MONTHLY_ALLOWANCE}.`}
        >
          <SettingsRow
            label="Осталось"
            icon="moon"
            iconColor="var(--color-freeze)"
            right={
              <span className="sk-num text-[19px] font-semibold" style={{ color: 'var(--color-freeze)' }}>
                {user.freezesRemaining}
              </span>
            }
          />
          <SettingsRow
            label="Тратить автоматически"
            right={<Switch label="Тратить автоматически" checked={false} onChange={() => {}} disabled />}
            soon
          />
        </SettingsSection>

        <BackupSection />

        <SettingsSection title="О приложении">
          <SettingsRow label="Что нового" right={<Icon name="chevron-right" size={20} color="var(--color-text-muted)" />} soon />
          <SettingsRow label="Как считаются дни" right={<Icon name="chevron-right" size={20} color="var(--color-text-muted)" />} soon />
        </SettingsSection>

        <StartOverSection />
      </div>
    </AppShell>
  )
}

/**
 * «Начать заново» — стереть путь и начать первый день заново.
 *
 * Стоит **под резервной копией и последним на экране**, и оба места выбраны. Последним — по той же
 * причине, по которой последним стоит удаление аккаунта: до него доходят, пролистав всё остальное,
 * и это единственная защита, которая работает всегда. Под копией — потому что копия и есть ответ на
 * «а вдруг зря»: кнопка, которая всё вернёт, должна быть уже прочитана к тому мигу, когда палец
 * дошёл сюда.
 *
 * Два шага, но слова набирать не просят, в отличие от удаления аккаунта: там уносится ник, друзья
 * и копия разом и навсегда, а здесь путь остаётся и в файле, и — у вошедшего — две недели в ранних
 * копиях аккаунта. Цена названа целиком до нажатия, включая то, чего **не** случится: аккаунт, ник
 * и друзья остаются на месте.
 */
function StartOverSection() {
  const { state } = useAppState()
  const { userId } = useAuth()
  const [asked, setAsked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dayCount = state.days.length
  const habitCount = state.user.goals.reduce((n, goal) => n + goal.tasks.length, 0)

  async function startOver() {
    setBusy(true)
    setError(null)
    try {
      // Аккаунт очищается **первым**. Пустое устройство против полного аккаунта — это тот самый
      // случай, ради которого заведено молчаливое скачивание: следующий запуск вернул бы стёртый
      // путь обратно, и «Начать заново» отменило бы само себя на глазах у человека.
      if (userId !== null) await eraseRoad(userId)
    } catch {
      setBusy(false)
      setError('Не получилось очистить копию в аккаунте — иначе путь вернулся бы с неё. Проверь связь.')
      return
    }
    clearState()
    forgetSeenScreens()
    // Перезагрузка, а не пустое состояние в руках: кроме дороги, приложение держит в памяти кэши
    // ленты, кружков и уже показанных экранов, и заново поднятая страница — это ровно то же, что
    // видит новый телефон.
    window.location.reload()
  }

  if (!asked) {
    return (
      <SettingsSection title="Опасное">
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="text-[13px] text-text-muted">
            Путь начнётся с чистого листа: дни, привычки, серии и уровни исчезнут. Аккаунт, ник и
            друзья останутся — это не путь.
          </p>
          <button
            type="button"
            onClick={() => setAsked(true)}
            className="sk-btn sk-btn-ghost sk-press sk-btn-block"
            style={{ color: 'var(--color-day-red)' }}
          >
            Начать заново
          </button>
        </div>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title="Опасное">
      <div className="flex flex-col gap-3 px-4 py-4">
        <p className="text-[13px] text-text-secondary">
          Сейчас в пути {dayCount} {dayWord(dayCount)} и {habitCount} {habitWord(habitCount)}. Если
          хочешь оставить их себе — сохрани копию кнопкой выше, это последняя минута.
        </p>
        {userId !== null && (
          <p className="text-[13px] text-text-muted">
            Копия в аккаунте тоже опустеет. Прежняя дорога полежит там ещё две недели — её видно
            кнопкой «Показать ранние копии».
          </p>
        )}
        <button
          type="button"
          onClick={() => void startOver()}
          disabled={busy}
          className="sk-btn sk-btn-danger sk-press sk-btn-block"
        >
          {busy ? 'Стираю…' : 'Стереть и начать заново'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAsked(false)
            setError(null)
          }}
          className="sk-btn sk-btn-ghost sk-press sk-btn-block"
        >
          Оставить всё как есть
        </button>
        {error && (
          <p className="text-[13px]" style={{ color: 'var(--color-day-red)' }}>
            {error}
          </p>
        )}
      </div>
    </SettingsSection>
  )
}
