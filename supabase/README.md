# Supabase

Что сделать один раз, чтобы вход заработал. Без этих шагов приложение работает как раньше:
дорога лежит в localStorage, строки «Аккаунт» в настройках просто нет.

1. **Проект.** [supabase.com](https://supabase.com) → New project. Регион — ближе к людям,
   пароль базы сохранить.

2. **Схема.** SQL Editor → вставить [migrations/0001_profiles.sql](./migrations/0001_profiles.sql)
   целиком → Run. В файле таблица, `enable row level security` и политики идут подряд, и порядок
   несущий: ключ у клиента публичный, и данные защищают только политики.

   Файл можно запускать сколько угодно раз: `if not exists`, `drop policy if exists`, `or replace`.
   Ответ «relation "profiles" already exists» на старой версии файла значил ровно это — схема уже
   встала, потому что редактор гоняет файл одной транзакцией и упавший прогон откатился бы целиком.

   Проверить, что всё на месте:

   ```sql
   select
     (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) as rls,
     (select count(*) from pg_policies where schemaname = 'public' and tablename = 'profiles') as policies,
     (select count(*) from pg_proc where proname = 'handle_available') as handle_fn,
     (select count(*) from pg_trigger
       where tgrelid = 'public.profiles'::regclass and not tgisinternal) as triggers;
   ```

   Ждём `true · 3 · 1 · 1`. `rls = false` — единственная строка, на которую нельзя махнуть рукой:
   ключ у клиента публичный, и таблица без политик открыта всем.

3. **Вход по почте.** Authentication → Sign In / Providers → Email включён.

   И отдельный шаг, без которого вход не заработает: Authentication → Emails → шаблоны **Magic
   link or OTP** и **Confirm signup** должны содержать `{{ .Token }}`. По умолчанию там только
   ссылка, а приложение спрашивает **шесть цифр** — ссылка увела бы человека из установленного на
   домашний экран приложения во вторую его копию в браузере.

   **Шаблонов именно два, и забыть второй легко.** Первое письмо новому человеку идёт по «Confirm
   signup», а не по «Magic link or OTP»: пока адрес не подтверждён, Supabase подтверждает адрес.
   Поправив только Magic Link, получаешь код для себя и ссылку для каждого, кто придёт после, —
   то есть ровно для тех, у кого это первое впечатление.

4. **Ключи.** Project Settings → **API Keys** → **Publishable key** (`sb_publishable_…`) и
   Project Settings → **Data API** → `Project URL`. Оба в `.env.local` рядом с `package.json`:

   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_...
   ```

   `sb_publishable_…` — новое имя того, что раньше звалось `anon public`; старые ключи вида `eyJ…`
   тоже работают. Публичным он называется не по небрежности: класть его в браузер можно **потому
   что** включён RLS, и это единственная причина.

   `.env.local` в `.gitignore`. `sb_secret_…` (бывший `service_role`) в приложение не попадает
   никогда — он обходит политики, а весь смысл политик в том, что их не обходят.

5. `npm run dev` → Профиль → Настройки → Аккаунт.

## Что здесь лежит и чего не лежит

`profiles` — имя, ник и три числа, которые и так видны по нику (docs/circle.md, «Что видно
чужим»). **Дороги на сервере нет**: ни дней, ни дел, ни геометрии. `the-way:v1` в localStorage
остаётся единственным источником правды про путь — таблица `roads` из «Дороги в аккаунте» это
следующий шаг, и она хранит конверт целиком, а не разбирает его на колонки.
