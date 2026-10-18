-- 153마인드셋 '나의 한마디'(큐 워드) — 힘들 때 꺼내는 짧은 말 ("가드 업", "한 번 더") (2026-10-19)
--   벤치마킹: 스포츠 심상 앱(MindSport 등)은 세션 끝에 큐 워드를 새겨서 실제 경기에서 그 말 한마디로 장면을 불러온다.
--   대본의 {cue} 에 들어간다. 목표 한 문장과 같이 저장한다.
alter table public.mindset_profiles add column if not exists cue text check (char_length(cue) <= 20);

create or replace function public.set_mindset_profile(p_goal text, p_cue text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_goal text := nullif(left(btrim(coalesce(p_goal, '')), 60), '');
  v_cue text := nullif(left(btrim(coalesce(p_cue, '')), 20), '');
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  insert into public.mindset_profiles (user_id, goal, cue, updated_at) values (v_uid, v_goal, v_cue, now())
  on conflict (user_id) do update set goal = excluded.goal, cue = excluded.cue, updated_at = now();
  return jsonb_build_object('goal', v_goal, 'cue', v_cue);
end $function$;
revoke all on function public.set_mindset_profile(text, text) from public, anon;
grant execute on function public.set_mindset_profile(text, text) to authenticated;

-- 통계에 cue 도 돌려준다 (돌려주는 모양만 하나 늘어남)
do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.get_my_mindset_stats()'::regprocedure);
  if position('''cue''' in v_def) > 0 then return; end if;
  v_new := replace(v_def, $r$select goal into v_goal from public.mindset_profiles where user_id = v_uid;$r$,
                          $r$select goal, cue into v_goal, v_cue from public.mindset_profiles where user_id = v_uid;$r$);
  v_new := replace(v_new, $r$  v_by jsonb;$r$, $r$  v_by jsonb;
  v_cue text;$r$);
  v_new := replace(v_new, $r$'goal', v_goal$r$, $r$'goal', v_goal,
    'cue', v_cue$r$);
  if v_new = v_def or position('v_cue text' in v_new) = 0 or position('''cue'', v_cue' in v_new) = 0 then
    raise exception 'get_my_mindset_stats 고치기 실패';
  end if;
  execute v_new;
end $$;
