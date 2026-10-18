-- 커뮤니티 글 공개 범위 값에 '나만 보기(private)' 를 더한다 (2026-10-18 — 20261018110000_community_visibility_private.sql 과 한 묶음).
--   branch = 전체 공개 · partners = 친구만 · private = 나만 보기. CHECK 규칙은 고칠 수 없어서 바꿔 끼운다 (있는 글은 그대로).
alter table public.champion_journal_entries drop constraint if exists champion_journal_entries_visibility_chk;
alter table public.champion_journal_entries
  add constraint champion_journal_entries_visibility_chk check (visibility in ('branch', 'partners', 'private'));
