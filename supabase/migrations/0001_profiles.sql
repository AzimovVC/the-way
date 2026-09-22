-- Профили: то, чем человека зовут чужие.
--
-- Первая таблица приложения, и порядок в файле несущий: таблица, следом `enable row level
-- security`, следом политики — до того, как в неё попадёт первая строка. Ключ у клиента публичный
-- (`anon`), он лежит в собранном бандле и его читает кто угодно; всё, что защищает данные, — эти
-- политики. Таблица, у которой RLS включили «потом», успевает пожить открытой.
--
-- Файл запускается **повторно** без вреда: `if not exists` на таблице, `drop policy if exists`
-- перед каждой политикой, `or replace` на функциях. Причина не в аккуратности — в том, что
-- редактор Supabase гоняет всё одной транзакцией: упавший на середине прогон откатывается
-- целиком, и чинить его приходится тем же файлом, а файл, падающий на «уже существует», не
-- говорит, чего в схеме не хватает.
--
-- Дороги здесь нет и не будет. `the-way:v1` в localStorage остаётся единственным источником правды
-- про путь; наружу уезжает только проекция — числа, которые и так видно по нику.
-- Ни `days`, ни `chores`, ни геометрия.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,

  -- Ник. Форма повторяет `src/domain/handle.ts`, и это нарочно: клиент нормализует набранное под
  -- пальцем, но проверку формы держит та сторона — иначе форма ника защищена ровно до первого
  -- запроса в обход экрана.
  handle text not null unique
    check (char_length(handle) between 3 and 20)
    check (handle ~ '^[a-z0-9_]+$')
    check (handle ~ '[a-z]'),

  -- Имя человек пишет как хочет, хоть пустым: уникально оно быть не обязано, спрашивают по нику.
  name text not null default '',

  -- Проекция пути. Это его числа, посчитанные у него; вывести их из чего-то серверного нельзя,
  -- потому что дороги на сервере нет.
  days_on_road   int not null default 0 check (days_on_road   >= 0),
  current_streak int not null default 0 check (current_streak >= 0),
  habit_count    int not null default 0 check (habit_count    >= 0),

  -- Видна ли витрина привычек тем, кто ещё не друг. Умолчание «нет» — то же, что у `habitsPublic`
  -- в состоянии: название привычки самое личное, что тут можно прочитать. Сама витрина приедет
  -- своей таблицей в части 7; флаг стоит здесь, потому что политике на той таблице он и нужен.
  habits_public boolean not null default false,

  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Видно по нику — значит видно вошедшему, любому. Это ровно то, что решено в «Что видно чужим»:
-- имя, ник, дни в пути и серия видны без настройки, иначе ссылка-приглашение была бы пустой
-- карточкой. Строка здесь целиком состоит из таких полей, поэтому строчная политика и есть
-- правило: колонки, которую нельзя показать чужому, в этой таблице нет.
--
-- Часть 7 сузит это условие блокировками: заблокированный не видит ничего. Пишется это здесь же,
-- одной правкой политики, и до тех пор блокировка живёт только в заглушке.
drop policy if exists "профиль виден вошедшим" on public.profiles;
create policy "профиль виден вошедшим"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "свой профиль заводишь сам" on public.profiles;
create policy "свой профиль заводишь сам"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "свой профиль правишь сам" on public.profiles;
create policy "свой профиль правишь сам"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Политики на delete нет намеренно: профиль кончается вместе с аккаунтом (`on delete cascade`), и
-- отдельная кнопка «удалить профиль, остаться в аккаунте» оставила бы человека без ника в
-- приложении, где по нику его и зовут.

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Занят ли ник.
--
-- Функция, а не `select` из таблицы, и причина в будущем: как только политика на select сузится
-- блокировками, ник заблокированного человека станет для тебя «свободным» — а он занят. Экран
-- сказал бы «свободен», сервер отказал бы уникальным индексом, и человек читал бы это как ошибку
-- приложения. `security definer` отвечает про всех, но отдаёт только «да/нет»: узнать, чей это
-- ник, отсюда нельзя.
--
-- Свой нынешний ник считается свободным: иначе сохранение профиля, в котором ник не трогали,
-- жаловалось бы на него самого. `is distinct from` вместо `<>` — у невошедшего `auth.uid()` пуст,
-- и сравнение через `<>` дало бы null, то есть «свободно» на любой ник.
create or replace function public.handle_available(candidate text) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select not exists (
    select 1 from public.profiles
    where handle = lower(candidate)
      and id is distinct from auth.uid()
  );
$$;

revoke execute on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to authenticated;
