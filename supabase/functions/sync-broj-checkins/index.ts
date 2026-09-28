// 브로제이 출입 → 마이복서153 라이브보드 자동 표시.
//
// 흐름: pg_cron(1분) → 이 함수 → 153OS(CRM) attendance_logs 조회 → 앱 attendance_logs 기록
//
// 원칙 (절대 어기지 말 것):
//   - 이 함수는 XP 를 직접 주지 않는다(xp_granted=0 으로 넣는다). 기본 출석 XP 는
//     DB 트리거(attendance_base_xp)가 회원 출석 행에 준다.
//   - 전화번호로 앱 계정을 못 찾은 회원 입장은 그 자리에서 앱 계정을 만들어 연결한다 (2026-09-28, 대표님 승인).
//     예전엔 건너뛰었다 — 브로제이 신규 회원은 153OS 로 밤 00:05 에 한 번만 넘어오고 앱 계정은 그 뒤에 생겨서,
//     등록 첫날 입장이 라이브보드·출석·마일리지에서 통째로 빠졌다.
//     만드는 방식은 153OS 회원 가져오기(sync-members-to-app)와 같다(아이디 전화번호@153rankup.app,
//     첫 로그인 때 아이디·비밀번호 변경). 밤에 그 회원이 153OS 로 넘어오면 같은 번호의 이 계정에 연결만 된다
//     (profiles.phone_number 유니크 — 같은 번호로 두 번 만들어질 수 없다).
//     안전장치: 휴대폰 번호 형식 + 이름이 있을 때만 · 직원 번호 제외 · 한 번 실행 5명, 하루 30명까지 ·
//     프로필 조회가 한 번이라도 실패한 실행과 백필(from/to) 실행에서는 만들지 않는다.
//   - source_ref 유니크(broj:<attendance_id>)로 재실행해도 중복되지 않는다.
//   - 회원 출석은 "문이 열린 회원 입장"(ENTRY·SUCCESS)만 넣는다 (2026-09-28).
//     브로제이는 이용권 기간 만료·월간 입장 횟수 소진으로 문이 안 열린 입장도 FAILURE 로 남긴다.
//     예전엔 이것까지 출석으로 넣어서, 문 앞에서 돌아간 회원이 출석·XP·자동 승급·순위에 잡혔다.
//   - 직원 출근(GO_TO_WORK)은 회원 출석이 아니다 → staff_duty_logs(출근부)에만 적는다.
//   - 지도진 표시(is_staff)는 여기서 바꾸지 않는다 — 153OS 직원 명단 동기화(sync-staff-to-app)만 정한다.
//   - 지점·날짜별 "브로제이 기준" 숫자를 broj_daily_counts 에 남긴다 (2026-09-28) — 관리자 홈 운영 리포트가
//     브로제이 화면과 같은 기준(회원 입장 건수·회원 인원·코치 인원)으로 보여 주고, 앱 반영 인원과의 차이를 설명한다.
//
// 백필 (2026-09-17 추가):
//   기본 동작은 "오늘부터 days 일"이다. 과거 구간을 채우려면 from/to 를 직접 준다.
//     { "from": "2026-02-01", "to": "2026-02-28", "skipAdvance": true }
//   skipAdvance=true 면 자동 승급 검사를 돌리지 않는다 — 과거 출석을 넣는 것과
//   레벨을 움직이는 것은 분리해야 한다(한꺼번에 하면 수천 명 레벨이 통제 없이 이동).
//
// 인증: DB(internal_sync_config.auto_sync_key)에 저장된 내부 키를 x-auto-key 헤더로 검증.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");

// 지점명 매핑 — 153OS ↔ 앱 이름 불일치 보정. sync-members-to-app 과 동일 규약.
const BRANCH_MAP: Record<string, string> = { "153복싱짐 선릉점": "153복싱짐 선릉역점" };

// 첫 입장 계정 생성 — 휴대폰 번호만, 0000·1111 같은 가짜 번호 제외, 생성 한도
const MOBILE_RE = /^01[016789][0-9]{7,8}$/;
const FAKE_PHONE_RE = /^01[016789]([0-9])\1+$/;
const MAX_CREATE_PER_RUN = 5;
const MAX_CREATE_PER_DAY = 30;

/** KST 기준 오늘(YYYY-MM-DD)에서 n일 전 */
function kstDate(offsetDays = 0): string {
  const t = new Date(Date.now() + 9 * 3600 * 1000 - offsetDays * 86400000);
  return t.toISOString().slice(0, 10);
}

/** 표시명 — qr-checkin 과 동일 규칙(첫 글자 + O 반복)으로 통일. 빈 이름은 "회원" 폴백. */
function displayName(mode: string, nickname: string | null, name: string | null): string {
  const nm = (name ?? "").trim();
  const nick = (nickname ?? "").trim();
  if (mode === "masked_name") {
    const n = nm || nick || "회원";
    return n.length <= 1 ? n : n[0] + "O".repeat(n.length - 1);
  }
  if (mode === "full_name") return nm || nick || "회원";
  return nick || nm || "회원"; // 기본: nickname
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";

  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1) 내부 키 검증
    const provided = req.headers.get("x-auto-key") || "";
    const { data: cfg } = await app
      .from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || provided !== cfg.value) return json({ error: "unauthorized" }, 401);
    if (!OS_KEY) {
      await app.from("broj_checkin_runs").insert({ ok: false, error: "OS_SERVICE_KEY 미설정" });
      return json({ error: "OS_SERVICE_KEY 미설정" }, 503);
    }

    const body = await req.json().catch(() => ({}));

    // 기간 결정 — from/to 를 주면 그 구간(백필), 없으면 기존처럼 "오늘부터 days 일".
    const ymd = /^\d{4}-\d{2}-\d{2}$/;
    const days = Number(body?.days) > 0 ? Math.min(30, Number(body.days)) : 1;
    const from = ymd.test(String(body?.from ?? "")) ? String(body.from) : kstDate(days - 1);
    const to = ymd.test(String(body?.to ?? "")) ? String(body.to) : kstDate(0);
    if (from > to) return json({ error: "from 이 to 보다 늦습니다" }, 400);
    const skipAdvance = body?.skipAdvance === true;
    // from/to 를 직접 준 실행 = 과거 구간 백필 — 계정을 새로 만들지 않는다(오래전 방문자까지 계정이 생기면 안 된다).
    const isBackfill = ymd.test(String(body?.from ?? "")) || ymd.test(String(body?.to ?? ""));

    const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

    // 2) CRM 출입 이력 조회 (지점명 필요 → branches 조인)
    //    ⚠️ 단일 limit 은 백필에서 조용히 잘린다 → 1000행 페이지 루프로 전량 수집.
    type OsRow = {
      broj_attendance_id: string; phone: string | null; member_name: string | null;
      attended_at: string; attend_date: string; user_type: string | null;
      attendance_type: string | null; attendance_status: string | null;
      branches: { name: string } | { name: string }[] | null;
    };
    const rows: OsRow[] = [];
    for (let off = 0; off < 40000; off += 1000) {
      const { data: page, error: osErr } = await os
        .from("attendance_logs")
        .select("broj_attendance_id, phone, member_name, attended_at, attend_date, user_type, attendance_type, attendance_status, branches!inner(name)")
        .gte("attend_date", from).lte("attend_date", to)
        .order("attended_at", { ascending: true })
        .range(off, off + 999);
      if (osErr) {
        await app.from("broj_checkin_runs").insert({ ok: false, error: "OS 조회 실패: " + osErr.message });
        return json({ error: "OS 조회 실패" }, 502);
      }
      const list = (page || []) as unknown as OsRow[];
      rows.push(...list);
      if (list.length < 1000) break;
    }
    const branchOf = (r: OsRow) => {
      const b = Array.isArray(r.branches) ? r.branches[0] : r.branches;
      const raw = (b?.name ?? "").trim();
      return BRANCH_MAP[raw] || raw;
    };

    if (rows.length === 0) {
      await app.from("broj_checkin_runs").insert({ ok: true, scanned: 0 });
      return json({ ok: true, from, to, scanned: 0, inserted: 0, skipped: 0, unmatched: 0, skipAdvance });
    }

    // 2-2) 회원 출석으로 인정하는 행 — 문이 열린 회원 입장만.
    //   FAILURE(이용권 기간 만료·월간 입장 횟수 소진 등 문 거절)와 직원 출근(GO_TO_WORK)은 뺀다.
    //   user_type 이 비어 있는 옛 행(2026-06 이전)은 회원 입장이다.
    //   직원 행은 아래 4-2 에서 출근부(staff_duty_logs)로만 간다.
    const memberRows = rows.filter((r) =>
      r.user_type !== "직원" && r.attendance_type === "ENTRY" && r.attendance_status === "SUCCESS");
    const rejected = rows.filter((r) => r.attendance_status === "FAILURE").length;

    // 3) 이미 기록된 건 제외 (source_ref 유니크)
    const refs = memberRows.map((r) => `broj:${r.broj_attendance_id}`);
    const existing = new Set<string>();
    for (let i = 0; i < refs.length; i += 500) {
      const { data } = await app
        .from("attendance_logs").select("source_ref").in("source_ref", refs.slice(i, i + 500));
      for (const e of (data || []) as { source_ref: string }[]) existing.add(e.source_ref);
    }
    const todo = memberRows.filter((r) => !existing.has(`broj:${r.broj_attendance_id}`));

    // 4) 전화번호 → 앱 계정 매칭 — 창 안의 회원 입장 전체(브로제이 대조 집계에도 쓴다).
    //    조회가 한 번이라도 실패하면 profLookupOk=false — 그 실행에서는 계정을 만들지 않고 집계도 덮어쓰지 않는다
    //    (있는 회원을 없는 줄 알고 계정을 만들거나, 틀린 숫자로 리포트를 덮는 일 방지).
    type Prof = { user_id: string; nickname: string | null; name: string | null; is_staff: boolean };
    const phones = [...new Set(memberRows.map((r) => onlyDigits(r.phone)).filter((p) => p.length >= 10))];
    const profMap = new Map<string, Prof>();
    let profLookupOk = true;
    for (let i = 0; i < phones.length; i += 300) {
      const { data, error: pErr } = await app
        .from("profiles").select("user_id, nickname, name, phone_number, is_staff")
        .in("phone_number", phones.slice(i, i + 300));
      if (pErr) { profLookupOk = false; continue; }
      for (const p of (data || []) as { user_id: string; nickname: string | null; name: string | null; phone_number: string; is_staff: boolean | null }[]) {
        profMap.set(onlyDigits(p.phone_number), { user_id: p.user_id, nickname: p.nickname, name: p.name, is_staff: p.is_staff === true });
      }
    }
    // 브로제이 직원 번호 — 회원 계정으로 만들지 않는다
    const staffPhoneSet = new Set(
      rows.filter((r) => r.user_type === "직원").map((r) => onlyDigits(r.phone)).filter((p) => p.length >= 10),
    );

    // 4-2) 직원(코치) 출근 처리 — 라이브보드 COACHING STAFF 띠의 유일한 근거.
    //
    //   회원 매칭(전화번호) 성공 여부와 무관하게 저장한다. 코치가 앱에 가입하지
    //   않았거나 브로제이와 번호가 다른 경우가 실제로 있어서(2026-09 이재우 코치),
    //   앱 계정에 의존하면 보드에서 통째로 사라진다.
    //
    //   퇴근 기록은 브로제이에 없다(GO_TO_WORK 만 존재) → "언제까지 근무중으로
    //   볼지" 판정은 public_staff_on_duty 뷰가 한다. 여기서는 사실만 적는다.
    //
    //   회원 출석(todo)과 무관하게 rows 전체의 직원 행을 쓴다 — 출근부는
    //   source_ref 유니크라 재실행해도 중복되지 않는다.
    let staffIds = new Set<string>();
    try {
      const staffRows = rows.filter((r) => r.user_type === "직원");
      if (staffRows.length > 0) {
        const staffPhones = [...new Set(
          staffRows.map((r) => onlyDigits(r.phone)).filter((p) => p.length >= 10),
        )];
        const staffProf = new Map<string, string>(); // 전화번호 → user_id
        for (let i = 0; i < staffPhones.length; i += 300) {
          const { data } = await app
            .from("profiles").select("user_id, phone_number")
            .in("phone_number", staffPhones.slice(i, i + 300));
          for (const pr of (data || []) as { user_id: string; phone_number: string }[]) {
            staffProf.set(onlyDigits(pr.phone_number), pr.user_id);
          }
        }

        const dutyRows = staffRows
          .map((r) => {
            const branch = branchOf(r);
            const phone = onlyDigits(r.phone);
            if (!branch || !phone) return null;
            return {
              source_ref: `broj:${r.broj_attendance_id}`,
              branch_name: branch,
              phone_digits: phone,
              staff_name: (r.member_name ?? "").trim() || "코치",
              user_id: staffProf.get(phone) ?? null,
              checked_in_at: r.attended_at,
              attend_date: r.attend_date,
            };
          })
          .filter((v): v is NonNullable<typeof v> => v !== null);

        for (let i = 0; i < dutyRows.length; i += 300) {
          await app.from("staff_duty_logs")
            .upsert(dutyRows.slice(i, i + 300), { onConflict: "source_ref", ignoreDuplicates: true });
        }

        // 지도진 표시(is_staff)는 153OS 직원 명단 동기화(sync-staff-to-app)만 정한다 (2026-09-28).
        // 예전엔 여기서도 켰는데, 그러면 관리자가 해제해도 1분 안에 되살아나고
        // 직함·출처 없이 켜져 명단 동기화로도 지워지지 않았다.
        // 브로제이 직원 번호는 자동 승급 제외 판정에만 쓴다.
        staffIds = new Set([...staffProf.values()]);
      }
    } catch (_e) { /* 코치 표시는 부가 기능 — 출석 동기화를 막지 않는다 */ }

    // 4-3) 첫 입장 회원 — 앱 계정이 없으면 만든다 (2026-09-28 대표님 승인).
    //   브로제이 신규 회원은 153OS 로 밤 00:05 에 한 번만 넘어온다 → 기다리면 등록 첫날 입장이 통째로 빠진다.
    let createdAccounts = 0;
    let createCapped = false;
    const createFailed: string[] = [];
    if (!isBackfill && profLookupOk) {
      const candidates = new Map<string, OsRow>(); // 전화번호 → 첫 입장 행
      for (const r of todo) {
        const phone = onlyDigits(r.phone);
        if (candidates.has(phone) || profMap.has(phone)) continue;
        if (!MOBILE_RE.test(phone) || FAKE_PHONE_RE.test(phone)) continue; // 휴대폰 번호만
        if (staffPhoneSet.has(phone)) continue;                          // 코치 계정은 직원 명단 동기화가 만든다
        if (!(r.member_name ?? "").trim() || !branchOf(r)) continue;     // 이름 없이 만들면 보드에 번호가 뜬다
        candidates.set(phone, r);
      }
      if (candidates.size > 0) {
        // 예전에 직원으로 출근한 적 있는 번호도 회원으로 만들지 않는다.
        const { data: duty, error: dutyErr } = await app
          .from("staff_duty_logs").select("phone_digits").in("phone_digits", [...candidates.keys()]);
        // 하루 생성 한도 — 번호 형식이 바뀌는 등 이상 상황에서 계정이 쏟아지지 않게.
        const dayStartIso = new Date(`${kstDate(0)}T00:00:00+09:00`).toISOString();
        const { data: runsToday, error: runsErr } = await app
          .from("broj_checkin_runs").select("created_accounts")
          .gte("ran_at", dayStartIso).gt("created_accounts", 0);
        if (dutyErr || runsErr) {
          createFailed.push("사전 확인 실패 — 이번 실행은 계정 생성을 건너뜀");
        } else {
          for (const d of (duty || []) as { phone_digits: string }[]) candidates.delete(d.phone_digits);
          const createdToday = ((runsToday || []) as { created_accounts: number | null }[])
            .reduce((sum, x) => sum + (Number(x.created_accounts) || 0), 0);
          let budget = Math.min(MAX_CREATE_PER_RUN, MAX_CREATE_PER_DAY - createdToday);
          if (budget <= 0 && candidates.size > 0) createCapped = true;
          for (const [phone, r] of candidates) {
            if (budget <= 0) break;
            budget--;
            const name = (r.member_name ?? "").trim();
            const branch = branchOf(r);
            const { data: cu, error: cErr } = await app.auth.admin.createUser({
              email: `${phone}@153rankup.app`,
              password: phone,
              email_confirm: true,
              user_metadata: { name, nickname: name, phone_number: phone, branch_name: branch, signup_source: "broj_first_entry" },
            });
            if (cErr || !cu?.user) {
              // 로그에는 번호 끝 4자리만 남긴다.
              createFailed.push(`*${phone.slice(-4)}: ${(cErr?.message || "계정 생성 실패").slice(0, 80)}`);
              continue;
            }
            const uid = cu.user.id;
            // 153OS 에서 가져온 회원과 같은 상태 — 승인됨 · 첫 로그인 때 아이디·비밀번호 변경
            const { error: upErr } = await app.from("profiles")
              .update({ is_approved: true, must_change_credentials: true }).eq("user_id", uid);
            if (upErr) createFailed.push(`*${phone.slice(-4)}: 승인 표시 실패`);
            profMap.set(phone, { user_id: uid, nickname: name, name, is_staff: false });
            createdAccounts++;
          }
        }
      }
    }

    // 4-4) 브로제이 대조 집계 — 지점·날짜별로 브로제이 화면과 같은 기준의 숫자(broj_daily_counts).
    //   관리자 홈 운영 리포트가 "입장 48건 · 회원 45명 · 코치 6명 → 앱 반영 43명" 처럼 보여 준다.
    //   계정 조회가 온전할 때만 쓴다. 실패해도 출석 동기화는 계속한다.
    if (profLookupOk) {
      try {
        type Agg = { entries: number; people: Set<string>; staff: Set<string>; rejected: number };
        const agg = new Map<string, Agg>();
        for (const r of rows) {
          const branch = branchOf(r);
          if (!branch || !r.attend_date) continue;
          const key = `${branch}|${r.attend_date}`;
          let a = agg.get(key);
          if (!a) { a = { entries: 0, people: new Set(), staff: new Set(), rejected: 0 }; agg.set(key, a); }
          const phone = onlyDigits(r.phone);
          if (r.user_type === "직원") { if (phone) a.staff.add(phone); continue; }
          if (r.attendance_status === "FAILURE") { a.rejected++; continue; }
          if (r.attendance_type === "ENTRY" && r.attendance_status === "SUCCESS") {
            a.entries++;
            if (phone) a.people.add(phone);
          }
        }
        const nowIso = new Date().toISOString();
        const countRows = [...agg].map(([key, a]) => {
          const [branch_name, day] = key.split("|");
          let appMember = 0, staffMember = 0, unlinked = 0;
          for (const ph of a.people) {
            const prof = profMap.get(ph);
            if (!prof) unlinked++;
            else if (prof.is_staff) staffMember++;
            else appMember++;
          }
          return {
            branch_name, day,
            member_entries: a.entries, member_people: a.people.size, staff_people: a.staff.size,
            app_member_people: appMember, staff_member_people: staffMember, unlinked_people: unlinked,
            rejected_entries: a.rejected, updated_at: nowIso,
          };
        });
        if (countRows.length > 0) {
          await app.from("broj_daily_counts").upsert(countRows, { onConflict: "branch_name,day" });
        }
      } catch (_e) { /* 대조 집계는 보조 기능 — 출석 동기화를 막지 않는다 */ }
    }

    if (todo.length === 0) {
      await app.from("broj_checkin_runs").insert({ ok: true, scanned: rows.length, skipped: rows.length });
      return json({ ok: true, from, to, scanned: rows.length, inserted: 0, skipped: rows.length, unmatched: 0, rejected, skipAdvance });
    }

    // 이번에 넣을 행(todo)의 회원만 — profMap 은 대조 집계 때문에 창 전체를 들고 있다.
    const userIds = [...new Set(
      todo.map((r) => profMap.get(onlyDigits(r.phone))?.user_id).filter((v): v is string => !!v),
    )];
    if (userIds.length === 0) {
      await app.from("broj_checkin_runs").insert({ ok: true, scanned: rows.length, skipped: rows.length - todo.length, unmatched: todo.length, created_accounts: createdAccounts });
      return json({ ok: true, from, to, scanned: rows.length, inserted: 0, skipped: rows.length - todo.length, unmatched: todo.length, rejected, skipAdvance, created_accounts: createdAccounts, create_failed: createFailed, create_capped: createCapped });
    }

    // 5) 리그·레벨 스냅샷 + 지점별 표시명 모드
    const progMap = new Map<string, { current_rank: string | null; current_level: number | null }>();
    for (let i = 0; i < userIds.length; i += 300) {
      const { data } = await app
        .from("member_progress").select("user_id, current_rank, current_level")
        .in("user_id", userIds.slice(i, i + 300));
      for (const g of (data || []) as { user_id: string; current_rank: string | null; current_level: number | null }[]) {
        progMap.set(g.user_id, { current_rank: g.current_rank, current_level: g.current_level });
      }
    }

    const modeMap = new Map<string, string>();
    {
      const { data } = await app.from("branch_display_settings").select("branch_name, display_name_mode");
      for (const s of (data || []) as { branch_name: string; display_name_mode: string }[]) {
        modeMap.set(s.branch_name, s.display_name_mode);
      }
    }

    // 6) 같은 날 이미 체크인(QR 또는 브로제이)이 있으면 is_duplicate=true — 라이브보드·통계 중복 방지
    const dayKeys = new Set<string>();
    {
      const startIso = new Date(`${from}T00:00:00+09:00`).toISOString();
      const endIso = new Date(`${to}T23:59:59+09:00`).toISOString();
      for (let i = 0; i < userIds.length; i += 300) {
        const { data } = await app
          .from("attendance_logs").select("user_id, checked_in_at")
          .in("user_id", userIds.slice(i, i + 300))
          .eq("is_duplicate", false)
          .gte("checked_in_at", startIso).lte("checked_in_at", endIso);
        for (const a of (data || []) as { user_id: string; checked_in_at: string }[]) {
          const d = new Date(new Date(a.checked_in_at).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
          dayKeys.add(`${a.user_id}|${d}`);
        }
      }
    }

    // 7) 삽입 행 조립
    let unmatched = 0;
    const inserts: Record<string, unknown>[] = [];
    for (const r of todo) {
      const prof = profMap.get(onlyDigits(r.phone));
      if (!prof) { unmatched++; continue; }
      const branch = branchOf(r);
      if (!branch) { unmatched++; continue; }
      const key = `${prof.user_id}|${r.attend_date}`;
      const dup = dayKeys.has(key);
      if (!dup) dayKeys.add(key);
      const prog = progMap.get(prof.user_id);
      inserts.push({
        user_id: prof.user_id,
        branch_name: branch,
        method: "broj",
        checked_in_at: r.attended_at,
        xp_granted: 0,                 // 여기서는 0 — 기본 출석 XP 는 DB 트리거(attendance_base_xp)가 준다
        is_duplicate: dup,
        display_name_snapshot: displayName(modeMap.get(branch) ?? "nickname", prof.nickname, prof.name),
        league_snapshot: prog?.current_rank ?? "white",
        level_snapshot: prog?.current_level ?? 1,
        source_ref: `broj:${r.broj_attendance_id}`,
      });
    }

    // 8) 저장 (source_ref 유니크 → 동시 실행에도 안전)
    let inserted = 0;
    for (let i = 0; i < inserts.length; i += 300) {
      const chunk = inserts.slice(i, i + 300);
      const { error } = await app
        .from("attendance_logs").upsert(chunk, { onConflict: "source_ref", ignoreDuplicates: true });
      if (error) {
        await app.from("broj_checkin_runs").insert({
          ok: false, scanned: rows.length, inserted, unmatched, created_accounts: createdAccounts, error: error.message.slice(0, 500),
        });
        return json({ error: "저장 실패" }, 500);
      }
      inserted += chunk.length;
    }

    // 9) 새 출석이 기록된 회원마다 자동 승급 검사.
    //    1~9레벨은 출석 요건 자동 승급, 10레벨은 승인함으로 자동 신청 (DB 함수가 판정).
    //    개별 실패는 삼킨다 — 다음 출석 동기화 때 같은 검사가 다시 돈다.
    //    코치·지점장은 제외한다 — 출근 도장이 회원 레벨 승급으로 이어지면 안 된다.
    //    skipAdvance=true(백필)면 건너뛴다 — 과거 출석 적재와 레벨 이동은 분리한다.
    let advanced = 0;
    if (!skipAdvance) {
      const advanceTargets = [...new Set(
        inserts.filter((r) => r.is_duplicate === false).map((r) => String(r.user_id)),
      )].filter((uid) => !staffIds.has(uid));
      for (const uid of advanceTargets) {
        try {
          await app.rpc("auto_advance_from_attendance", { _user_id: uid });
          advanced++;
        } catch (_e) { /* 무시 — 출석 기록이 우선이다 */ }
      }
    }

    const skipped = rows.length - todo.length;
    await app.from("broj_checkin_runs").insert({ ok: true, scanned: rows.length, inserted, skipped, unmatched, created_accounts: createdAccounts });
    return json({ ok: true, from, to, scanned: rows.length, inserted, skipped, unmatched, rejected, skipAdvance, advanced, created_accounts: createdAccounts, create_failed: createFailed, create_capped: createCapped });
  } catch (e) {
    await app.from("broj_checkin_runs").insert({
      ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    });
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
