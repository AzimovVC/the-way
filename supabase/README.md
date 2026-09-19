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

3. **Дорога в аккаунте.** SQL Editor → [migrations/0002_roads.sql](./migrations/0002_roads.sql)
   → Run. Одна таблица, одна политика `for all` — чужую дорогу не читает никто, включая друзей.

   ```sql
   select
     (select relrowsecurity from pg_class where oid = 'public.roads'::regclass) as rls,
     (select count(*) from pg_policies where schemaname = 'public' and tablename = 'roads') as policies;
   ```

   Ждём `true · 1`.

4. **Ранние копии.** SQL Editor → [migrations/0003_road_snapshots.sql](./migrations/0003_road_snapshots.sql)
   → Run. В `roads` одна строка на человека, и каждая выгрузка её затирает; этот файл вешает на
   замену триггер, который сначала откладывает заменяемое. По снимку на день, две недели назад.

   ```sql
   select
     (select relrowsecurity from pg_class where oid = 'public.road_snapshots'::regclass) as rls,
     (select count(*) from pg_policies
       where schemaname = 'public' and tablename = 'road_snapshots') as policies,
     (select count(*) from pg_trigger
       where tgrelid = 'public.roads'::regclass and not tgisinternal) as road_triggers;
   ```

   Ждём `true · 1 · 2`. Политика одна — **на чтение**: снимки кладёт триггер, и клиенту писать
   сюда нечем. Триггеров на `roads` теперь два: время и снимок.

   Если сразу после `Run` приложение скажет «Не получилось спросить аккаунт про ранние копии» —
   это не оно. PostgREST держит схему в кэше и о новой таблице узнаёт с задержкой; в ответе при
   этом стоит `PGRST205`. Через минуту проходит само, а не ждать — `notify pgrst, 'reload schema';`.

5. **Дружбы.** SQL Editor → [migrations/0004_friends.sql](./migrations/0004_friends.sql) → Run.
   Заявки, дружбы, блокировки и жалобы — и **сужение политики на `profiles`**, обещанное ещё в
   0001: заблокированный не видит ничего, включая самого факта, что такой ник занят.

   ```sql
   select
     (select count(*) from pg_class
       where relnamespace = 'public'::regnamespace and relrowsecurity
         and relname in ('friend_requests', 'friendships', 'blocks', 'reports')) as rls,
     (select count(*) from pg_policies where schemaname = 'public'
       and tablename in ('friend_requests', 'friendships', 'blocks', 'reports')) as policies,
     (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname like 'friend%') as fns;
   ```

   Ждём `4 · 10 · 10`. У жалоб политика **одна** — на запись: читают их не отсюда. У заявок,
   дружб и блокировок нет политики на `update` и нет самого права `update`: связь не правят, она
   исчезает и появляется другая.

   Тот же `PGRST205`, что в шаге 4, придёт и здесь — минута или `notify pgrst, 'reload schema';`.

6. **Вход по почте.** Authentication → Sign In / Providers → Email включён, и там же —
   **Minimum password length**. Оно должно быть **не больше 8**: столько обещает подпись под полем
   (`PASSWORD_MIN_LENGTH`), и граница выше нашей превращает наше же правило в отказ сервера —
   по-английски и уже после нажатия.

   И отдельный шаг, без которого вход не заработает: Authentication → Emails → шаблоны **Magic
   link or OTP** и **Confirm signup** должны содержать `{{ .Token }}`. По умолчанию там только
   ссылка, а приложение спрашивает **шесть цифр** — ссылка увела бы человека из установленного на
   домашний экран приложения во вторую его копию в браузере.

   **Шаблонов именно два, и забыть второй легко.** Первое письмо новому человеку идёт по «Confirm
   signup», а не по «Magic link or OTP»: пока адрес не подтверждён, Supabase подтверждает адрес.
   Поправив только Magic Link, получаешь код для себя и ссылку для каждого, кто придёт после, —
   то есть ровно для тех, у кого это первое впечатление.

   Пароль этого не отменяет: **«Confirm signup» уходит и на регистрацию паролем**, если включено
   Authentication → Sign In / Providers → Email → Confirm email. Приложение это разбирает само —
   пришла сессия, значит внутрь; не пришла, значит спрашиваем шесть цифр, — но с ссылкой вместо
   `{{ .Token }}` спрашивать будет нечего.

   **Встроенный отправщик Supabase — для разработки, и только.** Писем у него несколько в час на
   весь проект, и переполненный он отвечает `500 unexpected_failure` с «Error sending confirmation
   email» — приложение на это говорит «письмо не ушло, подожди пару минут», а не винит адрес. До
   живых людей нужен свой SMTP: Authentication → Emails → SMTP Settings. Без него первый же день
   с десятком регистраций упрётся в тишину, неотличимую для человека от поломки.

7. **Вход через Google.** Три места, и пропущенное третье — самая частая причина «ничего не
   происходит».

   - **Google Cloud Console** → APIs & Services → Credentials → Create credentials → OAuth client
     ID → Web application. В **Authorized redirect URIs** — ровно один адрес, и это адрес
     *Supabase*, а не приложения: `https://<ref>.supabase.co/auth/v1/callback`. Там же, в OAuth
     consent screen, название и логотип: их человек читает на экране «Войти в …», и пустое место
     он читает как чужой сайт.
   - **Supabase** → Authentication → Sign In / Providers → Google → включить, вставить Client ID и
     Client Secret.
   - **Supabase** → Authentication → URL Configuration → **Redirect URLs**: сюда добавляются
     адреса *приложения* — `http://localhost:5173` для разработки и боевой адрес. Назад Supabase
     отпускает только по этому списку, и адрес, которого в нём нет, оборачивается тихим возвратом
     на Site URL.

   Секрет Google живёт **только** в панели Supabase: обмен кода на сессию делает сервер, и в
   `.env.local` от Google не попадает ничего. Это то же правило, что и у `sb_secret_…`.

   Возвращается человек на `?code=…` — обычный параметр запроса, не якорь: клиент заведён с
   `flowType: 'pkce'` ровно затем, чтобы токены не лежали в адресной строке и не спорили с
   маршрутами роутера.

8. **Ключи.** Project Settings → **API Keys** → **Publishable key** (`sb_publishable_…`) и
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

9. `npm run dev` → Профиль → Настройки → Аккаунт.

10. **Проверить политики руками.** SQL Editor → [tests/rls.sql](./tests/rls.sql) целиком → Run.
   Ждём одну строку: `RLS: все проверки прошли, тестовые люди удалены`. Любой другой ответ — это
   текст проверки, которая не прошла, словами: «Анна читает дорогу Бориса», «Невошедший видит 2
   профиля» и так далее.

   Запросы из шагов 2 и 3 отвечают, **включён** ли RLS; этот файл отвечает, что политики при этом
   запрещают ровно то, что должны. Разница не теоретическая: политика, написанная правильно и
   выписанная не на ту роль, на глаз неотличима от верной.

   Гонять его можно на рабочем проекте и сколько угодно раз. Всё живёт внутри одного `do`-блока,
   то есть одной транзакции: провал откатывает тестовых людей вместе с собой, успех удаляет их
   сам. Запускать после **каждой** правки политик — в части 7 их станет больше, и сузить чужой
   select блокировками, случайно открыв дорогу, легче, чем кажется.

## Что здесь лежит и чего не лежит

`profiles` — имя, ник и три числа, которые и так видны по нику (docs/circle.md, «Что видно
чужим»). Читать их может любой вошедший: это и есть карточка, которую открывают по нику.

`roads` — конверт целиком, тот же, что уезжает в файл резервной копии, и **не разобранный** на
колонки: разбор здесь означал бы вторую модель данных рядом с `models.ts`. Читает её только
хозяин — политика одна, `auth.uid() = user_id`, и друзья в неё не входят.

`road_snapshots` — то же самое за прошлые дни, по снимку на день, две недели назад. Пишет туда
только триггер, читает только хозяин. Это ответ на единственную беду, от которой `roads` не
защищает: строка там одна, и то, что уехало в неё по ошибке, затирает предыдущее навсегда.

`friend_requests`, `friendships`, `blocks` — связи. Три таблицы, а не колонка «состояние»: у
заявки есть направление, у дружбы его нет, у блокировки оно одностороннее. Заявку и дружбу видят
только двое, блокировку — только тот, кто её поставил: список «кто меня закрыл» — это ровно то
сообщение, которого блокировка не посылает.

`reports` — жалобы. Писать может любой вошедший и только от своего имени, читать — никто:
политики на select нет ни одной. Читают их не из приложения.

И главное про обе дороги: `the-way:v1` в localStorage остаётся **источником правды**. Приложение PWA,
день отмечается без сети, и сервер держит копию, а не оригинал. Поэтому история скачивается сама
только на пустое устройство; когда дорога есть с обеих сторон, приложение спрашивает — в профиле,
рядом с восстановлением из файла.
