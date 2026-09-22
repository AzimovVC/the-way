-- Лента: события друзей и сердца.
--
-- Части 5 и 9 одним файлом, потому что порознь они уже не существуют. Часть 5 писалась, когда
-- друзья были заглушкой, и обещала «лента друзей на выдуманных людях»; с частью 7 друзья уехали на
-- сервер, и лента на заглушке стала бы экраном, делающим вид, — ровно тем, за что убраны посев
-- кружка и «Посадить связи».
--
-- Решение владельца 22 сентября: **лента одна, вкладок нет**, и свои события подрезаны той же
-- неделей, что и чужие. Поэтому здесь нет ни «своей ленты», ни глубины на месяцы: свой архив — это
-- дорога, где каждый день круг, на который можно нажать.
--
-- Дороги здесь по-прежнему нет и быть не может. Наружу уезжает **то же, что уже видно на витрине**:
-- название привычки, её дни и ступень. Ни одного дня по числам, ни одной отметки, ни процента.
--
-- Отсюда главный запрет файла: **наружу не уезжает ничто, что называет пропуск**. Ни красных дней,
-- ни оборванных серий, ни возвращения — возвращение существует только там, где был спад, и строка
-- «5 дней вниз, потом 3 вверх» на чужом экране рассказывает про провал человека, который её не
-- рассказывал. На своей ленте возвращение остаётся: там оно актив, а не новость о падении.
--
-- Порядок в файле тот же, что в 0001–0006: таблица, `enable row level security`, права, политики —
-- до первой строки данных. Ключ у клиента публичный и лежит в бандле.
--
-- Файл запускается повторно без вреда.

-- ---------------------------------------------------------------------------------------------
-- События
-- ---------------------------------------------------------------------------------------------

create table if not exists public.feed_events (
  user_id uuid not null references auth.users on delete cascade,

  -- Ключ события, и он **выводится, а не чеканится** — единственный такой в приложении. Правило
  -- «ключ приезжает вместе с действием» (`newId` в src/domain/ids.ts) про вещи, которые человек
  -- завёл; событие ленты никто не заводил — оно следствие, как возвращение, и выводится из дороги
  -- на каждом чтении.
  --
  -- Выдуманный ключ здесь стоил бы дорого и молча: восстановивший копию перевыводит ленту целиком,
  -- и события получили бы новые имена — вместе со всеми сердцами, которые на них стояли. Ключ вида
  -- «дата + род + привычка» после восстановления совпадает сам с собой.
  event_id text not null check (char_length(event_id) between 1 and 96),

  -- День, в который это случилось, — логический (граница в 3:00 у той стороны). Не `created_at`:
  -- ступень, взятая в субботу и уехавшая на сервер в понедельник, принадлежит субботе.
  happened_on date not null,

  -- Список закрытый и короткий нарочно. Род обязан иметь свою строку на экране, а свободное
  -- значение здесь означало бы событие, которое некому нарисовать.
  --
  -- Трёх родов хватает, и каждый положителен: ступень, новая привычка, метка дороги. Тихие
  -- события — заморозка и правки расписания — наружу не едут вовсе: это не новости, а служебные
  -- пометки собственной истории.
  kind text not null check (kind in ('rank', 'goal', 'calendar')),

  -- Название привычки или цели: то самое свободное поле, что и на витрине, и закрытое теми же
  -- политиками. У метки дороги названия нет — она называет себя родом.
  title text check (char_length(title) between 1 and 100),

  -- Ступень и дни — у события рода `rank`. Ступень уезжает **словом**, хотя выводится из дней:
  -- лестница живёт в src/domain/ranks.ts, и день, когда она сдвинется, не имеет права переписать
  -- то, что уже случилось у человека. «Ученик» в чужой ленте — запись о прошлом, а не вывод.
  rank text check (char_length(rank) between 1 and 32),
  days int check (days >= 0),

  -- Какая метка дороги — у события рода `calendar`. Недели здесь нет: она ложится каждые семь
  -- дней и в ленте, глубиной в неделю, стояла бы всегда.
  mark text check (char_length(mark) between 1 and 16),

  created_at timestamptz not null default now(),

  primary key (user_id, event_id)
);

-- Лента спрашивает «что было за последнюю неделю», а не «что было у этого человека». Индекс — под
-- тот запрос, который правда идёт.
create index if not exists feed_events_when_idx on public.feed_events (happened_on desc, user_id);

alter table public.feed_events enable row level security;

revoke all on public.feed_events from anon, authenticated;
grant select, insert, update, delete on public.feed_events to authenticated;

-- Событие видно **друзьям, и только друзьям**.
--
-- Настройки `habits_public` здесь нет, в отличие от полки, и это не недосмотр: полка — часть
-- профиля, на который человек приходит нарочно, а лента приходит к человеку сама. Отдать её
-- незнакомым по флажку значило бы завести ту самую публичную ленту, которой в этом приложении
-- нет: без рейтингов, без подписчиков и без чужих глаз, которых не звали.
drop policy if exists "события видны друзьям" on public.feed_events;
create policy "события видны друзьям"
  on public.feed_events for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      not public.blocks_me(user_id)
      and not exists (
        select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = user_id
      )
      and exists (
        select 1 from public.friendships
        where a_id = least(auth.uid(), user_id) and b_id = greatest(auth.uid(), user_id)
      )
    )
  );

-- Свои события заводишь, правишь и убираешь только сам. Три политики вместо одной `for all`, как
-- в 0001 и 0006: `using` и `with check` отвечают на разные вопросы.
drop policy if exists "своё событие заводишь сам" on public.feed_events;
create policy "своё событие заводишь сам"
  on public.feed_events for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "своё событие правишь сам" on public.feed_events;
create policy "своё событие правишь сам"
  on public.feed_events for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "своё событие убираешь сам" on public.feed_events;
create policy "своё событие убираешь сам"
  on public.feed_events for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Сердца
-- ---------------------------------------------------------------------------------------------

-- Реакция ровно одна, и она не текст. Это и есть весь ответ на вопрос «почему не комментарии»:
-- канал свободного текста в чужое приложение — то, от чего закрыты `notices`, и заводить его с
-- другой стороны экрана было бы тем же самым решением, принятым дважды и по-разному.
create table if not exists public.feed_hearts (
  owner_id uuid not null,
  event_id text not null,

  -- Кто поставил. **Своему событию сердце поставить можно** — решение владельца, принятое с
  -- названной ценой: счёт становится накручиваемым. Отсюда следует, что экран печатает не одно
  -- число, а число **и лица** под ним: накрученная тройка немедленно называет себя по именам.
  person_id uuid not null references auth.users on delete cascade,

  created_at timestamptz not null default now(),

  primary key (owner_id, event_id, person_id),

  -- Сердце живёт ровно столько, сколько событие: убранное у себя событие уносит их каскадом.
  -- Без этого сердце пережило бы то, чему оно было сказано.
  foreign key (owner_id, event_id)
    references public.feed_events (user_id, event_id) on delete cascade
);

alter table public.feed_hearts enable row level security;

revoke all on public.feed_hearts from anon, authenticated;
-- `update` не выдан намеренно: у сердца нет состояний. Его ставят и снимают, а «поправить» в нём
-- нечего — колонка, которую можно поправить, это уже реакция с оттенком.
grant select, insert, delete on public.feed_hearts to authenticated;

-- Сердце видно тому, кому видно само событие. Отдельного правила у него нет и быть не может:
-- второе похожее условие рядом с первым однажды разойдётся, и на экране появится лицо человека,
-- чьё событие ты видеть не должен.
drop policy if exists "сердца видны вместе с событием" on public.feed_hearts;
create policy "сердца видны вместе с событием"
  on public.feed_hearts for select
  to authenticated
  using (
    exists (
      select 1 from public.feed_events e
      where e.user_id = owner_id and e.event_id = feed_hearts.event_id
    )
  );

-- Ставишь только от своего имени и только тому, что видишь. Второе условие несущее: без него
-- сердце уезжает на событие, которого спрашивающему не отдали, — то есть становится способом
-- проверить, существует ли оно.
drop policy if exists "своё сердце ставишь сам" on public.feed_hearts;
create policy "своё сердце ставишь сам"
  on public.feed_hearts for insert
  to authenticated
  with check (
    person_id = auth.uid()
    and exists (
      select 1 from public.feed_events e
      where e.user_id = owner_id and e.event_id = feed_hearts.event_id
    )
  );

drop policy if exists "своё сердце снимаешь сам" on public.feed_hearts;
create policy "своё сердце снимаешь сам"
  on public.feed_hearts for delete
  to authenticated
  using (person_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Лента одним ответом
-- ---------------------------------------------------------------------------------------------

-- Что показывает экран, одним запросом.
--
-- `security invoker` — политики выше и решают, что вернётся: не видно значит пусто, и пусто
-- приходит тем же ответом. То же правило, что у `shelf_json`.
--
-- Своих событий здесь **нет**, и это не экономия. Свои события выводятся из дороги на самом
-- устройстве (`buildFeed`), где они богаче: с формой возвращения, с датой, с дорогой под пальцем.
-- Спросить их у сервера значило бы завести второй разбор той же истории рядом с первым — и в день,
-- когда копия отстанет на двадцать секунд таймера, человек увидит свою вчерашнюю жизнь.
--
-- Сердца при этом приезжают **и на свои события тоже**: их ставит та сторона, и знать о них
-- отсюда неоткуда.
create or replace function public.feed_view(since date) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.event_id,
          'person', jsonb_build_object('id', p.id, 'handle', p.handle, 'name', p.name),
          'happened_on', e.happened_on,
          'kind', e.kind,
          'title', e.title,
          'rank', e.rank,
          'days', e.days,
          'mark', e.mark
        ) order by e.happened_on desc, e.created_at desc
      )
      from public.feed_events e
      join public.profiles p on p.id = e.user_id
      where e.happened_on >= since and e.user_id <> auth.uid()
    ), '[]'::jsonb),
    'hearts', coalesce((
      select jsonb_agg(
        jsonb_build_object('owner_id', h.owner_id, 'event_id', h.event_id, 'person_id', h.person_id)
        order by h.created_at
      )
      from public.feed_hearts h
      join public.feed_events e on e.user_id = h.owner_id and e.event_id = h.event_id
      where e.happened_on >= since
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.feed_view(date) from public;
grant execute on function public.feed_view(date) to authenticated;

-- Поставить и снять. Обе возвращают **вид целиком**, а не «ок», — то же правило, что у связей и у
-- кружка, и по той же причине: кто сказал сердце этому событию, знает та сторона. Местная догадка
-- о результате однажды разошлась бы с ней, и человек увидел бы лицо, которого нет.
--
-- Окно приезжает аргументом, потому что ответ — та же лента: вернуть из правки что-то другое
-- значило бы завести второй разбор ответа рядом с первым.
create or replace function public.feed_heart(owner uuid, event text, since date) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  -- `on conflict do nothing`, а не проверка перед вставкой: сердце двоичное, второе нажатие по уже
  -- красному сердцу — это тот же самый факт, а не ошибка, о которой надо рассказывать.
  insert into public.feed_hearts (owner_id, event_id, person_id)
  values (owner, event, auth.uid())
  on conflict do nothing;

  return public.feed_view(since);
end;
$$;

create or replace function public.feed_unheart(owner uuid, event text, since date) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from public.feed_hearts
  where owner_id = owner and event_id = event and person_id = auth.uid();

  return public.feed_view(since);
end;
$$;

revoke execute on function public.feed_heart(uuid, text, date) from public;
revoke execute on function public.feed_unheart(uuid, text, date) from public;
grant execute on function public.feed_heart(uuid, text, date) to authenticated;
grant execute on function public.feed_unheart(uuid, text, date) to authenticated;
