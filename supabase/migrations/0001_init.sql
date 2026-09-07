-- Vet Clinic Chatbot — initial schema
-- Run this against your Supabase project (SQL editor or `supabase db push`).

create extension if not exists "pgcrypto";

create table if not exists vet_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  customer_name text,
  customer_contact text,
  status text not null default 'active' check (status in ('active', 'escalated', 'resolved')),
  urgency text check (urgency in ('routine', 'urgent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'bot', 'vet', 'system')),
  sender_id uuid references auth.users (id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists escalation_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations (id) on delete cascade,
  category text not null,
  urgency text check (urgency in ('routine', 'urgent')),
  reason text not null,
  classifier_model text not null,
  raw_output jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_created_at_idx
  on messages (conversation_id, created_at);

create index if not exists conversations_status_urgency_idx
  on conversations (status, urgency, created_at);

-- Keep updated_at current on conversations.
create or replace function set_conversations_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists conversations_updated_at on conversations;
create trigger conversations_updated_at
  before update on conversations
  for each row
  execute function set_conversations_updated_at();

-- Row Level Security: only authenticated vets can read. All writes happen
-- server-side via the service-role key (which bypasses RLS), including vet
-- replies and status transitions — the API routes enforce those rules, not
-- direct client inserts. Anonymous customers never talk to Supabase directly.
alter table vet_profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table escalation_events enable row level security;

create policy "vets can read their own profile"
  on vet_profiles for select
  to authenticated
  using (id = auth.uid());

create policy "vets can read all conversations"
  on conversations for select
  to authenticated
  using (true);

create policy "vets can read all messages"
  on messages for select
  to authenticated
  using (true);

create policy "vets can read all escalation events"
  on escalation_events for select
  to authenticated
  using (true);
