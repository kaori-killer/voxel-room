-- 복셀 공방 스키마. Supabase SQL Editor 에 그대로 붙여 넣는다.

create table if not exists public.rooms (
  id text primary key,
  title text not null default '이름 없는 방',
  data jsonb not null default '{}'::jsonb,
  owner_key_hash text not null,
  thumbnail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rooms_updated_at_idx on public.rooms (updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms (id) on delete cascade,
  role text not null check (role in ('visitor', 'admin')),
  author_name text not null,
  body text not null check (char_length(body) between 1 and 800),
  visitor_key_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_room_created_idx
  on public.chat_messages (room_id, created_at);

-- 서버(route handler)만 service role 로 접근한다. 브라우저에서 직접 오는 요청은 막는다.
alter table public.rooms enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "rooms are service-role only" on public.rooms;
create policy "rooms are service-role only" on public.rooms
  for all using (false) with check (false);

drop policy if exists "chat is service-role only" on public.chat_messages;
create policy "chat is service-role only" on public.chat_messages
  for all using (false) with check (false);
