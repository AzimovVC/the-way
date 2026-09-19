-- Доказательство политик: то, чего вошедший **не может**.
--
-- Ключ в бандле публичный, и всё, что стоит между чужим человеком и твоей дорогой, — политики из
-- migrations/. Прочитать их глазами мало: политика, написанная правильно и не включённая, читается
-- ровно так же, как включённая. Этот файл заводит двух людей, входит каждым из них по очереди и
-- проверяет запреты руками.
--
-- Запускается в SQL Editor целиком, на **рабочем** проекте. Это безопасно: всё живёт внутри одного
-- `do`-блока, то есть одной транзакции. Провал любой проверки поднимает исключение — и транзакция
-- откатывается вместе с тестовыми людьми; успех доходит до `delete` в конце и убирает их сам.
-- Оставить за собой строку этот файл не может ни при каком исходе.
--
-- Почему один блок, а не тридцать отдельных запросов: `set local role` живёт до конца транзакции, а
-- редактор вправе отправить каждый запрос своим. Разъехавшись по транзакциям, тест продолжил бы
-- работать от `postgres` — роли, которая политики **обходит**, — и радостно прошёл бы весь список,
-- ничего не проверив. Молча проходящий тест безопасности хуже отсутствующего.

do $$
declare
  anna  uuid := '00000000-0000-0000-0000-0000000000a1';
  boris uuid := '00000000-0000-0000-0000-0000000000b2';
  -- Третий нужен живым, но пустым: попытка завести строку на чужой id должна упереться в политику,
  -- а не в первичный ключ. На занятом id вместо «не твоё» пришло бы «уже есть», и запрет остался
  -- бы непроверенным.
  chuzhoy uuid := '00000000-0000-0000-0000-0000000000c3';
  n int;
  flag boolean;
begin
  -- 1. Сначала само включение. Политики на таблице без RLS — это комментарии.
  if not (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass) then
    raise exception 'RLS выключен на profiles — таблица открыта всем, у кого есть публичный ключ';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.roads'::regclass) then
    raise exception 'RLS выключен на roads — чужую дорогу читает кто угодно';
  end if;
  if to_regclass('public.road_snapshots') is null then
    raise exception 'Нет таблицы road_snapshots — не применён migrations/0003_road_snapshots.sql';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.road_snapshots'::regclass) then
    raise exception 'RLS выключен на road_snapshots — вчерашняя история читается кем угодно';
  end if;

  -- Двое живых и один пустой. Пароля нет: входить по-настоящему тут нечем и незачем — проверяются
  -- политики, а они читают только `auth.uid()`.
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', anna,    'authenticated', 'authenticated',
     'rls-anna@example.test',  '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', boris,   'authenticated', 'authenticated',
     'rls-boris@example.test', '', now(), now(), now()),
    ('00000000-0000-0000-0000-000000000000', chuzhoy, 'authenticated', 'authenticated',
     'rls-chuzhoy@example.test', '', now(), now(), now());

  insert into public.profiles (id, handle, name, days_on_road, current_streak, habit_count)
  values (anna, 'rlsanna', 'Анна', 10, 3, 2),
         (boris, 'rlsboris', 'Борис', 40, 12, 5);

  insert into public.roads (user_id, version, state)
  values (anna,  1, '{"whose":"anna","gen":1}'::jsonb),
         (boris, 1, '{"whose":"boris","gen":1}'::jsonb);

  -- Две замены подряд, в один день. Первая обязана оставить снимок первого поколения, вторая —
  -- не тронуть его: снимок дня хранит то, чем аккаунт кончил предыдущий, и сегодняшняя беда не
  -- должна переписывать сегодняшний снимок вместе с самой дорогой.
  update public.roads set state = '{"whose":"anna","gen":2}'::jsonb   where user_id = anna;
  update public.roads set state = '{"whose":"anna","gen":3}'::jsonb   where user_id = anna;
  update public.roads set state = '{"whose":"boris","gen":2}'::jsonb  where user_id = boris;

  -- Дальше всё от имени Анны. `set local` вернётся сам на конце транзакции, но ниже стоит и явный
  -- `reset role`: уборку делает хозяин таблиц, а не она.
  perform set_config('request.jwt.claims', json_build_object('sub', anna, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 2. Профили видны вошедшим — это решение, а не недосмотр: карточка по нику иначе пустая.
  select count(*) into n from public.profiles where id in (anna, boris);
  if n <> 2 then
    raise exception 'Вошедший видит % профиля из 2 — ссылка-приглашение открывалась бы пустой карточкой', n;
  end if;

  -- 3. Дорога — своя и только своя.
  select count(*) into n from public.roads;
  if n <> 1 then
    raise exception 'Анна видит % дорог вместо одной своей', n;
  end if;
  select count(*) into n from public.roads where user_id = boris;
  if n <> 0 then
    raise exception 'Анна читает дорогу Бориса — это вся история его привычек';
  end if;

  -- 4. Не читает — значит и не переписывает. Молчаливое `0 строк` здесь и есть отказ: политика
  --    не показывает чужую строку, поэтому менять нечего.
  update public.roads set state = '{"whose":"hacked"}'::jsonb where user_id = boris;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'Анна переписала дорогу Бориса (% строк)', n;
  end if;

  delete from public.roads where user_id = boris;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'Анна стёрла дорогу Бориса (% строк)', n;
  end if;

  -- 5. И не заводит дорогу на чужое имя. Здесь отказ громкий: строки ещё нет, `with check` смотрит
  --    на ту, которую пытаются положить. Без `with check` эта вставка прошла бы — `using` про неё
  --    ничего не знает.
  begin
    insert into public.roads (user_id, version, state) values (chuzhoy, 1, '{"whose":"anna"}'::jsonb);
    raise exception 'Анна завела дорогу на чужой user_id — в политике нет with check';
  exception
    when insufficient_privilege then null;
  end;

  -- 6. Чужой профиль читается, но не правится.
  update public.profiles set name = 'не Борис', handle = 'rlsanna2' where id = boris;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'Анна переименовала Бориса (% строк)', n;
  end if;

  begin
    insert into public.profiles (id, handle, name) values (chuzhoy, 'rlschuzhoy', 'Чужой');
    raise exception 'Анна завела профиль на чужой id — в политике insert нет with check';
  exception
    when insufficient_privilege then null;
  end;

  -- 7. Ник. Функция отвечает про всех, но отдаёт «да/нет» — и свой собственный считает свободным,
  --    иначе сохранение профиля без правки ника жаловалось бы на него самого.
  if public.handle_available('rlsboris') then
    raise exception 'Занятый ник объявлен свободным — экран пообещал бы то, чего база не даст';
  end if;
  if not public.handle_available('rlsanna') then
    raise exception 'Свой собственный ник объявлен занятым';
  end if;
  if not public.handle_available('rlsnikogo') then
    raise exception 'Свободный ник объявлен занятым';
  end if;
  -- Регистр: клиент нормализует набранное, но проверку формы держит эта сторона.
  if public.handle_available('RLSBORIS') then
    raise exception 'Занятый ник в верхнем регистре объявлен свободным';
  end if;

  -- 8. Снимки: своё видно, чужого нет, и писать сюда клиент не может вовсе.
  select count(*) into n from public.road_snapshots;
  if n <> 1 then
    raise exception 'Анна видит % снимков вместо одного своего', n;
  end if;
  select (state->>'whose') = 'anna' and (state->>'gen') = '1' into flag from public.road_snapshots;
  if not coalesce(flag, false) then
    raise exception 'Снимок не тот: либо чужой, либо переписан второй выгрузкой того же дня';
  end if;
  select count(*) into n from public.road_snapshots where user_id = boris;
  if n <> 0 then
    raise exception 'Анна читает вчерашнюю историю Бориса';
  end if;

  -- Политик на запись у таблицы нет ни одной, поэтому отказ громкий даже на своей строке: снимок
  -- кладёт триггер, и подделать его нечем.
  begin
    insert into public.road_snapshots (user_id, taken_on, version, state)
    values (anna, current_date - 1, 1, '{"whose":"подделка"}'::jsonb);
    raise exception 'Клиент завёл снимок сам — у road_snapshots появилась политика insert';
  exception
    when insufficient_privilege then null;
  end;

  -- Здесь отказ бывает двух видов, и оба годятся: политики нет — ноль строк; права на таблицу не
  -- выданы — исключение. Проверяется «не вышло», а не то, каким именно словом не вышло.
  begin
    update public.road_snapshots set state = '{"whose":"подделка"}'::jsonb where user_id = anna;
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'Анна переписала собственный снимок (% строк) — вторая копия портится тем же, чем первая', n;
    end if;

    delete from public.road_snapshots where user_id = anna;
    get diagnostics n = row_count;
    if n <> 0 then
      raise exception 'Анна стёрла собственный снимок (% строк)', n;
    end if;
  exception
    when insufficient_privilege then null;
  end;

  -- 9. Теперь Борисом — чтобы «не видно» не оказалось «таблица пуста для всех».
  perform set_config('request.jwt.claims', json_build_object('sub', boris, 'role', 'authenticated')::text, true);
  select count(*) into n from public.roads;
  if n <> 1 then
    raise exception 'Борис видит % дорог вместо одной своей', n;
  end if;
  select (state->>'whose') = 'boris' into flag from public.roads;
  if not coalesce(flag, false) then
    raise exception 'Борис видит не свою дорогу';
  end if;

  -- 10. И невошедший. `anon` — это тот же публичный ключ до всякого письма: политики выписаны
  --    `to authenticated`, и для него обе таблицы обязаны быть пустыми.
  perform set_config('request.jwt.claims', '', true);
  -- Через `postgres`, а не напрямую: `authenticated` не состоит в `anon`, и переход между ними
  -- упёрся бы в права ролей, не дойдя до политик.
  execute 'reset role';
  execute 'set local role anon';

  -- Отказ в правах на саму таблицу — тоже «не видит», причём строже. Поэтому он здесь не падение.
  begin
    select count(*) into n from public.profiles;
    if n <> 0 then
      raise exception 'Невошедший видит % профилей — ники и серии читает кто угодно', n;
    end if;
    select count(*) into n from public.roads;
    if n <> 0 then
      raise exception 'Невошедший видит % дорог', n;
    end if;
    select count(*) into n from public.road_snapshots;
    if n <> 0 then
      raise exception 'Невошедший видит % снимков', n;
    end if;
  exception
    when insufficient_privilege then null;
  end;

  -- Уборка от хозяина таблиц: `on delete cascade` уносит профили и дороги вместе с людьми.
  execute 'reset role';
  delete from auth.users where id in (anna, boris, chuzhoy);
end;
$$;

select 'RLS: все проверки прошли, тестовые люди удалены' as result;
