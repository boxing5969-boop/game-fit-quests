-- 칠금점도 시범 지점으로 — 선릉역점과 똑같이 테스트 (2026-10-21 대표님:
--   "153복싱짐 칠금점은 같이 테스트해 보려고 하는데, 여기는 브로제이를 쓰지 않아서 회원님들이 수동으로 해야 해.
--    모니터는 1개 있어서 모니터 1개로 사용해야 할 것 같아" → 범위: "선릉역점과 똑같이", 가입 알림: "켜기")
--
--   1) pilot_branch_names() 에 칠금점 추가 — 시범 지점에서 열리는 것이 칠금점 회원에게도 열린다:
--      프로필 사진 첫 등록 보상 · 알림 켜기 보상 · 화이트 타이틀매치(회원 신청 · 지점장 영상 심사) · TV 회원 사진.
--      앱 목록 src/lib/pilotBranches.ts 도 같은 커밋에서 같이 고친다.
--   2) 회원가입 알림(app_settings 'signup_alerts')에 칠금점 추가 — 선릉역점 · 칠금점 두 곳만 알림.
--      칠금점은 브로제이가 없어 자동 계정이 생기지 않는다 → 회원이 직접 가입하면 '승인 요청 · 가입' 알림이 온다.
--   3) 칠금점 보이게 (branches.is_visible) — 선릉역점처럼 지점 목록 · 전 지점 랭킹 · 명예의 전당에 나온다.
--      관리자 설정의 지점 켜기/끄기로 다시 끌 수 있다.
--   출석은 브로제이(얼굴) 대신 TV 라이브보드 QR 로만 한다 — 보드 안내 문구는 앱(LiveBoardQrCard)에서 지점별로 바꾼다.

create or replace function public.pilot_branch_names()
returns text[]
language sql
stable
set search_path = public
as $$ select array['153복싱짐 선릉역점', '153복싱짐 칠금점']::text[] $$;

revoke all on function public.pilot_branch_names() from public, anon, authenticated;

update public.app_settings
   set value = jsonb_set(
         value,
         '{branches}',
         (select coalesce(jsonb_agg(distinct b), '[]'::jsonb)
            from (
              select jsonb_array_elements_text(coalesce(value -> 'branches', '[]'::jsonb)) as b
              union
              select '153복싱짐 칠금점'
            ) x)
       ) || jsonb_build_object('note', '회원가입 알림(새 회원 · 자동 등록 / 승인 요청 · 가입)을 받을 지점. 2026-10-21 대표님: 선릉역점 · 칠금점. 다시 켜려면 지점 이름 추가 · 줄을 지우면 전 지점'),
       updated_at = now()
 where key = 'signup_alerts';

update public.branches set is_visible = true where name = '153복싱짐 칠금점';
