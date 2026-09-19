-- Дружбы, заявки и блокировки: связи между людьми.
--
-- Порядок в файле тот же, что в 0001–0003, и он несущий: таблица, `enable row level security`,
-- политики — до того, как в неё попадёт первая строка. Ключ у клиента публичный, лежит в бандле,
-- и всё, что стоит между чужим человеком и твоими связями, — эти политики.
--
-- Три таблицы, а не одна колонка «состояние»: у заявки есть направление, у дружбы направления нет,
-- у блокировки оно есть и оно одностороннее. Сведённые в один ряд, они дали бы строку, которая
-- одновременно «заявка» и «дружба», — состояние, у которого нет правильного экрана
-- (см. `FriendState` в src/social/types.ts).
--
-- **Правила живут в политиках, а не в функциях.** Функции ниже — все `security invoker`, кроме
-- трёх, где это объяснено поимённо: они собирают ответ и делают правку одной транзакцией, но
-- запрещает всё политика. Клиент с публичным ключом ходит и прямо в таблицы, минуя функции, и
-- правило, живущее в функции, для него не существует вовсе.
--
-- Файл запускается повторно без вреда.

-- ---------------------------------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------------------------------

create table if not exists public.friend_requests (
  -- Заявка направленная: «отправил» и «пришла» — разные состояния, и второе требует ответа.
  from_id uuid not null references auth.users on delete cascade,
  to_id   uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),

  -- Одна заявка на пару в одну сторону. Повторное нажатие — это та же заявка, а не вторая.
  primary key (from_id, to_id),
  constraint friend_requests_not_self check (from_id <> to_id)
);

-- Входящие спрашиваются так же часто, как исходящие, а первичный ключ помогает только вторым.
create index if not exists friend_requests_to_idx on public.friend_requests (to_id);

create table if not exists public.friendships (
  -- Дружба **взаимна**, поэтому строка одна, а не две. Две строки — это две записи об одном
  -- факте, и в день, когда одна из них не удалится, человек останется в друзьях у того, у кого
  -- его больше нет.
  --
  -- Порядок пары не значит ничего: `a_id < b_id` — способ записать «пара» первичным ключом, а
  -- не «кто позвал». Кто позвал, знает заявка, и она к этому моменту уже удалена.
  a_id uuid not null references auth.users on delete cascade,
  b_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),

  primary key (a_id, b_id),
  constraint friendships_ordered check (a_id < b_id)
);

create index if not exists friendships_b_idx on public.friendships (b_id);

create table if not exists public.blocks (
  -- Блокировка односторонняя и вторая сторона про неё не знает. Отсюда и политика на чтение:
  -- свои строки видит только тот, кто их завёл.
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),

  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- «Кто закрыл меня» спрашивается в политике на каждый читаемый профиль — это самый горячий
-- запрос из трёх таблиц.
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),

  -- `default auth.uid()`, и клиент его не присылает вовсе. Поле, которое присылают, — это поле,
  -- которое можно прислать чужим: политика такую жалобу отвергнет, но заполнять её собой, чтобы
  -- сервер согласился, — работа, которую незачем перекладывать на экран.
  reporter_id uuid not null default auth.uid() references auth.users on delete cascade,
  target_id   uuid not null references auth.users on delete cascade,

  -- Ровно то, что предлагает экран (`ReportReason` в src/social/client.ts). Пункта «другое» нет:
  -- без строки ввода он не говорит ничего, а строка ввода — это переписка, на которую здесь
  -- некому отвечать.
  reason text not null check (reason in ('offensive', 'impersonation', 'spam')),
  created_at timestamptz not null default now(),

  constraint reports_not_self check (reporter_id <> target_id)
);

alter table public.friend_requests enable row level security;
alter table public.friendships     enable row level security;
alter table public.blocks          enable row level security;
alter table public.reports         enable row level security;

-- Права на таблицу — второй замок, и он грубее политик: там, где политики нет вовсе, нет и права.
-- У заявок, дружб и блокировок не бывает `update` (правят не строку, а связь: исчезла одна,
-- появилась другая), а у жалоб не бывает чтения — их читают не отсюда.
--
-- Выписано руками, а не оставлено на умолчания проекта: умолчание раздаёт права всем ролям сразу,
-- включая `anon`, и «пусто, потому что политика» выглядит там же, где «пусто, потому что ролям не
-- дали» — но держится на настройке, которой в этом файле не видно.
revoke all on public.friend_requests, public.friendships, public.blocks, public.reports
  from anon, authenticated;

grant select, insert, delete on public.friend_requests to authenticated;
grant select, insert, delete on public.friendships     to authenticated;
grant select, insert, delete on public.blocks          to authenticated;
grant insert                 on public.reports         to authenticated;

-- ---------------------------------------------------------------------------------------------
-- «Он меня закрыл?» — единственный вопрос, который задают все политики сразу
-- ---------------------------------------------------------------------------------------------

-- `security definer`, и это одно из трёх исключений в файле.
--
-- Читать `blocks` напрямую политикам нельзя: строку видит только тот, кто её завёл, — иначе
-- заблокированный получил бы список тех, кто его закрыл, то есть ровно ту новость, которой
-- блокировка не сообщает. Функция отвечает **про одного человека и только «да/нет»**, ровно как
-- `handle_available` в 0001: узнать отсюда, кто ещё тебя закрыл, нельзя.
--
-- `stable`, а не `volatile`: её зовут на каждую читаемую строку профиля.
create or replace function public.blocks_me(other uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.blocks
    where blocker_id = other and blocked_id = auth.uid()
  );
$$;

revoke execute on function public.blocks_me(uuid) from public;
grant execute on function public.blocks_me(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Профили: то самое сужение, обещанное в 0001
-- ---------------------------------------------------------------------------------------------

-- Заблокированный не видит **ничего**: ни карточки, ни чисел, ни самого факта, что такой ник
-- существует. Профиль пропадает целиком, а не гаснет наполовину, потому что половинный ответ —
-- это и есть сообщение «тебя закрыли», которого блокировка не делает.
--
-- Обратной стороны у этого нет: закрывший **видит** закрытого, иначе полка заблокированных в
-- настройках была бы списком идентификаторов, а снять блокировку значило бы снять её вслепую.
--
-- Своя строка стоит первой в `or` и не зовёт функцию вовсе: себя не блокируют (`blocks_not_self`),
-- а читает свой профиль каждый вошедший на каждом запуске.
drop policy if exists "профиль виден вошедшим" on public.profiles;
drop policy if exists "профиль виден вошедшим, кроме заблокированных" on public.profiles;
create policy "профиль виден вошедшим, кроме заблокированных"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or not public.blocks_me(id));

-- Поиск идёт по началу ника, а уникальный индекс на `handle` для `like 'abc%'` не годится:
-- в нелатинской сортировке (у проекта она по умолчанию) btree упорядочен не побайтово, и
-- планировщик им не пользуется. `text_pattern_ops` — индекс ровно под этот запрос.
create index if not exists profiles_handle_prefix_idx
  on public.profiles (handle text_pattern_ops);

-- ---------------------------------------------------------------------------------------------
-- Политики: заявки
-- ---------------------------------------------------------------------------------------------

-- Заявку видят двое — и больше никто. Третий не знает ни того, что ты кого-то позвал, ни того,
-- что позвали тебя.
drop policy if exists "заявка видна двоим" on public.friend_requests;
create policy "заявка видна двоим"
  on public.friend_requests for select
  to authenticated
  using (auth.uid() in (from_id, to_id));

-- Зовёшь только сам и только от своего имени. Остальные три условия — это правила, которые
-- иначе пришлось бы держать в клиенте, то есть не держать вовсе:
--
--   * тот, кто тебя закрыл, не получает заявок — иначе блокировка не сделала бы того, о чём её
--     просили, а заявка ещё и сообщила бы закрывшему, что ты про него помнишь;
--   * закрытому тобой не пишут: это твоё же решение, и обходить его кнопкой странно;
--   * встречной заявки не бывает. На заявку отвечают дружбой (`friend_request` ниже это и
--     делает), а вторая строка навстречу дала бы пару, которая одновременно «позвал» и «позвали»;
--   * друзьям не зовут: связь уже есть.
drop policy if exists "заявку отправляешь сам" on public.friend_requests;
create policy "заявку отправляешь сам"
  on public.friend_requests for insert
  to authenticated
  with check (
    from_id = auth.uid()
    and not public.blocks_me(to_id)
    and not exists (
      select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = to_id
    )
    and not exists (
      select 1 from public.friend_requests r where r.from_id = to_id and r.to_id = auth.uid()
    )
    and not exists (
      select 1 from public.friendships
      where a_id = least(auth.uid(), to_id) and b_id = greatest(auth.uid(), to_id)
    )
  );

-- Отмена и отказ — одно правило: заявка кончается по решению любого из двоих. Разные слова на
-- экране, одна операция здесь.
drop policy if exists "заявку убирает любой из двоих" on public.friend_requests;
create policy "заявку убирает любой из двоих"
  on public.friend_requests for delete
  to authenticated
  using (auth.uid() in (from_id, to_id));

-- Политики на update нет: у заявки нечего править. Принятая заявка — это другая строка в другой
-- таблице, а не та же самая с новым словом в колонке.

-- ---------------------------------------------------------------------------------------------
-- Политики: дружба
-- ---------------------------------------------------------------------------------------------

drop policy if exists "дружба видна двоим" on public.friendships;
create policy "дружба видна двоим"
  on public.friendships for select
  to authenticated
  using (auth.uid() in (a_id, b_id));

-- **Дружба заводится только ответом на заявку.** Это и есть «чужую заявку не примешь» и «в друзья
-- себя не впишешь» одной строкой: нужна живая заявка **тебе** от того, с кем ты записываешь пару.
-- Без этого условия любой вошедший вписывал бы себя в друзья к кому угодно одним запросом.
--
-- Отсюда следует порядок в `friend_accept`: сначала вставить дружбу, потом удалить заявку.
-- Наоборот — и политика не найдёт того, чем этот шаг разрешён.
drop policy if exists "дружба заводится по заявке" on public.friendships;
create policy "дружба заводится по заявке"
  on public.friendships for insert
  to authenticated
  with check (
    auth.uid() in (a_id, b_id)
    and exists (
      select 1 from public.friend_requests
      where to_id = auth.uid()
        and from_id = case when a_id = auth.uid() then b_id else a_id end
    )
    and not public.blocks_me(case when a_id = auth.uid() then b_id else a_id end)
    and not exists (
      select 1 from public.blocks
      where blocker_id = auth.uid()
        and blocked_id = case when a_id = auth.uid() then b_id else a_id end
    )
  );

-- Уходят из дружбы в одиночку: согласия второго на это не спрашивают, как не спрашивают согласия
-- на блокировку.
drop policy if exists "из дружбы выходит любой из двоих" on public.friendships;
create policy "из дружбы выходит любой из двоих"
  on public.friendships for delete
  to authenticated
  using (auth.uid() in (a_id, b_id));

-- ---------------------------------------------------------------------------------------------
-- Политики: блокировки
-- ---------------------------------------------------------------------------------------------

-- Только свои. Заблокированный не видит строку про себя, и это не вежливость: список «кто меня
-- закрыл» — это ровно то сообщение, которого блокировка не посылает.
drop policy if exists "свои блокировки" on public.blocks;
create policy "свои блокировки"
  on public.blocks for select
  to authenticated
  using (blocker_id = auth.uid());

drop policy if exists "закрываешь сам" on public.blocks;
create policy "закрываешь сам"
  on public.blocks for insert
  to authenticated
  with check (blocker_id = auth.uid());

drop policy if exists "снимаешь сам" on public.blocks;
create policy "снимаешь сам"
  on public.blocks for delete
  to authenticated
  using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Политики: жалобы
-- ---------------------------------------------------------------------------------------------

-- Жалоба уходит **людям, которые будут её читать**, и читают её не отсюда. Политики на select нет
-- ни одной — ни своих жалоб, ни чужих: жалоба, которую видно в приложении, немедленно становится
-- разговором, а отвечать в нём некому. И подсчитать, на кого жалуются, тоже нельзя.
drop policy if exists "жалуешься сам" on public.reports;
create policy "жалуешься сам"
  on public.reports for insert
  to authenticated
  with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Вид целиком: то, что возвращает каждая правка
-- ---------------------------------------------------------------------------------------------

-- Люди по списку идентификаторов, готовой формой. Колонки названы как в таблице — раскладывает их
-- в `Person` чистый TypeScript рядом с тестом (src/social/friendRow.ts), как это уже сделано у
-- профиля.
--
-- Политика на `profiles` действует и здесь: закрывший тебя человек выпадает из любого списка сам,
-- даже если строка связи с ним ещё жива.
create or replace function public.people_json(ids uuid[]) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'handle', p.handle,
        'name', p.name,
        'days_on_road', p.days_on_road,
        'current_streak', p.current_streak,
        'habit_count', p.habit_count
      ) order by p.handle
    ),
    '[]'::jsonb
  )
  from public.profiles p
  where p.id = any(ids);
$$;

-- Всё, что слой знает про твои связи, одним куском — и одним запросом.
--
-- Четыре списка приезжают вместе, потому что любая правка возвращает **весь** вид: после
-- «Заблокировать» экран не имеет права знать о человеке меньше, чем знал секунду назад.
--
-- Условия выписаны явно, хотя политики говорят то же самое. Функция обязана читаться в одиночку:
-- «здесь фильтрует RLS» — это правильная фраза ровно до первого дня, когда её позовут из-под
-- `security definer`, где RLS не действует.
create or replace function public.friends_view() returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'friends', public.people_json(array(
      select case when a_id = auth.uid() then b_id else a_id end
      from public.friendships where auth.uid() in (a_id, b_id)
    )),
    'incoming', public.people_json(array(
      select from_id from public.friend_requests where to_id = auth.uid()
    )),
    'outgoing', public.people_json(array(
      select to_id from public.friend_requests where from_id = auth.uid()
    )),
    'blocked', public.people_json(array(
      select blocked_id from public.blocks where blocker_id = auth.uid()
    ))
  );
$$;

-- В каком отношении к тебе стоит один человек. Ровно одно значение — тот же ряд, что `FriendState`
-- в клиенте, и по той же причине: два поля дали бы человека, который одновременно друг и закрыт.
create or replace function public.friend_link_state(other uuid) returns text
language sql stable set search_path = public, pg_temp as $$
  select case
    when other = auth.uid() then 'none'
    when exists (
      select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = other
    ) then 'blocked'
    when exists (
      select 1 from public.friendships
      where a_id = least(auth.uid(), other) and b_id = greatest(auth.uid(), other)
    ) then 'friends'
    when exists (
      select 1 from public.friend_requests where from_id = auth.uid() and to_id = other
    ) then 'outgoing'
    when exists (
      select 1 from public.friend_requests where from_id = other and to_id = auth.uid()
    ) then 'incoming'
    else 'none'
  end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Правки связей. Каждая — одной транзакцией, и каждая возвращает вид целиком
-- ---------------------------------------------------------------------------------------------

-- Позвать.
--
-- Тому, кто уже позвал тебя, отвечают **дружбой**, а не второй заявкой навстречу: это решение
-- сервера, и оно здесь, а не в клиенте, потому что знает о встречной заявке только он — она могла
-- прийти секунду назад, пока экран показывал кнопку «Позвать».
create or replace function public.friend_request(target uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  if exists (
    select 1 from public.friend_requests where from_id = target and to_id = auth.uid()
  ) then
    return public.friend_accept(target);
  end if;

  -- Повторное нажатие — та же заявка. `do nothing`, а не ошибка: человек нажал дважды, а не
  -- сделал что-то запрещённое.
  insert into public.friend_requests (from_id, to_id)
  values (auth.uid(), target)
  on conflict do nothing;

  return public.friends_view();
end;
$$;

-- Принять.
--
-- Порядок внутри несущий: **сначала дружба, потом удаление заявки**. Разрешение на вставку
-- политика ищет в живой заявке (см. «дружба заводится по заявке»), и удалённая раньше времени
-- заявка означала бы отказ в правах на собственное согласие.
--
-- Принять чужую заявку — ту, что адресована не тебе, — здесь нечем: политика смотрит `to_id =
-- auth.uid()`, и вставка упирается в неё, а не в проверку внутри функции.
create or replace function public.friend_accept(other uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  insert into public.friendships (a_id, b_id)
  values (least(auth.uid(), other), greatest(auth.uid(), other))
  on conflict do nothing;

  delete from public.friend_requests
  where (from_id = other and to_id = auth.uid())
     or (from_id = auth.uid() and to_id = other);

  return public.friends_view();
end;
$$;

-- Развязаться: отменить свою заявку, отказать чужой, уйти из друзей.
--
-- Одна функция на три кнопки, потому что **на сервере это одно и то же**: связи между вами больше
-- нет. Три тела с одинаковой серединой — это три места, где однажды разойдутся правила, и два из
-- них об этом не узнают. Разные слова живут на экране, где они и правда разные.
create or replace function public.friend_unlink(other uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from public.friendships
  where a_id = least(auth.uid(), other) and b_id = greatest(auth.uid(), other);

  delete from public.friend_requests
  where (from_id = auth.uid() and to_id = other)
     or (from_id = other and to_id = auth.uid());

  return public.friends_view();
end;
$$;

-- Закрыть.
--
-- Блокировка **снимает дружбу и обе заявки** — другого способа стоять в ряду `FriendState` у неё
-- нет. Блокировка, тихо оставившая тебя в чьих-то друзьях, обещает больше, чем делает.
create or replace function public.friend_block(other uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from public.friendships
  where a_id = least(auth.uid(), other) and b_id = greatest(auth.uid(), other);

  delete from public.friend_requests
  where (from_id = auth.uid() and to_id = other)
     or (from_id = other and to_id = auth.uid());

  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), other)
  on conflict do nothing;

  return public.friends_view();
end;
$$;

-- Снять блокировку — и вернуть в «никто», а не в друзья. Дружбу складывали вдвоём, и вернуть её
-- односторонним нажатием значило бы записать второго обратно без его ведома.
create or replace function public.friend_unblock(other uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = other;
  return public.friends_view();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Кого искать и кого предлагать
-- ---------------------------------------------------------------------------------------------

-- Поиск **по нику**, по началу ника, и пустой запрос отдаёт пусто.
--
-- Набранное чистится до того, из чего вообще состоит ник (`^[a-z0-9_]+$`), и причина не в
-- аккуратности: `%` и `_` — это подстановки `like`, и запрос из одного `%` вернул бы всех
-- подряд — ровно тот список, которого здесь не должно быть никогда. После чистки `_` ещё и
-- экранируется: ник `a_b` ищут буквально.
--
-- Закрывшие тебя не приезжают сами — их снимает политика на `profiles`; закрытых тобой снимает
-- условие ниже: выдача, оставившая человека в списке, — это блокировка, не сделавшая того, о чём
-- её просили.
create or replace function public.friends_search(q text) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  with needle as (
    select regexp_replace(lower(btrim(coalesce(q, ''))), '[^a-z0-9_]', '', 'g') as clean
  )
  select coalesce(
    jsonb_agg(found order by found->'person'->>'handle'),
    '[]'::jsonb
  )
  from (
    select jsonb_build_object(
      'person', jsonb_build_object(
        'id', p.id,
        'handle', p.handle,
        'name', p.name,
        'days_on_road', p.days_on_road,
        'current_streak', p.current_streak,
        'habit_count', p.habit_count
      ),
      'state', public.friend_link_state(p.id)
    ) as found
    from public.profiles p, needle n
    where n.clean <> ''
      and p.id <> auth.uid()
      and p.handle like replace(n.clean, '_', '\_') || '%'
      and not exists (
        select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = p.id
      )
    -- Порядок до `limit`, а не после: без него двадцать выданных из тридцати — случайные двадцать,
    -- и один и тот же запрос дважды подряд отвечает по-разному.
    order by p.handle
    limit 20
  ) hits;
$$;

-- С кем дружите вы оба.
--
-- `security definer` — второе исключение в файле, и оно здесь по существу дела: пересечение
-- нельзя посчитать, не заглянув в **его** список друзей, а этого списка у тебя нет и права его
-- читать тоже. Наружу при этом уходит только пересечение с твоим собственным кругом: ни одного
-- имени, которого ты и так не знаешь, и никогда — «сколько у него друзей». Популярность — это
-- шкала, на которой кто-то всегда внизу, а общие друзья — ответ на вопрос, который человек и
-- правда задаёт, глядя на незнакомый ник.
--
-- Внутри `definer` политики не действуют, поэтому каждое условие выписано руками — включая то,
-- которое обычно делает политика на профилях: закрывший тебя человек не должен всплыть даже
-- общим другом.
create or replace function public.mutual_friends(other uuid) returns jsonb
language sql security definer stable set search_path = public, pg_temp as $$
  with mine as (
    select case when a_id = auth.uid() then b_id else a_id end as id
    from public.friendships where auth.uid() in (a_id, b_id)
  ),
  theirs as (
    select case when a_id = other then b_id else a_id end as id
    from public.friendships where other in (a_id, b_id)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'handle', p.handle, 'name', p.name) order by p.handle
    ),
    '[]'::jsonb
  )
  from public.profiles p
  where p.id in (select id from mine intersect select id from theirs)
    and not public.blocks_me(p.id);
$$;

-- Чужой профиль по нику, или `null`, если такого ника нет.
--
-- Для закрывшего тебя человека здесь тоже `null`, и это не обход правила, а оно само: его профиль
-- не виден, а «ник есть, но показать нечего» — это и есть сообщение о блокировке.
--
-- Про **закрытого тобой** не приезжает ничего, кроме имени и ника: числа и общие друзья — это то,
-- что человек показывает тебе, а блокировка ровно это и отменила. Снимает их эта сторона, а не
-- экран: присланное и ненарисованное — утечка, до которой один тап в инструментах разработчика.
-- Имя с ником остаются, потому что полка заблокированных в настройках иначе была бы списком
-- идентификаторов, а снять блокировку значило бы снять её вслепую.
create or replace function public.friend_profile(wanted text) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select case
    when link.state = 'blocked' then jsonb_build_object(
      'person', jsonb_build_object('id', p.id, 'handle', p.handle, 'name', p.name),
      'state', 'blocked',
      'mutual', '[]'::jsonb
    )
    else jsonb_build_object(
      'person', jsonb_build_object(
        'id', p.id,
        'handle', p.handle,
        'name', p.name,
        'days_on_road', p.days_on_road,
        'current_streak', p.current_streak,
        'habit_count', p.habit_count
      ),
      'state', link.state,
      'mutual', public.mutual_friends(p.id)
    )
  end
  from public.profiles p,
       lateral (select public.friend_link_state(p.id) as state) link
  where p.handle = regexp_replace(lower(btrim(coalesce(wanted, ''))), '^@', '')
  limit 1;
$$;

-- «Может быть, знакомы» — друзья твоих друзей, и больше ничего.
--
-- `security definer` — третье и последнее исключение, по той же причине, что у общих друзей:
-- утверждение «его знает твой друг» нельзя проверить, не прочитав чужие связи. Наружу уходит
-- только сам человек и то, кем он тебе приходится; **чей именно он друг, не говорится** — это
-- уже рассказ о чужих связях, которого никто не просил.
--
-- Порядок — по числу общих друзей: если знакомых двое, это «скорее знакомы», чем один.
-- Четверо, потому что это догадка, а не выдача: список, который листают, обещает, что дальше в
-- нём кто-то есть.
create or replace function public.friend_suggestions() returns jsonb
language sql security definer stable set search_path = public, pg_temp as $$
  with mine as (
    select case when a_id = auth.uid() then b_id else a_id end as id
    from public.friendships where auth.uid() in (a_id, b_id)
  ),
  theirs as (
    select case when f.a_id = m.id then f.b_id else f.a_id end as id
    from public.friendships f join mine m on m.id in (f.a_id, f.b_id)
  ),
  ranked as (
    select id, count(*) as weight
    from theirs
    where id <> auth.uid()
      and id not in (select id from mine)
      and not exists (
        select 1 from public.friend_requests
        where (from_id = auth.uid() and to_id = theirs.id)
           or (from_id = theirs.id and to_id = auth.uid())
      )
      and not exists (
        select 1 from public.blocks
        where (blocker_id = auth.uid() and blocked_id = theirs.id)
           or (blocker_id = theirs.id and blocked_id = auth.uid())
      )
    group by id
    order by weight desc, id
    limit 4
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'person', jsonb_build_object(
          'id', p.id,
          'handle', p.handle,
          'name', p.name,
          'days_on_road', p.days_on_road,
          'current_streak', p.current_streak,
          'habit_count', p.habit_count
        ),
        'state', 'none'
      ) order by r.weight desc, p.handle
    ),
    '[]'::jsonb
  )
  from ranked r join public.profiles p on p.id = r.id;
$$;

-- ---------------------------------------------------------------------------------------------
-- Права на вызов
-- ---------------------------------------------------------------------------------------------

-- Невошедшему не отвечает ни одна: политики выписаны `to authenticated`, и функция, открытая
-- `anon`, обошла бы их с той стороны, где их никто не ищет.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.people_json(uuid[])',
    'public.friends_view()',
    'public.friend_link_state(uuid)',
    'public.friend_request(uuid)',
    'public.friend_accept(uuid)',
    'public.friend_unlink(uuid)',
    'public.friend_block(uuid)',
    'public.friend_unblock(uuid)',
    'public.friends_search(text)',
    'public.mutual_friends(uuid)',
    'public.friend_profile(text)',
    'public.friend_suggestions()'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end;
$$;
