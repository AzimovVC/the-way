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

6. **Удаление аккаунта.** SQL Editor → [migrations/0005_delete_account.sql](./migrations/0005_delete_account.sql)
   → Run. Одна функция, новых таблиц нет — поэтому нет и строчки про RLS.

   ```sql
   select proname, prosecdef from pg_proc p
     join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'public' and p.proname = 'delete_account';
   ```

   Ждём `delete_account · true`. `true` здесь обязательно: `security definer` — единственное, чем
   клиент вообще может тронуть свою строку в `auth.users`, и функция без него молча не удалит
   ничего.

   Всё остальное уходит **каскадом**: профиль, дорога, снимки, заявки, дружбы, блокировки и жалобы
   висят на `auth.users ... on delete cascade` с первого дня. Новую таблицу с человеком вешай на
   `auth.users`, а не на `profiles`, — тогда удаление не придётся дописывать.

7. **Витрина привычек.** SQL Editor → [migrations/0006_habit_shelf.sql](./migrations/0006_habit_shelf.sql)
   → Run. Названия, значки и набранные дни — и **`friend_profile` заново**, уже с полкой в ответе.

   ```sql
   select
     (select relrowsecurity from pg_class where oid = 'public.habit_shelf'::regclass) as rls,
     (select count(*) from pg_policies where schemaname = 'public' and tablename = 'habit_shelf') as policies,
     (select count(*) from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
       where ns.nspname = 'public' and p.proname = 'shelf_json') as fns;
   ```

   Ждём `true · 4 · 1`. Политик четыре, а не одна на всё: `using` и `with check` отвечают на
   разные вопросы, и политика, отвечающая на оба сразу, читается одинаково и когда права, и когда
   пускает лишнее.

   Это единственная таблица с **чужим свободным текстом**, и вся её защита — политика на чтение:
   друзьям видно, остальным по флагу `habits_public`, который стоит в `profiles` с 0001 ровно под
   неё. Клиент выгружает полку **всегда**, независимо от флага, — придержи он её у себя, полка
   пропала бы заодно и у друзей.

   Тот же `PGRST205`, что в шагах 4 и 5, придёт и здесь — минута или `notify pgrst, 'reload schema';`.

8. **Кружок.** SQL Editor → [migrations/0007_circles.sql](./migrations/0007_circles.sql) → Run.
   Пары, отметки, приглашения и сообщения — плюс колонка `timezone` в `profiles`, без которой
   серверу нечем проверить день отметки.

   ```sql
   select
     (select count(*) from pg_class
       where relname in ('circles','circle_members','circle_marks','circle_invites','notices')
         and relrowsecurity) as rls,
     (select count(*) from pg_policies where schemaname = 'public'
       and tablename in ('circles','circle_members','circle_marks','circle_invites','notices')) as policies,
     (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'timezone') as tz;
   ```

   Ждём `5 · 14 · 1`. Пять из пяти — таблица без RLS открыта всем, у кого есть публичный ключ, а
   ключ лежит в бандле.

   Отдельно стоит проверить то, ради чего здесь вообще есть проверка даты, — она и есть разница
   между парной серией и числом, которое накручивают из консоли:

   ```sql
   select public.logical_day(now(), 'Europe/Kyiv') as today_kyiv,
          public.logical_day(now(), 'America/New_York') as today_ny;
   ```

   Между 3:00 и 4:00 по Киеву эти два дня и правда разные — это не ошибка, а то самое окно
   расхождения, и оно лежит там, где никто не отмечается (решение «каждый в своём дне»).

   Тот же `PGRST205`, что в шагах 4–7, придёт и здесь — минута или `notify pgrst, 'reload schema';`.

9. **Почтовый вход выключен.** Authentication → Sign In / Providers → **Email** → off.

   Дверь в приложении одна, и это Google (решение 8 в [circle.md](../docs/circle.md): почему
   переменено и при каком условии почта вернётся). Выключать провайдер на сервере обязательно, а
   не «для порядка»: ключ у клиента публичный и лежит в бандле, поэтому включённый Email — это
   работающая ручка `/auth/v1/signup`, заводящая аккаунты в обход единственной двери.

   Всё, что настраивалось ради писем, больше не нужно: шаблоны с `{{ .Token }}`, длина кода,
   минимальная длина пароля, свой SMTP. Настроенный SMTP можно оставить — он пригодится, когда
   появится домен, и не мешает, пока провайдер выключен.

10. **Вход через Google.** Три места, и пропущенное третье — самая частая причина «ничего не
   происходит».

   - **Google Cloud Console** → APIs & Services → Credentials → Create credentials → OAuth client
     ID → Web application. В **Authorized redirect URIs** — ровно один адрес, и это адрес
     *Supabase*, а не приложения: `https://ТВОЙ-REF.supabase.co/auth/v1/callback`, где `ТВОЙ-REF` —
     код проекта из `VITE_SUPABASE_URL` в `.env.local`. Вставляется он целиком и без точки в
     конце: на скобки, многоточия и лишние знаки Google отвечает не «плохой адрес», а «The
     attempted action failed» с номером запроса. Там же, в OAuth
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

11. **Ключи.** Project Settings → **API Keys** → **Publishable key** (`sb_publishable_…`) и
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

12. `npm run dev` → Профиль → Настройки → Аккаунт.

13. **Проверить политики руками.** SQL Editor → [tests/rls.sql](./tests/rls.sql) целиком → Run.
   Ждём одну строку: `RLS: все проверки прошли, тестовые люди удалены`. Любой другой ответ — это
   текст проверки, которая не прошла, словами: «Анна читает дорогу Бориса», «Невошедший видит 2
   профиля» и так далее.

   Запросы из шагов 2 и 3 отвечают, **включён** ли RLS; этот файл отвечает, что политики при этом
   запрещают ровно то, что должны. Разница не теоретическая: политика, написанная правильно и
   выписанная не на ту роль, на глаз неотличима от верной.

   Гонять его можно на рабочем проекте и сколько угодно раз. Всё живёт внутри одного `do`-блока,
   то есть одной транзакции: провал откатывает тестовых людей вместе с собой, успех удаляет их
   сам. Запускать после **каждой** правки политик: сузить чужой select блокировками, случайно
   открыв дорогу, легче, чем кажется.

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

`habit_shelf` — витрина привычек: названия, значки и набранные дни. Единственный чужой свободный
текст в приложении, и единственное, что спрятано за настройку: видно друзьям, а остальным — по
флагу `habits_public`. Число «4 привычки» при этом видно всегда и живёт колонкой в `profiles` — оно
ничего не называет. Ступени здесь нет: она выводится из дней по одной лестнице на всех, и
присланная отдельным полем стала бы вторым экземпляром числа, которое уже сказано.

`reports` — жалобы. Писать может любой вошедший и только от своего имени, читать — никто:
политики на select нет ни одной. Читают их не из приложения.

И главное про обе дороги: `the-way:v1` в localStorage остаётся **источником правды**. Приложение PWA,
день отмечается без сети, и сервер держит копию, а не оригинал. Поэтому история скачивается сама
только на пустое устройство; когда дорога есть с обеих сторон, приложение спрашивает — в профиле,
рядом с восстановлением из файла.
