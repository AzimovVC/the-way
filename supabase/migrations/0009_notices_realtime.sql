-- Прощальная карточка доезжает до открытого экрана.
--
-- Продолжение [0008](0008_circle_realtime.sql), и отдельным файлом по той же причине: публикация —
-- настройка проекта, а не форма данных. 0008 завёл в вещание отметки, кружки и приглашения — всё,
-- чем кружок живёт, пока он живёт. Про его конец там не сказано ничего, и это было видно на двух
-- телефонах: второй вышел, строка пары у первого исчезла в ту же секунду (событие по `circles`
-- пришло), а сообщение о выходе ждало перезагрузки страницы.
--
-- То есть человек получал ровно **молчаливую пропажу второй кнопки** — то самое, от чего решение 3
-- в docs/circle.md уводит, заводя сообщение вместо неё.
--
-- Своей политики здесь не пишется и переписывать в 0007 нечего: `notices` уже отдаётся только
-- своему хозяину, а realtime отдаёт строку ровно тому, кому её отдала бы обычная `select`. Вещание
-- не расширяет доступ, оно только доносит.
--
-- Файл запускается повторно без вреда.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notices'
  ) then
    alter publication supabase_realtime add table public.notices;
  end if;
end;
$$;

select string_agg(tablename, ', ' order by tablename) as "вещают"
from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public';
