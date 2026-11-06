-- LBS Viaggio: profili utente e viaggi salvati sull'account.
-- Da eseguire una volta: Supabase → SQL Editor → incolla ed esegui (oppure `supabase db push`).
-- Ogni utente vede e modifica SOLO i propri dati (Row Level Security).

-- ---------- profili ----------
create table if not exists public.profili (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  telefono text,
  creato timestamptz not null default now()
);

alter table public.profili enable row level security;

drop policy if exists "profilo: lettura propria" on public.profili;
create policy "profilo: lettura propria" on public.profili
  for select using (auth.uid() = id);

drop policy if exists "profilo: modifica propria" on public.profili;
create policy "profilo: modifica propria" on public.profili
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- alla registrazione crea il profilo con nome e telefono inseriti nell'app
create or replace function public.crea_profilo()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profili (id, nome, telefono)
  values (new.id, new.raw_user_meta_data ->> 'nome', new.raw_user_meta_data ->> 'telefono')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profilo on auth.users;
create trigger on_auth_user_created_profilo
  after insert on auth.users
  for each row execute function public.crea_profilo();

-- ---------- viaggi ----------
create table if not exists public.viaggi (
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  id text not null,
  dati jsonb not null,          -- biglietto + soluzione scelta, come salvati nell'app
  partenza timestamptz,
  aggiornato timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists viaggi_partenza on public.viaggi (user_id, partenza);

alter table public.viaggi enable row level security;

drop policy if exists "viaggi: solo i propri" on public.viaggi;
create policy "viaggi: solo i propri" on public.viaggi
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
