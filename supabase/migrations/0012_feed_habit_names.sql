-- Имена новых привычек одного дня — списком, потому что строка про них теперь одна.
--
-- Завести привычку стоит один тап, ступень стоит шестьдесят шесть дней, а в ленте они стояли
-- рядом одного размера. Человек, который за десять минут разложил свои дела по полкам, занимал у
-- друга всю неделю пятью одинаковыми «Новая привычка», и лента, состоящая из них, перестаёт
-- читаться вовсе. Событие теперь одно на день, и несёт оно все имена сразу.
--
-- Имена стоят в строке, а не сворачиваются в число: сердце говорят не замаху, а человеку. Число
-- при этом тоже есть — оно едет на знаке справа, как дни на медали ранга, — и считается по длине
-- этого списка. Поэтому тихой привычки (`private`) в нём не бывает: её убирает та сторона, до
-- отправки, иначе «3» при двух именах сообщает другу, что третья есть, но её прячут.
--
-- `title` остаётся заполненным первым именем и не становится вторым ответом на тот же вопрос:
-- миграция уезжает раньше сборки, а сборка живёт на телефоне неделями, и клиент, знающий только
-- `title`, обязан прочитать хотя бы одну привычку вместо пустых кавычек.
--
-- Столбец необязательный — по той же причине, по которой необязателен `happened_at`.
--
-- Файл запускается повторно без вреда.

alter table public.feed_events
  add column if not exists titles text[];

-- Вид пересобирается целиком: `create or replace` не умеет добавить поле в `jsonb_build_object`
-- иначе, а разбор на той стороне недоверчивый — незнакомого поля он не заметит, отсутствующего
-- тоже.
create or replace function public.feed_view(since date) returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', e.event_id,
          'person', jsonb_build_object('id', p.id, 'handle', p.handle, 'name', p.name),
          'happened_on', e.happened_on,
          'happened_at', e.happened_at,
          'kind', e.kind,
          'title', e.title,
          'titles', e.titles,
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
