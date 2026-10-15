-- 회원 메모 = 관리자 전용 (2026-10-15 대표님: "메모는 회원관리 기능 — 아이디 당사자와 다른 사람은 못 보고,
-- 회원 특성 기록용으로 지점 관리자가 확인하는 기능")
--   · 회원 본인에게 보이던 'visible' 메모 읽기를 막는다 (지금까지 메모 0건)
--   · 지점장은 같은 지점 회원의 메모를 서로 함께 본다 (전에는 내가 쓴 것만) — is_same_branch 는 지점장·전체관리자만 참
--   · 쓰기는 지점장(같은 지점)·관리자, 항상 'internal' — 전체관리자는 기존 'Super admins manage all notes'
alter policy "Members view visible notes" on public.manager_notes using (false);

alter policy "Managers view own notes" on public.manager_notes
  using (
    manager_id = (select auth.uid())
    or public.is_same_branch(user_id)
    or public.has_role((select auth.uid()), 'admin'::app_role)
  );

alter policy "Branch managers create notes" on public.manager_notes
  with check (
    manager_id = (select auth.uid())
    and note_type = 'internal'
    and (public.is_same_branch(user_id) or public.has_role((select auth.uid()), 'admin'::app_role))
  );
