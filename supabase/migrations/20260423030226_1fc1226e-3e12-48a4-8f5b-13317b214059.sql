
-- Enable pgvector
create extension if not exists vector;

-- Profiles
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "view own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
create policy "update own profile" on public.profiles for update using (auth.uid() = user_id);

-- Papers
create table public.papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  file_url text,
  source_type text not null default 'pdf',
  extracted_text text,
  status text not null default 'pending',
  error_message text,
  uploaded_at timestamptz not null default now()
);
alter table public.papers enable row level security;
create policy "select own papers" on public.papers for select using (auth.uid() = user_id);
create policy "insert own papers" on public.papers for insert with check (auth.uid() = user_id);
create policy "update own papers" on public.papers for update using (auth.uid() = user_id);
create policy "delete own papers" on public.papers for delete using (auth.uid() = user_id);

-- Chunks
create table public.paper_chunks (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  created_at timestamptz not null default now()
);
alter table public.paper_chunks enable row level security;
create policy "select own chunks" on public.paper_chunks for select using (auth.uid() = user_id);
create policy "insert own chunks" on public.paper_chunks for insert with check (auth.uid() = user_id);
create policy "delete own chunks" on public.paper_chunks for delete using (auth.uid() = user_id);
create index paper_chunks_paper_id_idx on public.paper_chunks(paper_id);

-- Embeddings (text-embedding-004 = 768 dims)
create table public.paper_embeddings (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  chunk_id uuid not null references public.paper_chunks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  embedding vector(768) not null,
  created_at timestamptz not null default now()
);
alter table public.paper_embeddings enable row level security;
create policy "select own embeddings" on public.paper_embeddings for select using (auth.uid() = user_id);
create policy "insert own embeddings" on public.paper_embeddings for insert with check (auth.uid() = user_id);
create policy "delete own embeddings" on public.paper_embeddings for delete using (auth.uid() = user_id);
create index paper_embeddings_ivf on public.paper_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Summaries
create table public.summaries (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.papers(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_text text not null,
  created_at timestamptz not null default now()
);
alter table public.summaries enable row level security;
create policy "select own summaries" on public.summaries for select using (auth.uid() = user_id);
create policy "insert own summaries" on public.summaries for insert with check (auth.uid() = user_id);
create policy "update own summaries" on public.summaries for update using (auth.uid() = user_id);

-- Chat history
create table public.chat_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id uuid references public.papers(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_history enable row level security;
create policy "select own chat" on public.chat_history for select using (auth.uid() = user_id);
create policy "insert own chat" on public.chat_history for insert with check (auth.uid() = user_id);
create policy "delete own chat" on public.chat_history for delete using (auth.uid() = user_id);
create index chat_history_paper_idx on public.chat_history(paper_id, created_at);

-- RAG search function
create or replace function public.match_paper_chunks(
  query_embedding vector(768),
  match_paper_id uuid,
  match_count int default 5
)
returns table (
  chunk_id uuid,
  chunk_text text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pc.id as chunk_id,
    pc.chunk_text,
    1 - (pe.embedding <=> query_embedding) as similarity
  from public.paper_embeddings pe
  join public.paper_chunks pc on pc.id = pe.chunk_id
  where pe.paper_id = match_paper_id
    and pe.user_id = auth.uid()
  order by pe.embedding <=> query_embedding
  limit match_count;
$$;

-- updated_at trigger
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

-- Storage bucket
insert into storage.buckets (id, name, public) values ('papers', 'papers', false);

create policy "users read own papers files" on storage.objects for select
  using (bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users upload own papers files" on storage.objects for insert
  with check (bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users delete own papers files" on storage.objects for delete
  using (bucket_id = 'papers' and auth.uid()::text = (storage.foldername(name))[1]);
