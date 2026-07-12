-- Sparring participation consent forms (incl. minor guardian consent).
-- Member signs a safety consent before contact-level (Lv.26+) sparring; coach/admin confirms.
create table if not exists public.sparring_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  form_version text not null default 'v1',
  agreed_rules boolean not null default false,
  health_ok boolean not null default false,
  health_note text,
  participant_name text not null,
  is_minor boolean not null default false,
  guardian_name text,
  guardian_relation text,
  guardian_phone text,
  guardian_signature text,
  status text not null default 'signed',      -- signed | coach_confirmed | revoked
  coach_confirmed_by uuid references auth.users(id),
  coach_confirmed_at timestamptz,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.sparring_consents enable row level security;

create index if not exists sparring_consents_user_idx on public.sparring_consents (user_id, created_at desc);
create index if not exists sparring_consents_status_idx on public.sparring_consents (status);

-- RLS: member = own insert
drop policy if exists "sparring own insert" on public.sparring_consents;
create policy "sparring own insert"
  on public.sparring_consents
  for insert to authenticated
  with check (user_id = auth.uid());

-- RLS: member = own select
drop policy if exists "sparring own select" on public.sparring_consents;
create policy "sparring own select"
  on public.sparring_consents
  for select to authenticated
  using (user_id = auth.uid());

-- RLS: coach / branch_manager / admin / super_admin = read all (existing role model)
drop policy if exists "sparring staff select" on public.sparring_consents;
create policy "sparring staff select"
  on public.sparring_consents
  for select to authenticated
  using (exists (
    select 1 from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.role in ('coach','branch_manager','admin','super_admin')
  ));

-- RLS: staff = update (confirm). Column grant below restricts writable columns.
drop policy if exists "sparring staff update" on public.sparring_consents;
create policy "sparring staff update"
  on public.sparring_consents
  for update to authenticated
  using (exists (
    select 1 from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.role in ('coach','branch_manager','admin','super_admin')
  ))
  with check (exists (
    select 1 from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.role in ('coach','branch_manager','admin','super_admin')
  ));

-- Defense in depth: staff may only write confirm columns, never participant fields.
revoke update on public.sparring_consents from authenticated;
grant update (status, coach_confirmed_by, coach_confirmed_at) on public.sparring_consents to authenticated;

-- Coach confirm RPC — sets confirmer = caller, touches only the 3 confirm columns.
create or replace function public.confirm_sparring_consent(_consent_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_roles ur
     where ur.user_id = auth.uid()
       and ur.role in ('coach','branch_manager','admin','super_admin')
  ) then
    raise exception 'not authorized';
  end if;

  update public.sparring_consents
     set status = 'coach_confirmed',
         coach_confirmed_by = auth.uid(),
         coach_confirmed_at = now()
   where id = _consent_id;
end;
$$;

grant execute on function public.confirm_sparring_consent(uuid) to authenticated;
