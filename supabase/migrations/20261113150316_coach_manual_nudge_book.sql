-- 153 매뉴얼 2권 — 「읽어 주세요」 알림이 그 책으로 가게 (2026-11-13 대표님 「추천대로 진행하자」 — 2권은 1권과 따로 열고 아홉 장 필독)
--   예전: 어느 책이든 제목 '📘 153 매뉴얼을 읽어 주세요' · 링크 /office?tab=manual → 2권 알림을 눌러도 1권이 열렸다
--   지금: 1권은 예전 그대로 · 2권부터는 제목에 책 번호(책 줄 data.no — '2권') · 링크에 &book=<책> (화면 ManualTab 이 그 책을 연다)
--   그 밖(권한 · 지점 · 20시간 · 남은 장 글)은 20261111131159_coach_manual.sql 그대로 — 운영 정의(md5 03819716…)를 읽고 그 위에 고침
--   2권 글(책 JSON)은 저장소에 두지 않는다 — DB coach_manual_books 에만

create or replace function public.coach_manual_nudge(p_book text, p_user uuid, p_left int default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_by jsonb;
  v_last timestamptz;
  v_no text;
begin
  if not public._strategy_can_direct(v_uid) then
    raise exception '알림은 대표님 · 지점장님만 보낼 수 있어요';
  end if;
  if p_book is null or p_book !~ '^[a-z0-9_]{1,24}$' then
    raise exception '책을 찾을 수 없어요';
  end if;
  -- 같은 지점 코치님만 · 대표님 계정과 본인은 대상이 아님
  perform public._coach_target_branch(v_uid, p_user);

  perform pg_advisory_xact_lock(hashtext('coach_manual_nudge:' || p_user::text || ':' || p_book));
  select n.nudged_at into v_last from public.coach_manual_nudges n where n.user_id = p_user and n.book = p_book;
  if v_last is not null and v_last > now() - interval '20 hours' then
    return 'too_soon';
  end if;

  insert into public.coach_manual_nudges (user_id, book, nudged_by, nudged_at)
  values (p_user, p_book, v_uid, now())
  on conflict (user_id, book) do update set nudged_by = excluded.nudged_by, nudged_at = excluded.nudged_at;

  -- 2권부터 — 책 번호(예: '2권')를 제목에
  if p_book <> 'book1' then
    select nullif(btrim(b.data ->> 'no'), '') into v_no from public.coach_manual_books b where b.book = p_book;
    if v_no is not null and char_length(v_no) > 8 then
      v_no := null;
    end if;
  end if;

  v_by := public._strategy_display(v_uid);
  insert into public.notifications (user_id, title, body, link)
  values (p_user,
          case when v_no is not null then '📘 153 매뉴얼 ' || v_no || '을 읽어 주세요' else '📘 153 매뉴얼을 읽어 주세요' end,
          coalesce(v_by ->> 'name', '') || ' ' || coalesce(v_by ->> 'title', '') || '님이 보냈어요'
            || case when p_left is not null and p_left > 0 then ' · 남은 장 ' || least(p_left, 99) || '개' else '' end
            || ' · 한 장에 3–6분',
          '/office?tab=manual' || case when p_book <> 'book1' then '&book=' || p_book else '' end);
  return 'sent';
end $$;

revoke all on function public.coach_manual_nudge(text, uuid, int) from public, anon;
grant execute on function public.coach_manual_nudge(text, uuid, int) to authenticated;
