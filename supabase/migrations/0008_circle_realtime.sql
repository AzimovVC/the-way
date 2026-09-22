-- «Ты нажал — она видит»: то, ради чего кружок вообще уехал на сервер.
--
-- Отдельным файлом от 0007 нарочно. Публикация — **настройка проекта**, а не форма данных: она не
-- меняет ни одной колонки и ни одного правила, и запускать её можно (и придётся) отдельно от
-- схемы. Смешанные в одном файле, они однажды заставили бы перезапускать схему ради строки про
-- вещание — или наоборот, оставили бы живое приложение без вещания после аккуратной правки схемы.
--
-- **Политики действуют и здесь.** Realtime отдаёт строку только тому, кому её отдала бы обычная
-- `select`: чужую пару не слушает никто. Это не свойство вещания, а следствие RLS из 0007, и
-- проверять его надо тем же способом — запуском (tests/rls.sql).
--
-- Сам клиент из пришедшей строки **не читает ничего**: пришло событие — экран спрашивает
-- `circles_view()` целиком (`circleWatch` в src/social/supabaseClient.ts). Поэтому даже событие,
-- пришедшее не по делу, не может показать человеку чужую отметку.
--
-- Файл запускается повторно без вреда.

do $$
begin
  -- Три таблицы, и каждая по своей причине: отметки — ради самой галочки; кружки — ради выхода,
  -- который закрывает строку, а не уносит её; приглашения — чтобы позвавший увидел согласие, не
  -- открывая экран заново.
  --
  -- `roads` здесь нет и быть не может: дорога не социальные данные, её не слушает даже её хозяин.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'circle_marks'
  ) then
    alter publication supabase_realtime add table public.circle_marks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'circles'
  ) then
    alter publication supabase_realtime add table public.circles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'circle_invites'
  ) then
    alter publication supabase_realtime add table public.circle_invites;
  end if;
end;
$$;

select string_agg(tablename, ', ' order by tablename) as "вещают"
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public';
