-- Возраст события в часах: момент рядом с днём.
--
-- Лента говорила в днях — «Сегодня», «Вчера», «3 дня назад», — и для события, которое **выведено**
-- из дороги, это единственно честный ответ: у метки дороги, у возвращения и у заморозки есть день,
-- но нет минуты. У трёх родов, которые уезжают наружу, минута есть: новую привычку человек завёл в
-- названную секунду, а ступень ему в названную секунду выдали. Этот столбец её и везёт.
--
-- Почему не `created_at`, который здесь уже лежит: он говорит, когда копия доехала. Выгрузка идёт
-- по тому же таймеру, что числа профиля и полка, поэтому ступень, взятая в субботу и уехавшая в
-- понедельник, получила бы «2 часа назад» про позавчера. Момент присылает та сторона — как и
-- `happened_on`, и по той же причине.
--
-- Столбец **необязательный**, и это несущее свойство, а не поблажка миграции: событие без
-- записанного момента не получает выдуманного. Сборка живёт на телефоне неделями, и до неё сюда
-- будут приезжать строки без него.
--
-- Файл запускается повторно без вреда.

alter table public.feed_events
  add column if not exists happened_at timestamptz;

-- Вид пересобирается целиком: `create or replace` не умеет добавлять поле в `jsonb_build_object`
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
