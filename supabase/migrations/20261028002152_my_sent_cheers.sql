-- 보낸 응원 보기 (2026-10-28 회원 제안 — 선릉역점 "응원보내기를 누구한테했는지도 볼수있었으면좋겠어요")
--
-- get_my_sent_cheers(p_limit) — 내가 보낸 응원 목록 (본인 것만, 읽기 전용)
--   모양은 get_my_received_cheers 와 같고 사람만 받은 사람(receiver)으로 바뀐다.
--   thanked = 받은 동료가 '고마워요 153'을 눌렀는지 (boxing_cheers.thanked_at)
--   화면: 내정보 '받은 · 보낸 응원' 창의 '보낸 응원' 칸 · 응원 보내기 창 '보낸 응원 보기'
-- 새 함수만 더한다 — 기존 함수 동작은 그대로.

create or replace function public.get_my_sent_cheers(p_limit integer default 50)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_total integer;
  v_thanked integer;
  v_out jsonb;
begin
  if v_uid is null then raise exception '로그인이 필요합니다'; end if;
  if not public._is_active_member(v_uid) then
    return jsonb_build_object('total', 0, 'thanked', 0, 'items', '[]'::jsonb);
  end if;

  select count(*), count(*) filter (where c.thanked_at is not null)
    into v_total, v_thanked
    from public.boxing_cheers c where c.sender_user_id = v_uid;

  select coalesce(jsonb_agg(x.item order by x.at desc), '[]'::jsonb) into v_out
    from (
      select c.created_at as at,
             jsonb_build_object(
               'id', c.id,
               'type', c.cheer_type,
               'receiver_id', c.receiver_user_id,
               'receiver', coalesce(nullif(btrim(p.nickname), ''), nullif(btrim(p.name), ''), '동료'),
               'receiver_avatar', p.avatar_url,
               'receiver_staff', coalesce(p.is_staff, false),
               'sticker', case when c.cheer_type = 'clap' then '승급 축하 박수'
                               else coalesce(nullif(c.metadata->>'sticker', ''), split_part(coalesce(c.message, ''), ' — ', 1)) end,
               'note', case when c.cheer_type = 'clap' then null
                            when c.metadata ? 'sticker' then nullif(c.metadata->>'note', '')
                            when position(' — ' in coalesce(c.message, '')) > 0
                              then nullif(btrim(substr(c.message, position(' — ' in c.message) + 3)), '')
                            else null end,
               'at', c.created_at,
               'thanked', c.thanked_at is not null
             ) as item
        from public.boxing_cheers c
        left join public.profiles p on p.user_id = c.receiver_user_id
       where c.sender_user_id = v_uid
       order by c.created_at desc
       limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) x;

  return jsonb_build_object('total', v_total, 'thanked', v_thanked, 'items', v_out);
end $function$;

revoke all on function public.get_my_sent_cheers(integer) from public, anon;
grant execute on function public.get_my_sent_cheers(integer) to authenticated;
