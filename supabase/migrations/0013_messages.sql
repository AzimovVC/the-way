-- Messages between friends: GIFs for now.
--
-- The first table in the app that one person writes into another person's app. The owner's
-- decision of 23 September 2026 lifted the old rule ("the heart is the only reaction"); this file
-- is where the channel it opened is fenced in. The path is GIFs → voice → video notes, and it is
-- one table with a closed list of kinds rather than three mechanisms: a new kind is a line in the
-- `kind` check and a branch on the client (docs/ideas.md).
--
-- **Nothing here is stored that the provider already stores.** A GIF row carries the provider's id,
-- two links and the size — about two hundred bytes. The bytes live at KLIPY. Rows expire after a
-- week (the feed's window, FEED_WINDOW_DAYS) and an inbox never holds more than 30; both are swept
-- on insert, so the table stays small without a scheduled job.
--
-- Same order as 0001–0012: table, `enable row level security`, grants, policies — before any data.
-- The client key is public and ships in the bundle.
--
-- Safe to run again.

create table if not exists public.messages (
  -- Minted by the sender (`newId`), like every key in the app: a retried send is the same message,
  -- not a second one.
  id uuid primary key,

  -- `default auth.uid()` and the client never sends it: a field that is sent is a field that can be
  -- sent as somebody else.
  sender_id uuid not null default auth.uid() references auth.users on delete cascade,
  recipient_id uuid not null references auth.users on delete cascade,

  -- Closed list. A kind has to have its own drawing on the screen; a free value here would be a
  -- message nobody knows how to show.
  kind text not null check (kind in ('gif')),

  gif_id text check (char_length(gif_id) between 1 and 64),

  -- The links are the one thing the recipient's phone will fetch on the sender's say-so, so they are
  -- pinned to the provider's hosts. Without this a row inserted from the console could point at any
  -- server and learn the recipient's IP the moment the road opens.
  preview_url text check (preview_url ~ '^https://([a-z0-9-]+\.)*klipy\.com/' and char_length(preview_url) <= 512),
  full_url text check (full_url ~ '^https://([a-z0-9-]+\.)*klipy\.com/' and char_length(full_url) <= 512),
  width int check (width between 1 and 4000),
  height int check (height between 1 and 4000),

  sent_at timestamptz not null default now(),

  constraint messages_not_self check (sender_id <> recipient_id),
  constraint messages_gif_complete check (
    kind <> 'gif'
    or (gif_id is not null and preview_url is not null and full_url is not null
        and width is not null and height is not null)
  )
);

-- The only question asked of the table: what is waiting for me.
create index if not exists messages_inbox_idx on public.messages (recipient_id, sent_at desc);

alter table public.messages enable row level security;

revoke all on public.messages from anon, authenticated;
-- No `update`: a sent GIF is not edited. It is read and dropped, or taken back.
grant select, insert, delete on public.messages to authenticated;

drop policy if exists "письмо видят двое" on public.messages;
create policy "письмо видят двое"
  on public.messages for select
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Only to a friend, and only when neither side has closed the other. The friendship check is the
-- same one the feed uses (0010): whoever cannot see your week cannot write to you either.
drop policy if exists "пишешь только другу" on public.messages;
create policy "пишешь только другу"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.friendships
      where a_id = least(auth.uid(), recipient_id) and b_id = greatest(auth.uid(), recipient_id)
    )
    and not exists (
      select 1 from public.blocks
      where (blocker_id = auth.uid() and blocked_id = recipient_id)
         or (blocker_id = recipient_id and blocked_id = auth.uid())
    )
  );

-- The recipient drops it once seen; the sender can take it back before that.
drop policy if exists "письмо убирают двое" on public.messages;
create policy "письмо убирают двое"
  on public.messages for delete
  to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- Guard and sweep
-- ---------------------------------------------------------------------------------------------

-- A cap per pair per hour. A GIF is a nudge; without a cap, "nudge" becomes "flood", and the one on
-- the receiving end has no way to say so short of blocking a friend.
create or replace function public.messages_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if (
    select count(*) from public.messages
    where sender_id = new.sender_id and recipient_id = new.recipient_id
      and sent_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'too many messages' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard on public.messages;
create trigger messages_guard
  before insert on public.messages
  for each row execute function public.messages_guard();

-- The sweep runs on the recipient's inbox, at the moment it grows: older than a week goes, and so
-- does anything past the newest 30. `security definer` because the sender cannot delete somebody
-- else's mail by policy — and should not, except through exactly this.
create or replace function public.messages_sweep() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.messages
  where recipient_id = new.recipient_id
    and (
      sent_at < now() - interval '7 days'
      or id in (
        select id from public.messages
        where recipient_id = new.recipient_id
        order by sent_at desc
        offset 30
      )
    );
  return null;
end;
$$;

drop trigger if exists messages_sweep on public.messages;
create trigger messages_sweep
  after insert on public.messages
  for each row execute function public.messages_sweep();

-- A pair that stopped being friends — unfriended or blocked (`friend_block` removes the friendship
-- first) — takes its unread mail with it. A GIF from someone you just blocked, still waiting by
-- today's circle, would be the one thing blocking promised to end.
create or replace function public.messages_unlink() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.messages
  where (sender_id = old.a_id and recipient_id = old.b_id)
     or (sender_id = old.b_id and recipient_id = old.a_id);
  return old;
end;
$$;

drop trigger if exists messages_unlink on public.friendships;
create trigger messages_unlink
  after delete on public.friendships
  for each row execute function public.messages_unlink();

-- ---------------------------------------------------------------------------------------------
-- Inbox in one answer
-- ---------------------------------------------------------------------------------------------

-- What is waiting for me, oldest first — read in the order it was sent. `security invoker`: the
-- policies above decide what comes back. The week is filtered here as well as swept on insert,
-- because an inbox nobody has written to since has not been swept.
create or replace function public.messages_view() returns jsonb
language sql stable set search_path = public, pg_temp as $$
  select coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'kind', m.kind,
        'sender', jsonb_build_object('id', p.id, 'handle', p.handle, 'name', p.name),
        'gif_id', m.gif_id,
        'preview_url', m.preview_url,
        'full_url', m.full_url,
        'width', m.width,
        'height', m.height,
        'sent_at', m.sent_at
      ) order by m.sent_at
    )
    from public.messages m
    join public.profiles p on p.id = m.sender_id
    where m.recipient_id = auth.uid() and m.sent_at > now() - interval '7 days'
  ), '[]'::jsonb);
$$;

revoke execute on function public.messages_view() from public;
grant execute on function public.messages_view() to authenticated;

-- Drop what was seen, and answer with what is left — the whole view, like every edit in the app.
create or replace function public.messages_dismiss(ids uuid[]) returns jsonb
language plpgsql set search_path = public, pg_temp as $$
begin
  delete from public.messages where recipient_id = auth.uid() and id = any(ids);
  return public.messages_view();
end;
$$;

revoke execute on function public.messages_dismiss(uuid[]) from public;
grant execute on function public.messages_dismiss(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Report reason
-- ---------------------------------------------------------------------------------------------

-- A GIF is the first thing in the app a person did not write themselves, and it needs its own
-- reason: "offensive name, handle or habit" does not cover it.
alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports
  add constraint reports_reason_check check (reason in ('offensive', 'impersonation', 'spam', 'gif'));

-- ---------------------------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------------------------

-- A GIF arrives on the open road, not on the next launch. Realtime hands a row only to whoever a
-- plain `select` would hand it to.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

select
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass) as rls,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'messages') as policies,
  (select count(*) from pg_trigger
    where tgname in ('messages_guard', 'messages_sweep', 'messages_unlink') and not tgisinternal) as triggers;
