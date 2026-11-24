-- 2026-11-23 보안 점검 ② — 일괄등록 계정의 「아이디 = 비밀번호 = 전화번호」 없애기 (대표님 「2.3도추천대로」)
--
-- 배경: 체육관 회원은 동기화(sync-members-to-app · bulk-import-members · sync-broj-checkins)가 앱 계정을
--   {번호}@153rankup.app / 비밀번호 = 번호 로 미리 만든다(must_change_credentials=true · 아직 넘겨받지 않은 계정).
--   그래서 번호만 알면 남의 계정에 로그인할 수 있었다(운영 3,421개 · 이 방식으로 로그인한 계정은 0개).
-- 이제:
--   1) 새로 만드는 번호 아이디 계정은 비밀번호가 번호와 같으면 무작위로 바꿔 저장한다(어느 동기화 함수로 만들든 — DB 한 곳에서).
--   2) 이미 만들어진 아직 넘겨받지 않은 · 한 번도 로그인하지 않은 계정의 비밀번호를 무작위로 바꾼다.
--   넘겨받기는 「기록 찾기」(claim-member-account — 이름 · 번호 · 생년월일 · 잠금)로만 한다.
--   되돌리려면: 같은 대상의 encrypted_password 를 extensions.crypt(번호, extensions.gen_salt('bf')) 로(번호는 이메일 앞부분).

create or replace function public._phone_id_password_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local text;
begin
  if new.email is null or new.encrypted_password is null or new.encrypted_password = '' then
    return new;
  end if;
  v_local := split_part(new.email, '@', 1);
  if split_part(new.email, '@', 2) = '153rankup.app'
     and v_local ~ '^0[0-9]{9,10}$'
     and extensions.crypt(v_local, new.encrypted_password) = new.encrypted_password then
    new.encrypted_password := extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf'));
  end if;
  return new;
end;
$$;

revoke all on function public._phone_id_password_guard() from public, anon, authenticated;

drop trigger if exists phone_id_password_guard on auth.users;
create trigger phone_id_password_guard
  before insert on auth.users
  for each row execute function public._phone_id_password_guard();

-- 이미 있는 계정: 아직 넘겨받지 않았고 한 번도 로그인하지 않은 번호 아이디 계정만
update auth.users u
   set encrypted_password = extensions.crypt(encode(extensions.gen_random_bytes(24), 'hex'), extensions.gen_salt('bf'))
  from public.profiles p
 where p.user_id = u.id
   and p.must_change_credentials is true
   and u.last_sign_in_at is null
   and split_part(u.email, '@', 2) = '153rankup.app'
   and split_part(u.email, '@', 1) ~ '^0[0-9]{9,10}$';
