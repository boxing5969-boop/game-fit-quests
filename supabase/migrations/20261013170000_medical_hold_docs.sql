-- ─────────────────────────────────────────────────────────────
-- 부상·질병 홀딩(병원 서류 첨부) — 회원 이용계약서 제3조(2026-10 개정안).
--   일반 홀딩 횟수·일수와 별도로 추가 홀딩. 관장(같은 지점)·본사가 서류를 보고 승인/반려.
--   서류는 비공개 버킷 hold-docs 에 두고, 처리(승인·반려) 직후 앱이 지운다 — 건강정보 최소 보관.
-- ─────────────────────────────────────────────────────────────

-- 1) 신청 테이블: 홀딩 종류 + 서류 경로
alter table public.membership_requests
  add column if not exists hold_kind text not null default 'regular',
  add column if not exists doc_path text;

do $$ begin
  alter table public.membership_requests
    add constraint membership_requests_hold_kind_chk check (hold_kind in ('regular', 'medical'));
exception when duplicate_object then null; end $$;

-- 부상·질병 홀딩은 홀딩 신청이어야 하고 서류가 반드시 있어야 한다
do $$ begin
  alter table public.membership_requests
    add constraint membership_requests_medical_doc_chk
    check (hold_kind <> 'medical' or (type = 'hold' and doc_path is not null));
exception when duplicate_object then null; end $$;

-- 서류 경로는 신청한 회원 본인 폴더만 가리킬 수 있다 (남의 서류 경로를 끼워 넣지 못하게)
do $$ begin
  alter table public.membership_requests
    add constraint membership_requests_doc_owner_chk
    check (doc_path is null or split_part(doc_path, '/', 1) = user_id::text);
exception when duplicate_object then null; end $$;

-- 2) 비공개 버킷 (10MB · 사진/PDF)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hold-docs', 'hold-docs', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 3) 서류 접근 판정 — 본인 · 본사(admin/super_admin) · 같은 지점 관장(is_same_branch)
--    (process_membership_request 의 처리 권한과 같은 범위). 경로 앞부분이 uuid 가 아니면 거부.
create or replace function public.can_access_hold_doc(_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _seg   text := split_part(coalesce(_name, ''), '/', 1);
  _owner uuid;
begin
  if _seg !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  _owner := _seg::uuid;
  return coalesce(
    auth.uid() = _owner
      or has_role(auth.uid(), 'admin')
      or has_role(auth.uid(), 'super_admin')
      or is_same_branch(_owner),
    false);
end;
$$;

revoke all on function public.can_access_hold_doc(text) from public, anon;
grant execute on function public.can_access_hold_doc(text) to authenticated;

-- 4) 스토리지 정책
drop policy if exists hold_docs_insert_own on storage.objects;
create policy hold_docs_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'hold-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists hold_docs_select on storage.objects;
create policy hold_docs_select on storage.objects
  for select to authenticated
  using (bucket_id = 'hold-docs' and public.can_access_hold_doc(name));

drop policy if exists hold_docs_delete on storage.objects;
create policy hold_docs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'hold-docs' and public.can_access_hold_doc(name));
