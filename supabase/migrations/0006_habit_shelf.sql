-- Витрина привычек: названия, значки и набранные дни — единственный чужой текст в приложении.
--
-- Обещана частью 6, отложена частью 7 и лежит здесь по той причине, по которой её нельзя было
-- написать раньше: её политика звучит «друзьям, а остальным по настройке», а дружб на сервере до
-- 0004 не было вовсе. Флаг `habits_public` при этом стоит в `profiles` с 0001 — он заводился
-- ровно под эту таблицу.
--
-- Порядок в файле тот же, что в 0001–0005, и он несущий: таблица, `enable row level security`,
-- права, политики — до того, как в неё попадёт первая строка. Ключ у клиента публичный и лежит в
-- бандле; всё, что стоит между чужим человеком и названием твоей привычки, — эти политики.
--
-- Дороги здесь по-прежнему нет. На полку уезжает то же, что показывает витрина в профиле, и
-- ничего сверх: ни дней по числам, ни отметок, ни дат взятых ступеней. **Ступени тоже нет** —
-- она выводится из дней по одной лестнице на всех (`src/domain/ranks.ts`), и присланная отдельным
-- полем она стала бы вторым экземпляром числа, которое уже сказано.
--
-- Файл запускается повторно без вреда.

-- ---------------------------------------------------------------------------------------------
-- Таблица
-- ---------------------------------------------------------------------------------------------

create table if not exists public.habit_shelf (
  user_id uuid not null references auth.users on delete cascade,

  -- Ключ привычки на **её** устройстве. `text`, а не `uuid`, и это не осторожность: ключ здесь
  -- чужой — его чеканит тот, кто завёл привычку (`newId` в src/domain/ids.ts), — и требовать от
  -- него формы значит решать за ту сторону, чем ей называть свои вещи. Сервер им только
  -- различает строки одной полки.
  habit_id text not null check (char_length(habit_id) between 1 and 64),

  -- Название человек пишет сам, и это то самое свободное поле, ради которого вся строка выше
  -- закрыта настройкой. Длина ограничена, потому что неограниченная колонка — это способ занять
  -- чужое место в таблице, а не способ назвать привычку.
  title text not null check (char_length(title) between 1 and 100),

  -- Значок — эмодзи, и только эмодзи (см. «Настройки привычки» в CLAUDE.md). Своего цвета у
  -- привычки нет и не будет, поэтому и колонки под него здесь нет.
  icon text check (char_length(icon) between 1 and 8),

  -- Дни, набранные привычкой. Считает их та сторона: пропуски и возвращения — её арифметика, а
  -- дороги на сервере нет и посчитать их здесь не из чего.
  days int not null default 0 check (days >= 0),

  updated_at timestamptz not null default now(),

  primary key (user_id, habit_id)
);

alter table public.habit_shelf enable row level security;

-- Права — второй замок, грубее политик: где нет политики, там не должно быть и права. `update`
-- здесь нужен, в отличие от связей: у полки правят **строку** (вчера было 20 дней, сегодня 21), а
-- не связь. `delete` — потому что привычка с полки уходит, когда её удалили у себя.
revoke all on public.habit_shelf from anon, authenticated;
grant select, insert, update, delete on public.habit_shelf to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Политики
-- ---------------------------------------------------------------------------------------------

-- Ровно то, что решено в «Что видно чужим»: полка видна друзьям, а остальным — по настройке
-- (`habits_public`, умолчание «нет»). Разделено именно здесь, потому что название привычки —
-- свободный текст, который человек пишет сам, и в это же поле пишут «Бег 5 км» и «Не пить». Число
-- «4 привычки» остаётся видимым всегда и живёт колонкой в `profiles`: оно ничего не называет.
--
-- **Снимает полку эта сторона, а не экран.** Присланная и ненарисованная полка — это утечка, до
-- которой один тап в инструментах разработчика.
--
-- Своя строка стоит первой в `or` и не зовёт ничего: свою полку читает каждый вошедший, а
-- остальные три условия для неё всё равно ничего бы не решили.
--
-- Закрывший тебя не отдаёт ничего, как и его профиль. Обратной стороны у этого нет намеренно:
-- закрытого **тобой** полка не приезжает тоже — блокировка ровно то и отменила, что человек тебе
-- показывал, — а имя с ником для полки заблокированных приезжают из `friend_profile` отдельно.
drop policy if exists "полка видна друзьям, а остальным по настройке" on public.habit_shelf;
create policy "полка видна друзьям, а остальным по настройке"
  on public.habit_shelf for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      not public.blocks_me(user_id)
      and not exists (
        select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = user_id
      )
      and (
        exists (
          select 1 from public.friendships
          where a_id = least(auth.uid(), user_id) and b_id = greatest(auth.uid(), user_id)
        )
        or exists (select 1 from public.profiles p where p.id = user_id and p.habits_public)
      )
    )
  );

-- Свою полку правишь только сам, и только свою. Три политики вместо одной `for all`, как в 0001:
-- `using` и `with check` отвечают на разные вопросы, и политика, отвечающая на оба сразу, читается
-- одинаково в случае, когда она права, и в случае, когда она пускает лишнее.
drop policy if exists "свою полку заводишь сам" on public.habit_shelf;
create policy "свою полку заводишь сам"
  on public.habit_shelf for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "свою полку правишь сам" on public.habit_shelf;
create policy "свою полку правишь сам"
  on public.habit_shelf for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "со своей полки убираешь сам" on public.habit_shelf;
create policy "со своей полки убираешь сам"
  on public.habit_shelf for delete
  to authenticated
  using (user_id = auth.uid());

drop trigger if exists habit_shelf_touch_updated_at on public.habit_shelf;
create trigger habit_shelf_touch_updated_at
  before update on public.habit_shelf
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------------------------
-- Полка в ответе про чужой профиль
-- ---------------------------------------------------------------------------------------------

-- Полка одного человека, как её видит спрашивающий.
--
-- `security invoker` — то есть политика выше и решает, что вернётся. Это весь смысл: не видно —
-- значит пусто, и пусто приходит **тем же ответом**, а не отдельным словом «он прячет привычки».
-- Прятать полку и сообщать, что она спрятана, — разные вещи, и второго сервер не обязан.
--
-- Порядок — по дням, как на своей витрине: сверху то, что человек держит дольше всего.
create or replace function public.shelf_json(owner uuid) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', habit_id, 'title', title, 'icon', icon, 'days', days)
      order by days desc, title
    ),
    '[]'::jsonb
  )
  from public.habit_shelf
  where user_id = owner;
$$;

revoke execute on function public.shelf_json(uuid) from public;
grant execute on function public.shelf_json(uuid) to authenticated;

-- `friend_profile` из 0004 — с полкой.
--
-- Переписана здесь целиком, а не правкой на месте: 0004 уже прогнан на рабочем проекте, и файл,
-- который меняют после запуска, перестаёт быть записью о том, что на сервере лежит. Тело то же,
-- добавлено одно поле.
--
-- В ветке блокировки полки нет и быть не может: про закрывшего тебя человека не приезжает ничего,
-- кроме имени и ника, — и это то самое место, где лишнее поле стоило бы дороже всего.
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
        'habit_count', p.habit_count,
        'habits', public.shelf_json(p.id)
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

revoke execute on function public.friend_profile(text) from public;
grant execute on function public.friend_profile(text) to authenticated;
