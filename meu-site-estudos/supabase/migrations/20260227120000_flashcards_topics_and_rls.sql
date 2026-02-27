-- Estrutura para novo fluxo: Curso > Disciplina > Assunto > Tópico > Deck > Cards

create extension if not exists pgcrypto;

create table if not exists public.flash_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flash_disciplines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.flash_courses(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flash_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  discipline_id uuid not null references public.flash_disciplines(id) on delete cascade,
  nome text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.flash_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.flash_subjects(id) on delete cascade,
  discipline_id uuid references public.flash_disciplines(id) on delete cascade,
  nome text,
  name text,
  created_at timestamptz not null default now(),
  constraint flash_topics_nome_required check (coalesce(nullif(trim(nome), ''), nullif(trim(name), '')) is not null)
);

alter table public.flash_decks
  add column if not exists subject_id uuid references public.flash_subjects(id) on delete cascade,
  add column if not exists topic_id uuid references public.flash_topics(id) on delete cascade,
  add column if not exists nome text;

alter table public.flash_cards
  add column if not exists tipo text not null default 'normal',
  add column if not exists pergunta text,
  add column if not exists resposta text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists favoritos boolean not null default false,
  add column if not exists cloze_text text,
  add column if not exists cloze_answer text;

create index if not exists flash_courses_user_idx on public.flash_courses(user_id);
create index if not exists flash_disciplines_course_idx on public.flash_disciplines(course_id);
create index if not exists flash_subjects_discipline_idx on public.flash_subjects(discipline_id);
create index if not exists flash_topics_subject_idx on public.flash_topics(subject_id);
create index if not exists flash_decks_topic_idx on public.flash_decks(topic_id);
create index if not exists flash_cards_deck_idx on public.flash_cards(deck_id);

alter table public.flash_courses enable row level security;
alter table public.flash_disciplines enable row level security;
alter table public.flash_subjects enable row level security;
alter table public.flash_topics enable row level security;
alter table public.flash_decks enable row level security;
alter table public.flash_cards enable row level security;

create policy if not exists "flash_courses_owner_all"
on public.flash_courses
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "flash_disciplines_owner_all"
on public.flash_disciplines
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "flash_subjects_owner_all"
on public.flash_subjects
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "flash_topics_owner_all"
on public.flash_topics
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "flash_decks_owner_all"
on public.flash_decks
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy if not exists "flash_cards_owner_all"
on public.flash_cards
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
