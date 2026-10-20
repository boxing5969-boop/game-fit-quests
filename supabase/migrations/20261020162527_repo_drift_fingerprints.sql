-- 🔎 DB 어긋남 점검용 지문 (2026-10-20 대표님: "여러 계정으로 업데이트해도 문제 없이 앱에 잘 적용되게")
--
--   두 계정이 운영 DB 함수를 직접 고친다. 저장소 마이그레이션에 없는 수정이 생기면
--   다음에 누가 저장소 파일로 함수를 다시 만들 때 그 수정이 조용히 사라진다.
--   scripts/check-db-drift.mjs 가 이 함수로 운영 DB 의 함수 본문 지문(md5)을 받아
--   저장소 supabase/migrations 의 마지막 정의와 비교한다 (GitHub Actions 「DB 어긋남 점검」 매일 07:40 KST).
--
--   돌려주는 것: public 스키마 함수의 이름 · 인자 · 본문 md5 뿐 (본문 자체·회원 데이터 없음).
--   저장소가 공개라 함수 본문은 이미 공개돼 있고, md5 로는 본문을 알 수 없다 → 로그인 없이(anon) 읽게 한다.
--   본문 정규화(스크립트와 같은 규칙): \r 제거 → -- 주석 · /* */ 주석 제거 → 공백 묶음을 한 칸으로 → 앞뒤 공백 제거.
--   주석·줄바꿈만 다른 것은 같은 함수로 본다(동작이 같다).

create or replace function public.repo_drift_fingerprints()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'name', p.proname::text,
           'args', pg_get_function_identity_arguments(p.oid),
           'md5', md5(btrim(regexp_replace(regexp_replace(regexp_replace(
                    replace(p.prosrc, E'\r', ''),
                    '--[^\n]*', '', 'g'),
                    '/\*.*?\*/', '', 'g'),
                    '[ \t\n\f\v]+', ' ', 'g'), ' '))
         ) order by p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind in ('f', 'p')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
$$;

revoke all on function public.repo_drift_fingerprints() from public;
grant execute on function public.repo_drift_fingerprints() to anon, authenticated;
