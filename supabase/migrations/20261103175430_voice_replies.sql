-- 고객의 소리에도 답변 (2026-11-03 대표님: "고객의 소리에도 답변 달수있게해줘 · 두가지 모두 한탭으로 합쳐줘 … 니가 추천해줘")
--
--   만족도 조사 답변(20261030100752_survey_replies.sql)과 같은 길을 고객의 소리에도 쓴다.
--   · 고객의 소리 글은 예전처럼 153OS member_feedback 에 익명으로 저장된다(본사 화면도 계속 익명).
--   · 보낸 사람 표(survey_receipts)에 종류 칸(kind) — 'satisfaction'(만족도 조사 · 기본) / 'feedback'(고객의 소리 · 153OS member_feedback.id).
--     고객의 소리 영수증은 회원이 직접 못 남긴다 — Edge Function member-voice-receipt 가 153OS 에서 방금 들어온 그 글을 찾아
--     서버 키로 남긴다(153OS 공개 경로 /api/feedback/submit 은 글 번호를 돌려주지 않아서).
--   · reply_survey_response: 알림 문구를 종류별로('💬 고객의 소리에 답변이 왔어요') · 대표님이 자동 답변을 고쳐 쓰면 auto=false.
--   · get_my_voice_receipts(): 회원 설문 화면 '내가 보낸 의견' — 만족도 조사 · 고객의 소리를 한 목록에(최근 30개).
--     옛 get_my_survey_receipts 는 그대로 둔다(아직 옛 화면을 연 휴대폰용).
--   · survey_auto_watch.kind 에 'voice'(고객의 소리 — 답이 없으면 대표님께 알림 한 번, survey-auto-reply 크론).
--   · 이미 앱에서 낸 고객의 소리(10/15~11/03 · 8건)는 참여 보상(survey_rewards kind 'feedback')이 글이 들어온 뒤 3초 안에
--     하나씩 짝지어 있어 그 회원으로 영수증을 따로 채웠다(데이터 작업 · 이 파일에는 넣지 않음).

alter table public.survey_receipts add column if not exists kind text not null default 'satisfaction';
alter table public.survey_receipts drop constraint if exists survey_receipts_kind_check;
alter table public.survey_receipts add constraint survey_receipts_kind_check check (kind in ('satisfaction', 'feedback'));

alter table public.survey_auto_watch drop constraint if exists survey_auto_watch_kind_check;
alter table public.survey_auto_watch add constraint survey_auto_watch_kind_check check (kind in ('positive', 'opinion', 'voice'));

-- 본사: 답변 쓰기 · 고치기 · 지우기(빈 글) — 앱에서 보낸 설문·의견이면 보낸 회원에게 알림 (종류별 문구)
create or replace function public.reply_survey_response(p_response_id uuid, p_reply text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_text text := left(trim(coalesce(p_reply, '')), 1000);
  v_to uuid;
  v_kind text;
begin
  if v_uid is null or not (public.has_role(v_uid, 'super_admin') or public.has_role(v_uid, 'admin')) then
    raise exception '본사만 답변을 달 수 있어요';
  end if;
  if p_response_id is null then raise exception '설문을 찾을 수 없어요'; end if;

  if v_text = '' then
    delete from public.survey_replies where response_id = p_response_id;
    return jsonb_build_object('ok', true, 'deleted', true, 'delivered', false);
  end if;

  -- 대표님이 쓰거나 고친 답변 = 직접 답변(auto false) — 자동 답변을 고쳐 써도 대표님 답변이 된다
  insert into public.survey_replies (response_id, reply, replied_by, replied_at, read_at, auto)
  values (p_response_id, v_text, v_uid, now(), null, false)
  on conflict (response_id) do update
    set reply = excluded.reply, replied_by = excluded.replied_by, replied_at = now(), read_at = null, auto = false;

  select r.user_id, r.kind into v_to, v_kind
    from public.survey_receipts r where r.response_id = p_response_id;
  if v_to is not null then
    insert into public.notifications (user_id, title, body, link)
    values (
      v_to,
      case when v_kind = 'feedback' then '💬 고객의 소리에 답변이 왔어요' else '💬 만족도 조사에 답변이 왔어요' end,
      left(v_text, 120),
      '/survey?mine=1'
    );
  end if;

  return jsonb_build_object('ok', true, 'deleted', false, 'delivered', v_to is not null);
end;
$function$;

-- 회원: 내가 앱에서 보낸 만족도 조사 · 고객의 소리 + 받은 답변 (최근 30개 · 나만)
create or replace function public.get_my_voice_receipts()
returns table (response_id uuid, kind text, title text, submitted_at timestamptz, reply text, replied_at timestamptz, read_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.response_id,
         r.kind,
         coalesce(r.survey_title, case when r.kind = 'feedback' then '고객의 소리' else '만족도 조사' end),
         r.submitted_at, s.reply, s.replied_at, s.read_at
    from public.survey_receipts r
    left join public.survey_replies s on s.response_id = r.response_id
   where r.user_id = auth.uid()
   order by r.submitted_at desc
   limit 30;
$function$;

revoke all on function public.reply_survey_response(uuid, text) from public, anon;
revoke all on function public.get_my_voice_receipts() from public, anon;
grant execute on function public.reply_survey_response(uuid, text) to authenticated;
grant execute on function public.get_my_voice_receipts() to authenticated;
