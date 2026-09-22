-- Кружок на сервере: привычка, которую держат двое, и сообщения, которые чеканит сервер.
--
-- Порядок в файле тот же, что в 0001–0006, и он несущий: таблица, `enable row level security`,
-- права, политики — до того, как в неё попадёт первая строка. Ключ у клиента публичный, лежит в
-- бандле, и всё, что стоит между чужим человеком и вашей парой, — эти политики.
--
-- **Правила живут в политиках и триггерах, а не в функциях.** Клиент с публичным ключом ходит и
-- прямо в таблицы, минуя функции, и правило, живущее в функции, для него не существует вовсе.
-- Триггер здесь равноправен политике по той же причине: он часть таблицы, а не вызова, и его не
-- обойти, зайдя сбоку. Исключений два — `circle_accept` и `circle_leave`, — и каждое объяснено
-- поимённо там, где стоит: обе пишут строку **за другого человека**, а «за другого» политикой не
-- выражается, потому что политика знает только того, кто пришёл.
--
-- Главное правило приложения этот файл не трогает и тронуть не может: её отметка не влияет ни на
-- что в твоём дне. Дороги здесь нет — ни `days`, ни `chores`, ни геометрии, — и парная серия
-- **не считается на сервере вовсе** (см. «Чего здесь нет» в конце файла).
--
-- Файл запускается повторно без вреда.

-- ---------------------------------------------------------------------------------------------
-- Пояс: то, чего не хватало, чтобы проверить день отметки
-- ---------------------------------------------------------------------------------------------

-- Логический день закрывается в 3:00 **местного** времени отметившегося (`DAY_BOUNDARY_HOUR` в
-- src/domain/config.ts), и до сих пор серверу нечем было это посчитать: `date` приходил от
-- клиента, RLS пускала любую дату, ключ публичный — то есть парная серия накручивалась из консоли.
--
-- Пояс человек объявляет о себе сам, и цена этого названа вслух: переписав его, он сдвинет себе
-- границу дня. Сдвинуть можно ровно один день и ровно тому единственному человеку, который и так
-- знает, бегал ты сегодня или нет. Рейтингов в приложении нет, таблицы лидеров нет, и парную
-- серию нельзя выиграть — поэтому проверка обязана останавливать случайное и ленивое, а не
-- строить крепость вокруг числа, которое не валюта.
alter table public.profiles add column if not exists timezone text not null default 'UTC';

-- Час, в который закрывается логический день. Та же тройка, что в config.ts, и здесь она стоит
-- отдельным именем затем, чтобы два места не разошлись молча.
create or replace function public.day_boundary_hour() returns int
language sql immutable as $$ select 3 $$;

-- Логический день человека в его поясе.
--
-- Незнакомое имя пояса не должно ронять отметку: `at time zone` на мусоре бросает исключение, и
-- строка, написанная в профиль руками, обрушила бы чужую отметку, а не свою. Тогда UTC.
create or replace function public.logical_day(at timestamptz, tz text) returns date
language plpgsql stable set search_path = public, pg_temp as $$
begin
  return ((at at time zone tz) - make_interval(hours => public.day_boundary_hour()))::date;
exception when others then
  return ((at at time zone 'UTC') - make_interval(hours => public.day_boundary_hour()))::date;
end;
$$;

-- Допуск вокруг границы дня.
--
-- Выведен, а не выбран. Отметка нажимается на телефоне и доезжает по сети: клиент посчитал день в
-- 02:59, сервер принял запрос в 03:01 — и без допуска отметка легла бы у пары в завтра, а на твоей
-- дороге во вчера, то есть одно нажатие получило бы две разные даты. Пять минут — это секунды
-- запроса плюс расхождение часов телефона, которое у людей бывает минутами. Окно симметрично:
-- часы спешат так же охотно, как отстают.
create or replace function public.circle_mark_grace() returns interval
language sql immutable as $$ select interval '5 minutes' $$;

-- ---------------------------------------------------------------------------------------------
-- Таблицы
-- ---------------------------------------------------------------------------------------------

create table if not exists public.circles (
  id uuid primary key,

  -- Название **носит слово зовущего и не меняется никогда**. Переименование, доезжающее до неё, —
  -- это власть над чужой записью, то самое, что запрещено решением 1: она согласилась на слово,
  -- которое прочитала в приглашении, и через месяц оно не должно оказаться другим.
  --
  -- Своя привычка при этом переименовывается свободно: карточка дня печатает **твоё** название
  -- (DayCard берёт `template.title`), а это слово стоит там, где подлежащее — кружок. Цена: через
  -- два месяца у тебя «Бег», а кружок всё ещё «Пробежка по утрам». Слово, которое видит она, — то
  -- самое, на которое она соглашалась.
  title text not null check (char_length(btrim(title)) between 1 and 60),
  icon  text check (char_length(icon) <= 8),

  -- Расписание одно на двоих, задаёт зовущий. `null` = каждый день, как и у обычной привычки.
  -- Индекс недели — от понедельника (`weekdayIndex` в schedule.ts), а не сырой `getUTCDay`.
  weekdays int[] check (weekdays is null or (
    array_length(weekdays, 1) between 1 and 7
    and weekdays <@ array[0,1,2,3,4,5,6]
  )),

  -- Пояс зовущего. Правило от него не меняется — день у каждого свой, — он написан на карточке,
  -- когда разница велика (`zoneNote`, CIRCLE_ZONE_GAP_HOURS = 6).
  timezone   text not null default 'UTC',
  started_on date not null,
  created_by uuid not null references auth.users on delete cascade,

  -- Выход **не удаляет кружок**, а проставляет эти два поля: молча исчезнувшая вторая кнопка —
  -- худший способ сообщить такую новость (решение 3). Оставшийся получает сообщение и видит
  -- прощальную карточку с общим числом; число он считает у себя, из своих дней и уцелевших
  -- отметок, поэтому строки и остаются лежать, пока он её не закроет.
  left_at timestamptz,
  left_by uuid references auth.users on delete set null,

  created_at timestamptz not null default now(),

  -- Закрытым кружок делает `left_at`, а не имя ушедшего: `left_by` обнуляется каскадом, когда
  -- человек удаляет аккаунт целиком (0005). Требовать их парой значило бы, что удаление аккаунта
  -- падает на проверке — то есть дверь, за которую нельзя выйти, из-за поля с именем.
  constraint circles_left_named check (left_by is null or left_at is not null)
);

create table if not exists public.circle_members (
  circle_id uuid not null references public.circles on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,

  -- Привычка **на его устройстве**: ключ местный, для второго бессмысленный и непрозрачный. В
  -- кружке общее слово, а не запись — у каждого своя привычка, заведённая своим `applyAction`.
  task_id text not null check (char_length(task_id) between 1 and 64),

  joined_at timestamptz not null default now(),

  primary key (circle_id, user_id),

  -- **Одна привычка держит один кружок.** Вторая пара на той же строке дня означала бы два
  -- напарника у одной галочки, то есть счётчик внутри задачи, а `isDone` двоичное.
  unique (user_id, task_id)
);

create index if not exists circle_members_user_idx on public.circle_members (user_id);

create table if not exists public.circle_marks (
  circle_id uuid not null references public.circles on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,

  -- Логический день **того, кто отметился**, ровно как на личной дороге. Правило одно, а не два.
  date date not null,

  -- Второй род отметки. Заморозка приезжает сюда же, а не вторым каналом: «в этом кружке, в этот
  -- день, я был освобождён» — та же гранулярность, что у обычной отметки, и наружу не уезжает
  -- ничего сверх неё. Чужую дорогу не читает никто, включая друзей (политика на `roads`), и
  -- список дат заморозок был бы кусочком дороги, вынесенным наружу в обход этого.
  --
  -- Отсюда же следует, что `partner.excused` перестаёт быть отдельным полем: он **выводится** из
  -- этих строк — то же правило, по которому нигде не хранятся ни уровень привычки, ни парная
  -- серия. Снятие заморозки обязано удалять строку, иначе освобождение осталось бы навсегда.
  --
  -- Выходного (`Day.rest`) здесь не бывает: расписание одно на двоих, и дня, который спросил у
  -- одного и не спросил у другого, при общем расписании не существует.
  kind text not null default 'done' check (kind in ('done', 'excused')),

  -- Момент отметки, часы его. Ни во что не идёт — ни `timeOfDay`, ни веха, ни цвет его не читают, —
  -- поэтому и приходит от клиента: это часы, которые человек видел.
  done_at timestamptz not null default now(),

  primary key (circle_id, user_id, date)
);

create table if not exists public.circle_invites (
  id uuid primary key,
  from_id uuid not null references auth.users on delete cascade,
  to_id   uuid not null references auth.users on delete cascade,

  -- Привычка видна целиком **до** согласия — название, значок и расписание, — потому что
  -- расписание одно на двоих и соглашаются именно на него.
  title text not null check (char_length(btrim(title)) between 1 and 60),
  icon  text check (char_length(icon) <= 8),
  weekdays int[] check (weekdays is null or (
    array_length(weekdays, 1) between 1 and 7
    and weekdays <@ array[0,1,2,3,4,5,6]
  )),
  timezone text not null default 'UTC',

  -- Зовут **своей, уже заведённой привычкой**: у неё расписание настоящее, а не обещание.
  task_id text not null check (char_length(task_id) between 1 and 64),

  created_at timestamptz not null default now(),

  constraint circle_invites_not_self check (from_id <> to_id),

  -- Та же граница «одна привычка — один кружок», протянутая на висящее приглашение: позвать двоих
  -- одной привычкой значит пообещать пару обоим.
  unique (from_id, task_id)
);

create index if not exists circle_invites_to_idx on public.circle_invites (to_id);

create table if not exists public.notices (
  -- Сообщение, адресованное одному человеку.
  --
  -- **Чеканит его сервер, человек — никогда.** Политики на вставку у таблицы нет ни одной, ни
  -- своих строк, ни чужих: таблица, в которую пишет человек, — это канал свободного текста между
  -- людьми, то есть ровно то, от чего закрыта реакция-сердце (решение 5) — жалобы, модерация,
  -- правила. Строку кладут функции, и только по случаю, который человек сам и устроил.
  --
  -- Непрочитанное — это **существование строки**, а не колонка «прочитано»: сообщение читают один
  -- раз и закрывают, а число непрочитанных — это счёт, которого в приложении нет нигде.
  id uuid primary key,
  user_id uuid not null references auth.users on delete cascade,

  -- Пока один род. Список закрытый нарочно: род сообщения обязан иметь свой экран, а `text` без
  -- проверки — это приглашение завести восьмой, о котором ни один экран не знает.
  kind text not null check (kind in ('circle_left')),

  -- Что случилось, словами самой вещи: `circle_id`, `title`, `partner_name`. Текст на экран
  -- собирает клиент — фразы живут там же, где остальные, и правятся без миграции.
  payload jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists notices_user_idx on public.notices (user_id, created_at desc);

alter table public.circles        enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_marks   enable row level security;
alter table public.circle_invites enable row level security;
alter table public.notices        enable row level security;

-- Права на таблицу — второй замок, и он грубее политик: там, где политики нет вовсе, нет и права.
-- Выписано руками, а не оставлено на умолчания проекта: умолчание раздаёт права всем ролям сразу,
-- включая `anon`.
--
-- Чего нет ни у кого, и это сказано правами, а не только политиками:
--
-- - **`insert` на `circles` и `circle_members`**. Кружок заводит одна функция, и она проверяет
--   приглашение руками. Политика здесь не годится: вторая строка участия пишется **за другого
--   человека**, а политика знает только того, кто пришёл;
-- - **`insert` на `notices`**. Сообщение чеканит сервер. Человек, которому дали сюда писать,
--   получает канал свободного текста в чужое приложение;
-- - **`update` на `circle_members`, `circle_invites` и `notices`**. Участие не правят — из него
--   выходят; приглашение не правят — его отзывают и шлют заново; сообщение не правят — его
--   закрывают.
revoke all on public.circles, public.circle_members, public.circle_marks,
              public.circle_invites, public.notices
  from anon, authenticated;

grant select, update, delete on public.circles        to authenticated;
grant select, delete        on public.circle_members to authenticated;
grant select, insert, update, delete on public.circle_marks to authenticated;
grant select, insert, delete on public.circle_invites to authenticated;
grant select, delete        on public.notices        to authenticated;

-- ---------------------------------------------------------------------------------------------
-- «Я в этом кружке?» — вопрос, который задают почти все политики ниже
-- ---------------------------------------------------------------------------------------------

-- `security definer`, и это **не** исключение из правила про политики: функция отвечает про
-- **себя**, а не про других. Она нужна `definer` по технической причине — политика на
-- `circle_members` сама читает `circle_members`, и без выхода из-под RLS это рекурсия.
--
-- Узнать отсюда что-либо про чужой кружок нельзя: `auth.uid()` зашит внутри, аргумента «кто» у
-- функции нет.
create or replace function public.in_circle(circle uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.circle_members
    where circle_id = circle and user_id = auth.uid()
  );
$$;

-- Второй участник. Тоже `definer` и по той же причине; отвечает одним человеком и только про тот
-- кружок, в котором ты стоишь сам.
create or replace function public.circle_mate(circle uuid) returns uuid
language sql security definer stable set search_path = public, pg_temp as $$
  select m.user_id from public.circle_members m
  where m.circle_id = circle
    and m.user_id <> auth.uid()
    and public.in_circle(circle);
$$;

-- ---------------------------------------------------------------------------------------------
-- Политики
-- ---------------------------------------------------------------------------------------------

-- Кружок видят его двое и больше никто. Ни друзья, ни друзья друзей: пара — это про двоих.
drop policy if exists "кружок виден своим" on public.circles;
create policy "кружок виден своим"
  on public.circles for select
  to authenticated
  using (public.in_circle(id));

-- Правка у кружка ровно одна — выход, и следит за этим триггер ниже: политика умеет сказать
-- «кто», но не умеет сказать «что именно», а название здесь не меняется никогда.
drop policy if exists "кружок закрывает любой из двоих" on public.circles;
create policy "кружок закрывает любой из двоих"
  on public.circles for update
  to authenticated
  using (public.in_circle(id))
  with check (public.in_circle(id));

-- Закрытый кружок уносит оставшийся — тем нажатием, которым закрывает прощальную карточку.
-- Живой не уносит никто: из живого выходят, и выход — это `left_at`, а не пропажа.
--
-- Каскад делает остальное: участие и отметки уходят вместе со строкой, и порядок «сначала кружок,
-- потом участие» здесь несущий — удалив своё участие первым, оставшийся перестал бы быть своим
-- для `in_circle`, то есть потерял бы право убрать то, что только что дочитал.
drop policy if exists "закрытый кружок уносит оставшийся" on public.circles;
create policy "закрытый кружок уносит оставшийся"
  on public.circles for delete
  to authenticated
  using (public.in_circle(id) and left_at is not null);

-- Участие видно тем же двоим: иначе второй — строка без имени.
drop policy if exists "участие видно своим" on public.circle_members;
create policy "участие видно своим"
  on public.circle_members for select
  to authenticated
  using (public.in_circle(circle_id));

-- Убрать можно **только своё** участие. Это и есть выход, и это же — закрытие прощальной
-- карточки оставшимся: последний ушедший уносит кружок целиком каскадом.
drop policy if exists "своё участие убираешь сам" on public.circle_members;
create policy "своё участие убираешь сам"
  on public.circle_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Отметки видны обоим — в этом весь кружок: ты нажал, она видит.
drop policy if exists "отметки видны своим" on public.circle_marks;
create policy "отметки видны своим"
  on public.circle_marks for select
  to authenticated
  using (public.in_circle(circle_id));

-- Отмечаешься **только сам и только в живом кружке**. Дату проверяет триггер: политика могла бы
-- повторить ту же проверку, но отказ политики — это «строка не подошла», а человеку здесь надо
-- сказать, что именно не так с датой.
drop policy if exists "отмечаешься сам" on public.circle_marks;
create policy "отмечаешься сам"
  on public.circle_marks for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.in_circle(circle_id)
    and not exists (select 1 from public.circles c where c.id = circle_id and c.left_at is not null)
  );

-- Отметка правится в одном случае: галочка сменилась заморозкой или наоборот в тот же день.
drop policy if exists "свою отметку правишь сам" on public.circle_marks;
create policy "свою отметку правишь сам"
  on public.circle_marks for update
  to authenticated
  using (user_id = auth.uid() and public.in_circle(circle_id))
  with check (user_id = auth.uid() and public.in_circle(circle_id));

-- Снять отметку — тоже только свою. Чужую не снимает никто и никогда: это и есть «власть над
-- чужой записью», запрещённая решением 1, в самом прямом её виде.
drop policy if exists "свою отметку снимаешь сам" on public.circle_marks;
create policy "свою отметку снимаешь сам"
  on public.circle_marks for delete
  to authenticated
  using (user_id = auth.uid() and public.in_circle(circle_id));

-- Приглашение видят двое: у одного оно «пришло», у другого «отправлено».
drop policy if exists "приглашение видно двоим" on public.circle_invites;
create policy "приглашение видно двоим"
  on public.circle_invites for select
  to authenticated
  using (auth.uid() in (from_id, to_id));

-- Зовут **друга**, и зовут своей привычкой.
--
-- Условие на дружбу стоит здесь, а не в функции: приглашение от незнакомца — это сообщение от
-- незнакомца, а таких в приложении нет. Заблокированный не зовёт вовсе: `blocks_me` из 0004.
drop policy if exists "зовёшь сам, и только друга" on public.circle_invites;
create policy "зовёшь сам, и только друга"
  on public.circle_invites for insert
  to authenticated
  with check (
    from_id = auth.uid()
    and exists (
      select 1 from public.friendships
      where a_id = least(auth.uid(), to_id) and b_id = greatest(auth.uid(), to_id)
    )
    and not public.blocks_me(to_id)
    and not exists (
      select 1 from public.blocks where blocker_id = auth.uid() and blocked_id = to_id
    )
  );

-- Убирает любой из двоих: отзыв и отказ — на сервере одно и то же, приглашения больше нет.
-- Разные слова живут на экране, где они и правда разные.
drop policy if exists "приглашение убирает любой из двоих" on public.circle_invites;
create policy "приглашение убирает любой из двоих"
  on public.circle_invites for delete
  to authenticated
  using (auth.uid() in (from_id, to_id));

-- Свои сообщения, и только чтение с закрытием. Чужих не видно вовсе.
drop policy if exists "свои сообщения" on public.notices;
create policy "свои сообщения"
  on public.notices for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "своё сообщение закрываешь сам" on public.notices;
create policy "своё сообщение закрываешь сам"
  on public.notices for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Триггеры: то, чего политика сказать не умеет
-- ---------------------------------------------------------------------------------------------

-- Политика отвечает на «кто», триггер — на «что именно». Оба нужны, и оба часть таблицы: их не
-- обойти, зайдя в таблицу прямо, а функцию — можно.

-- У кружка меняется ровно одно: он закрывается. Название, расписание, пояс и день начала —
-- неизменны; название вдобавок принадлежит зовущему (см. `circles.title`).
--
-- Закрытие **необратимо**: вернуться назад нельзя, зовут заново (решение 3).
create or replace function public.circles_only_leave() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (new.id, new.title, new.icon, new.weekdays, new.timezone, new.started_on, new.created_by)
     is distinct from
     (old.id, old.title, old.icon, old.weekdays, old.timezone, old.started_on, old.created_by) then
    raise exception 'В кружке меняется только выход';
  end if;

  if old.left_at is not null and new.left_at is distinct from old.left_at then
    raise exception 'Кружок уже закрыт';
  end if;

  -- Закрыть кружок можно только собой: «вышла она» — это новость, а не запись, которую делает
  -- оставшийся. Иначе ушедшим можно назначить второго.
  if new.left_by is not null and new.left_by <> auth.uid() then
    raise exception 'Из кружка выходят сами';
  end if;

  return new;
end;
$$;

drop trigger if exists circles_only_leave on public.circles;
create trigger circles_only_leave
  before update on public.circles
  for each row execute function public.circles_only_leave();

-- Двое, не больше. Трое — другая вещь с другими правилами («кто кого держит»), и она не
-- проектируется. Список из двух элементов однажды принимает третий молча — здесь не примет.
create or replace function public.circle_members_pair() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if (select count(*) from public.circle_members where circle_id = new.circle_id) >= 2 then
    raise exception 'В кружке двое';
  end if;
  return new;
end;
$$;

drop trigger if exists circle_members_pair on public.circle_members;
create trigger circle_members_pair
  before insert on public.circle_members
  for each row execute function public.circle_members_pair();

-- **Что мешает отметить вчера.**
--
-- `date` приходит от клиента — и это нарочно, а не недосмотр: считать день на сервере целиком
-- значило бы, что отметка, нажатая в 02:59 и доехавшая в 03:01, легла у пары в завтра, а на
-- твоей дороге во вчера. Одно нажатие, две даты. Поэтому дату присылает тот, кто нажал, а сервер
-- сверяет её со своим ответом и пускает только сегодняшнюю — в его собственном поясе, с допуском
-- в обе стороны (см. `circle_mark_grace`).
--
-- Отсюда следует и то, что нельзя **снять** вчерашнюю отметку: правится только сегодняшний день.
-- Вчерашний закрыт, и на дороге он тоже закрыт.
create or replace function public.circle_marks_today() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  tz text;
  grace interval := public.circle_mark_grace();
begin
  select timezone into tz from public.profiles where id = new.user_id;
  tz := coalesce(tz, 'UTC');

  if new.date not between public.logical_day(now() - grace, tz)
                       and public.logical_day(now() + grace, tz) then
    raise exception 'Отметка только за сегодня';
  end if;

  return new;
end;
$$;

drop trigger if exists circle_marks_today on public.circle_marks;
create trigger circle_marks_today
  before insert or update on public.circle_marks
  for each row execute function public.circle_marks_today();

-- Снятие — то же окно. Выписано отдельным триггером, потому что в `delete` смотрят на `old`.
create or replace function public.circle_marks_today_delete() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  tz text;
  grace interval := public.circle_mark_grace();
begin
  -- Каскад — не снятие отметки. Удаление кружка и удаление аккаунта уносят эти строки внутренними
  -- триггерами внешнего ключа, то есть на глубине больше первой, и правило «только за сегодня»
  -- там означало бы, что человек не может уйти из приложения из-за отметки, сделанной в марте.
  if pg_trigger_depth() > 1 then
    return old;
  end if;

  select timezone into tz from public.profiles where id = old.user_id;
  tz := coalesce(tz, 'UTC');

  if old.date not between public.logical_day(now() - grace, tz)
                      and public.logical_day(now() + grace, tz) then
    raise exception 'Снять можно только сегодняшнюю отметку';
  end if;

  return old;
end;
$$;

drop trigger if exists circle_marks_today_delete on public.circle_marks;
create trigger circle_marks_today_delete
  before delete on public.circle_marks
  for each row execute function public.circle_marks_today_delete();

-- ---------------------------------------------------------------------------------------------
-- Вид целиком
-- ---------------------------------------------------------------------------------------------

-- Кружки, пришедшие приглашения и отправленные — одним куском, той же формы, что `friends_view`,
-- и по той же причине: кто с кем в паре после нажатия, решает та сторона.
--
-- Закрытый кружок **приезжает вместе с живыми** и отличается полем `left_at`. Оставшемуся он
-- нужен целиком, со всеми отметками: прощальная карточка печатает общее число, а считает его он
-- сам — из своих дней и этих отметок. Уносит строки закрытие карточки, а не выход второго.
--
-- Каждое условие здесь выписано руками — `auth.uid()` в соединениях, а не оставлено политикам. Это
-- не дублирование: вид зовут и из `circle_accept`, и из `circle_leave`, а они `security definer`,
-- и политики внутри них не действуют. Вид, полагающийся на политику, отдал бы оттуда всё.
create or replace function public.circles_view() returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'circles', coalesce((
      select jsonb_agg(row_ order by row_->>'started_on')
      from (
        select jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'icon', c.icon,
          'weekdays', c.weekdays,
          'timezone', c.timezone,
          'started_on', c.started_on,
          'left_at', c.left_at,
          -- Твоя привычка, в которую кружок встал **у тебя**. Её ключ сюда не едет: он местный
          -- на её устройстве и здесь означал бы строку в чужой дороге.
          'task_id', mine.task_id,
          'partner', jsonb_build_object(
            'person', jsonb_build_object(
              'id', p.id, 'handle', p.handle, 'name', p.name,
              'days_on_road', p.days_on_road,
              'current_streak', p.current_streak,
              'habit_count', p.habit_count
            ),
            -- Её освобождённые дни — выводятся из отметок второго рода, а не лежат отдельным
            -- полем. Своя половина считается у себя, тем же `isDayExcused` по своим дням.
            'excused', coalesce((
              select jsonb_agg(k.date order by k.date)
              from public.circle_marks k
              where k.circle_id = c.id and k.user_id = p.id and k.kind = 'excused'
            ), '[]'::jsonb)
          ),
          -- Отметки обеих сторон. Только сделанные: освобождённые дни уже названы выше, и вторая
          -- их копия здесь читалась бы как галочка.
          'marks', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'circle_id', k.circle_id,
                'person_id', k.user_id,
                'date', k.date,
                'done_at', k.done_at
              ) order by k.date
            )
            from public.circle_marks k
            where k.circle_id = c.id and k.kind = 'done'
          ), '[]'::jsonb)
        ) as row_
        from public.circles c
        join public.circle_members mine on mine.circle_id = c.id and mine.user_id = auth.uid()
        -- Ушедший уносит своё участие, и связь `left_by` остаётся единственной ниткой к нему.
        -- Без неё закрытый кружок выпал бы из вида целиком — вместе с отметками, из которых
        -- оставшийся считает общее число на прощальной карточке.
        left join public.circle_members theirs
          on theirs.circle_id = c.id and theirs.user_id <> auth.uid()
        left join public.profiles p on p.id = coalesce(theirs.user_id, c.left_by)
        -- Второго не стало вовсе — он удалил аккаунт. Читать такой кружок нечем, и показывать
        -- его как пару значило бы назвать напарником пустое место.
        where p.id is not null
      ) rows_
    ), '[]'::jsonb),

    'incoming', coalesce((
      select jsonb_agg(row_ order by row_->>'created_at' desc)
      from (
        select jsonb_build_object(
          'id', i.id, 'title', i.title, 'icon', i.icon,
          'weekdays', i.weekdays, 'timezone', i.timezone, 'created_at', i.created_at,
          'person', jsonb_build_object('id', p.id, 'handle', p.handle, 'name', p.name)
        ) as row_
        from public.circle_invites i
        join public.profiles p on p.id = i.from_id
        where i.to_id = auth.uid()
      ) rows_
    ), '[]'::jsonb),

    'outgoing', coalesce((
      select jsonb_agg(row_ order by row_->>'created_at' desc)
      from (
        select jsonb_build_object(
          'id', i.id, 'title', i.title, 'icon', i.icon,
          'weekdays', i.weekdays, 'timezone', i.timezone, 'created_at', i.created_at,
          -- Только у отправленного: зовут своей привычкой, и до согласия она уже есть у тебя.
          'task_id', i.task_id,
          'person', jsonb_build_object('id', p.id, 'handle', p.handle, 'name', p.name)
        ) as row_
        from public.circle_invites i
        join public.profiles p on p.id = i.to_id
        where i.from_id = auth.uid()
      ) rows_
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- Отметки
-- ---------------------------------------------------------------------------------------------

-- Отметиться. `kind` = `done` или `excused`: заморозка приезжает той же ручкой, потому что на
-- сервере это одна и та же новость про один и тот же день — «этот день с меня не спросит».
--
-- Повторное нажатие переписывает строку, а не заводит вторую: день у пары один.
create or replace function public.circle_mark(circle uuid, on_date date, at timestamptz, mark_kind text default 'done')
returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  insert into public.circle_marks (circle_id, user_id, date, kind, done_at)
  values (circle, auth.uid(), on_date, coalesce(mark_kind, 'done'), coalesce(at, now()))
  on conflict (circle_id, user_id, date)
  do update set kind = excluded.kind, done_at = excluded.done_at;

  return public.circles_view();
end;
$$;

-- Снять. Переотметка — исправление, а не событие: строки просто не станет.
create or replace function public.circle_unmark(circle uuid, on_date date) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from public.circle_marks
  where circle_id = circle and user_id = auth.uid() and date = on_date;

  return public.circles_view();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Приглашение
-- ---------------------------------------------------------------------------------------------

-- Позвать. Ключ приезжает снаружи — см. [ids.ts](../../src/domain/ids.ts): два устройства иначе
-- сделают из одной операции два разных приглашения.
create or replace function public.circle_invite(
  invite_id uuid, target uuid, invite_title text, invite_icon text,
  invite_weekdays int[], invite_timezone text, habit_id text
) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  insert into public.circle_invites (id, from_id, to_id, title, icon, weekdays, timezone, task_id)
  values (invite_id, auth.uid(), target, invite_title, nullif(invite_icon, ''),
          invite_weekdays, coalesce(nullif(invite_timezone, ''), 'UTC'), habit_id)
  -- Повторное нажатие — то же приглашение, а не второе. Как у заявки в друзья.
  on conflict (from_id, task_id) do nothing;

  return public.circles_view();
end;
$$;

-- Отозвать своё и отказать чужому — **одно и то же на сервере**: приглашения больше нет. Разные
-- слова живут на экране, где они и правда разные; два тела с одинаковой серединой — это два места,
-- где однажды разойдутся правила, и одно из них об этом не узнает.
--
-- Отказ ни о чём не сообщает сверх «не сейчас»: сообщения он не чеканит, и это решено.
create or replace function public.circle_drop_invite(invite_id uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from public.circle_invites where id = invite_id and auth.uid() in (from_id, to_id);
  return public.circles_view();
end;
$$;

-- Принять.
--
-- **Первое из двух исключений в файле: `security definer`.** Причина по существу дела, а не ради
-- удобства: кружок заводится строкой участия **за другого человека** — за того, кто позвал, — а
-- «за другого» политикой не выражается, потому что политика знает только того, кто пришёл. Отсюда
-- же следует и то, что вставки у `circles` и `circle_members` нет ни у кого: строку кладёт только
-- эта функция.
--
-- Внутри `definer` политики не действуют, поэтому каждое условие выписано руками, и первое из
-- них — то, ради чего всё: приглашение должно существовать и быть адресовано **тебе**. Принять
-- чужое приглашение здесь нечем.
--
-- Привычка у принявшего заводится **обычным путём, через `applyAction`**, на его устройстве — в
-- состояние попадает результат его согласия, а не чужие данные (решение 3). Сюда приезжает только
-- ключ той привычки: она такая же, как остальные, и стоит в списке дня рядом с ними.
create or replace function public.circle_accept(invite_id uuid, circle_id uuid, habit_id text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  inv public.circle_invites;
begin
  select * into inv from public.circle_invites where id = invite_id and to_id = auth.uid();
  if inv is null then
    raise exception 'Приглашения нет';
  end if;

  -- Дружба проверяется **и здесь**, а не только на отправке: между приглашением и согласием
  -- помещается разрыв дружбы и блокировка, и согласие на них смотреть обязано.
  if not exists (
    select 1 from public.friendships
    where a_id = least(auth.uid(), inv.from_id) and b_id = greatest(auth.uid(), inv.from_id)
  ) then
    raise exception 'Он больше не в друзьях';
  end if;

  insert into public.circles (id, title, icon, weekdays, timezone, started_on, created_by)
  values (circle_id, inv.title, inv.icon, inv.weekdays, inv.timezone,
          public.logical_day(now(), inv.timezone), inv.from_id);

  -- Обе строки участия одной вставкой: кружок из одного человека не существует ни секунды.
  insert into public.circle_members (circle_id, user_id, task_id)
  values (circle_id, inv.from_id, inv.task_id),
         (circle_id, auth.uid(), habit_id);

  delete from public.circle_invites where id = invite_id;

  return public.circles_view();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Выход и сообщение о нём
-- ---------------------------------------------------------------------------------------------

-- Выйти.
--
-- **Второе и последнее исключение: `security definer`** — и ровно по той же причине, что первое.
-- Выход чеканит сообщение **другому человеку**, а строка в чужих сообщениях политикой не
-- выражается. Политик на вставку у `notices` нет ни у кого, и в этом весь смысл таблицы:
-- сообщение чеканит сервер по случаю, который человек сам и устроил, — иначе это канал свободного
-- текста в чужое приложение.
--
-- Привычка у оставшегося **остаётся обычной привычкой со всеми своими днями**: чужой уход не
-- имеет права отобрать у человека его же жизнь (решение 3). Сервер её и не видит — дороги здесь
-- нет, — и это самая сильная запись этого правила, какая возможна.
--
-- Кружок при этом не удаляется: он закрывается, и строки остаются лежать, пока оставшийся не
-- закроет прощальную карточку. Молча исчезнувшая вторая кнопка — худший способ сообщить такую
-- новость, и общее число на этой карточке ему считать не из чего, если отметок больше нет.
create or replace function public.circle_leave(circle uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  mate uuid;
  gone public.circles;
  my_name text;
begin
  if not exists (
    select 1 from public.circle_members where circle_id = circle and user_id = auth.uid()
  ) then
    raise exception 'Ты не в этом кружке';
  end if;

  select m.user_id into mate
  from public.circle_members m
  where m.circle_id = circle and m.user_id <> auth.uid();

  update public.circles
  set left_at = now(), left_by = auth.uid()
  where id = circle and left_at is null
  returning * into gone;

  delete from public.circle_members where circle_id = circle and user_id = auth.uid();

  -- Участников не осталось: кружок стал записью ни о ком. Так бывает, когда оставшийся выходит
  -- сам, не дочитав прощальной карточки. Уносится он здесь, потому что снаружи его уже некому
  -- увидеть, а каскад заберёт и отметки.
  if not exists (select 1 from public.circle_members where circle_id = circle) then
    delete from public.circles where id = circle;
    return public.circles_view();
  end if;

  -- Кружок закрывали секунду назад — второго сообщения не будет. Новость одна, и она уже ушла.
  if gone is null then
    return public.circles_view();
  end if;

  if mate is not null then
    select name into my_name from public.profiles where id = auth.uid();

    -- Единственный ключ в приложении, который чеканит сервер, — и это не отступление от правила
    -- «ключ приезжает вместе с действием», а его продолжение: сообщение не вещь, которую завёл
    -- человек, а следствие, которое он не называл. Прислать его снаружи было бы предложением
    -- выбрать имя чужой строке.
    insert into public.notices (id, user_id, kind, payload)
    values (
      gen_random_uuid(), mate, 'circle_left',
      jsonb_build_object('circle_id', circle, 'title', gone.title, 'partner_name', coalesce(my_name, ''))
    );
  end if;

  return public.circles_view();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Сообщения
-- ---------------------------------------------------------------------------------------------

-- Свои сообщения. Непрочитанное — это существование строки: числа непрочитанных в приложении нет
-- нигде, потому что число под записью превращает записи в счёт (решение 5).
create or replace function public.notices_view() returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id, 'kind', n.kind, 'payload', n.payload, 'created_at', n.created_at
      ) order by n.created_at
    ),
    '[]'::jsonb
  )
  from public.notices n
  where n.user_id = auth.uid();
$$;

-- Закрыть сообщение.
--
-- Прощальная карточка уносит с собой и кружок: участие оставшегося удаляется, последняя строка
-- участия забирает кружок и отметки каскадом. До этого мига всё лежит на месте — ему есть что
-- прочитать и из чего посчитать общее число.
create or replace function public.notice_dismiss(notice_id uuid) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
declare
  closed public.notices;
begin
  delete from public.notices where id = notice_id and user_id = auth.uid() returning * into closed;

  if closed is not null and closed.kind = 'circle_left' then
    -- Кружок целиком, а не своё участие в нём: участие и отметки уходят каскадом. Дочитанная
    -- карточка — это конец записи о паре, и половина записи, оставшаяся лежать, однажды всплывёт
    -- строкой про человека, с которым всё давно кончилось.
    delete from public.circles where id = (closed.payload->>'circle_id')::uuid;
  end if;

  return public.notices_view();
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Чего здесь нет
-- ---------------------------------------------------------------------------------------------

-- **Парной серии.** Ни колонки, ни функции, ни числа в ответе. Она выводится из отметок на
-- клиенте (`pairProgress` в src/social/circles.ts), и посчитать её на сервере нечем по существу:
-- своя половина читается из **твоих дней**, а дороги на сервере нет и не будет — политика на
-- `roads` говорит, что чужую дорогу не читает никто, включая друзей. Второй экземпляр выводимого
-- числа однажды разошёлся бы с первым, и человек увидел бы «вместе 12 дней» над дорогой, на
-- которой их девять.
--
-- **Ничего про твой день.** Ни `completionRate`, ни цвета, ни угла, ни серии, ни вехи. Её отметка
-- не влияет ни на что в твоём дне — это главное правило кружка, и здесь оно выражено тем, что
-- прочитать про твой день отсюда нечего.
--
-- **Счёта «кто больше».** Ни второй колонки «ты 6 из 7, она 5 из 7», ни истории пропусков, ни
-- уведомления о её пропуске. Приложение, натравливающее одного человека на другого, начинается с
-- такой строки в схеме.
