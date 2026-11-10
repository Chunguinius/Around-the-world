-- Around the World: database, security rules and storage for shared 360 tours.
-- Safe to run more than once.

create table if not exists public.tours (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  author      text not null default '' check (char_length(author) <= 80),
  title       text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  location    text not null default '' check (char_length(location) <= 120),
  category    text not null default 'Other' check (char_length(category) <= 40),
  visibility  text not null default 'public' check (visibility in ('public', 'unlisted')),
  cover       text,
  data        jsonb not null default '{}'::jsonb check (pg_column_size(data) < 400000),
  scene_count integer not null default 0 check (scene_count between 0 and 200),
  views       bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists tours_public_idx on public.tours (created_at desc) where visibility = 'public';
create index if not exists tours_owner_idx on public.tours (owner, updated_at desc);

alter table public.tours enable row level security;

-- Anyone can list public tours; owners can list their own. Unlisted tours are reached through get_tour().
drop policy if exists "tours are readable when public or own" on public.tours;
create policy "tours are readable when public or own" on public.tours
  for select using (visibility = 'public' or owner = (select auth.uid()));

drop policy if exists "users create their own tours" on public.tours;
create policy "users create their own tours" on public.tours
  for insert to authenticated with check (owner = (select auth.uid()));

drop policy if exists "users update their own tours" on public.tours;
create policy "users update their own tours" on public.tours
  for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

drop policy if exists "users delete their own tours" on public.tours;
create policy "users delete their own tours" on public.tours
  for delete to authenticated using (owner = (select auth.uid()));

-- Visitors only read; signed-in users write, but can never set the view counter or the owner
-- (the owner column is filled in by its default, auth.uid()).
revoke all on public.tours from anon, authenticated;
grant select on public.tours to anon, authenticated;
grant delete on public.tours to authenticated;
grant insert (id, author, title, description, location, category, visibility, cover, data, scene_count, updated_at)
  on public.tours to authenticated;
grant update (author, title, description, location, category, visibility, cover, data, scene_count, updated_at)
  on public.tours to authenticated;

-- Open one tour by id (this is how share links work, including unlisted tours).
create or replace function public.get_tour(tour_id uuid)
returns setof public.tours
language sql stable security definer set search_path = ''
as $$ select * from public.tours where id = tour_id $$;

create or replace function public.bump_views(tour_id uuid)
returns void
language sql security definer set search_path = ''
as $$ update public.tours set views = views + 1 where id = tour_id $$;

revoke all on function public.get_tour(uuid) from public;
revoke all on function public.bump_views(uuid) from public;
grant execute on function public.get_tour(uuid) to anon, authenticated;
grant execute on function public.bump_views(uuid) to anon, authenticated;

-- Panorama storage: public to view, each user writes only inside their own folder (<user id>/<tour id>/file).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('panoramas', 'panoramas', true, 26214400, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "panoramas: owners list their files" on storage.objects;
create policy "panoramas: owners list their files" on storage.objects
  for select to authenticated
  using (bucket_id = 'panoramas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "panoramas: owners upload" on storage.objects;
create policy "panoramas: owners upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'panoramas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "panoramas: owners replace" on storage.objects;
create policy "panoramas: owners replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'panoramas' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'panoramas' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "panoramas: owners delete" on storage.objects;
create policy "panoramas: owners delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'panoramas' and (storage.foldername(name))[1] = (select auth.uid())::text);
