// 153OS PT 회원(브로제이 PT 수업권) → 마이복서153 PT 표시 동기화 (크론 전용, 2026-09-29).
//
// 대표님: "퍼스널 트레이닝 회원님들에게는 블루뱃지 회원카드에 하나 달아주고 … 경험치의 2배를 얻을 수 있게".
// PT 여부의 원본은 브로제이 PT 수업권이다. 153OS 워커가 회원별 이용권을 확인할 때(홀딩 스윕, 1~2일에 한 바퀴)
// member_snapshots.pt_active · pt_ticket_name · pt_remaining · pt_end_date · pt_checked_at 에 같이 기록한다.
// 이 함수는 그 기록을 앱 계정(전화번호 숫자만 비교)으로 옮긴다:
//   · profiles.pt_until     = PT 유효일(KST). 오늘 이후면 PT 회원 → 회원카드 파란 배지 + 경험치 2배(DB 트리거 trg_pt_xp_bonus).
//                             = min(수업권 종료일, 마지막 확인일 + 7일) — 확인이 끊겨도 7일 뒤 저절로 풀린다(낡은 정보로 계속 2배 방지).
//   · profiles.pt_ticket    = 대표 PT 수업권 이름 · profiles.pt_remaining = 잔여 횟수 (참고용 — 화면에는 안 쓴다, 1~2일 늦을 수 있어서)
// PT 가 끝난 회원(153OS 가 그 번호를 확인했는데 살아 있는 PT 수업권이 없음)은 pt_* 를 비운다.
// 확인 기록이 없는 번호(스냅샷 행이 새로 생겼거나 번호가 바뀜)는 비우지 않고, pt_until 이 지나면 저절로 끝나게 둔다.
// 안전장치: 153OS 에 PT 확인 기록이 하나도 없으면(워커 배포 전) 아무것도 바꾸지 않는다.
//           한 번에 너무 많이(현재 PT 회원의 50% 초과, 최소 5명) 끝나면 종료 처리만 보류하고 보고한다.
// 체험용 계정(profiles.is_test_account)은 건드리지 않는다.
//
// 흐름: pg_cron(sync-pt-members, 매시 40분) → 이 함수. 인증은 auto-sync-members 와 같은
// x-auto-key(internal_sync_config.auto_sync_key). verify_jwt=false 필수(config.toml).
// 이력: member_sync_runs(mode='pt-sync'). body {dry_run:true} 면 쓰지 않고 결과만 돌려준다.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const onlyDigits = (s: unknown) => String(s ?? "").replace(/[^0-9]/g, "");
// +82 10-1234-5678 → 01012345678 (앱은 숫자만, 0 으로 시작하는 국내 번호로 저장한다)
const normPhone = (s: unknown) => {
  const d = onlyDigits(s);
  return d.startsWith("82") && d.length >= 11 ? `0${d.slice(2)}` : d;
};
// 보고용 마스킹 — 이름 첫 글자 + 번호 끝 4자리만.
const mask = (name: unknown, phone: string) => `${String(name ?? "").trim().slice(0, 1) || "?"}OO(…${phone.slice(-4)})`;

const DAY = 86400000;
/** 확인이 이만큼 끊기면 PT 표시가 저절로 풀린다 (워커는 1~2일에 한 번 다시 확인한다). */
const STALE_DAYS = 7;
const kstDate = (ms: number) => new Date(ms + 9 * 3600 * 1000).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

type OsPtRow = {
  id: string; normalized_phone: string | null; member_name: string | null;
  pt_ticket_name: string | null; pt_remaining: number | null; pt_end_date: string | null; pt_checked_at: string | null;
};
type AppProfile = {
  user_id: string; phone_number: string | null; pt_until: string | null; pt_ticket: string | null;
  pt_remaining: number | null; is_test_account: boolean | null;
};
type Want = { until: string; ticket: string | null; remaining: number | null; label: string };

/** 스냅샷 한 행의 PT 유효일(KST) — 수업권 종료일과 '마지막 확인일 + 7일' 중 이른 날. 확인 기록이 없으면 null. */
function ptUntilOf(r: Pick<OsPtRow, "pt_end_date" | "pt_checked_at">): string | null {
  if (!r.pt_checked_at) return null;
  const t = Date.parse(r.pt_checked_at);
  if (!Number.isFinite(t)) return null;
  const stale = addDays(kstDate(t), STALE_DAYS);
  const end = r.pt_end_date ? String(r.pt_end_date).slice(0, 10) : null;
  return end && end < stale ? end : stale;
}

type Page<T> = { data: T[] | null; error: { message: string } | null };
/** PostgREST 기본 1000행 제한을 넘어 끝까지 읽는다 (쿼리는 반드시 정렬 + range). */
async function fetchAll<T>(q: (from: number, to: number) => PromiseLike<unknown>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = (await q(from, from + 999)) as Page<T>;
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const startedAt = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const OS_URL = Deno.env.get("OS_SUPABASE_URL") || "https://tbxdrfowanyksgdicryl.supabase.co";
  const OS_KEY = Deno.env.get("OS_SERVICE_KEY") || "";
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1) 내부 키 검증 (auto-sync-members 와 동일)
    const provided = req.headers.get("x-auto-key") || "";
    const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || provided !== cfg.value) return json({ error: "unauthorized" }, 401);
    if (!OS_KEY) return json({ error: "OS_SERVICE_KEY 미설정" }, 503);

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const os = createClient(OS_URL, OS_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const today = kstDate(Date.now());

    // 2) 153OS 가 PT 를 확인한 적이 있는지 — 한 건도 없으면(워커 배포 전) 아무것도 바꾸지 않는다.
    const { count: checkedCount, error: cErr } = await os.from("member_snapshots")
      .select("id", { count: "exact", head: true }).not("pt_checked_at", "is", null);
    if (cErr) return json({ error: "OS 조회 실패: " + cErr.message }, 502);
    if (!checkedCount) {
      return json({ ok: true, dry_run: dryRun, waiting: true, note: "153OS 에 PT 확인 기록이 아직 없습니다(워커 배포 전) — 변경 없음" });
    }

    // 3) 153OS PT 회원 — 살아 있는 PT 수업권이 확인된 행. 같은 번호가 여러 지점에 있으면 유효일이 가장 늦은 것.
    const ptRows = await fetchAll<OsPtRow>((f, t) => os.from("member_snapshots")
      .select("id, normalized_phone, member_name, pt_ticket_name, pt_remaining, pt_end_date, pt_checked_at")
      .eq("pt_active", true).not("pt_checked_at", "is", null).order("id").range(f, t));
    const want = new Map<string, Want>();
    let badPhone = 0, lapsed = 0;
    for (const r of ptRows) {
      const phone = normPhone(r.normalized_phone);
      if (phone.length < 10) { badPhone++; continue; }
      const until = ptUntilOf(r);
      if (!until || until < today) { lapsed++; continue; } // 종료일이 지났거나 확인이 7일 넘게 끊김 — PT 아님
      const prev = want.get(phone);
      if (!prev || until > prev.until) {
        want.set(phone, {
          until,
          ticket: String(r.pt_ticket_name ?? "").trim().slice(0, 60) || null,
          remaining: typeof r.pt_remaining === "number" ? r.pt_remaining : null,
          label: mask(r.member_name, phone),
        });
      }
    }

    // 4) 앱 계정 — PT 회원 번호로 찾기 + 지금 PT 표시가 있는 계정 전부
    const SEL = "user_id, phone_number, pt_until, pt_ticket, pt_remaining, is_test_account";
    const phones = [...want.keys()];
    const byPhone = new Map<string, AppProfile[]>();
    for (let i = 0; i < phones.length; i += 150) {
      const { data, error } = await app.from("profiles").select(SEL).in("phone_number", phones.slice(i, i + 150));
      if (error) return json({ error: "앱 조회 실패: " + error.message }, 502);
      for (const p of (data ?? []) as AppProfile[]) {
        const k = normPhone(p.phone_number);
        byPhone.set(k, [...(byPhone.get(k) ?? []), p]);
      }
    }
    const current = await fetchAll<AppProfile>((f, t) => app.from("profiles")
      .select(SEL).not("pt_until", "is", null).order("user_id").range(f, t));

    // 5) PT 표시 — 새로 · 갱신(유효일 연장 등)
    let added = 0, refreshed = 0, testSkipped = 0;
    const unmatched: string[] = [];
    const failed: string[] = [];
    for (const [phone, w] of want) {
      const ps = byPhone.get(phone) ?? [];
      if (!ps.length) { unmatched.push(w.label); continue; }
      for (const p of ps) {
        if (p.is_test_account === true) { testSkipped++; continue; } // 체험용 계정은 그대로
        if (p.pt_until === w.until && (p.pt_ticket ?? null) === w.ticket && (p.pt_remaining ?? null) === w.remaining) continue;
        const wasActive = !!p.pt_until && p.pt_until >= today;
        if (!dryRun) {
          const { error } = await app.from("profiles")
            .update({ pt_until: w.until, pt_ticket: w.ticket, pt_remaining: w.remaining }).eq("user_id", p.user_id);
          if (error) { failed.push(`${w.label}: ${error.message}`); continue; }
        }
        if (wasActive) refreshed++; else added++;
      }
    }

    // 6) PT 가 끝난 계정 → 비운다.
    //    이미 지난 표시는 그냥 정리. 아직 유효한 표시는 153OS 가 그 번호를 '확인했는데 PT 수업권 없음' 일 때만 끝낸다.
    const candidates = current.filter((p) => p.is_test_account !== true && !want.has(normPhone(p.phone_number)));
    const livePhones = [...new Set(candidates
      .filter((p) => (p.pt_until ?? "") >= today)
      .map((p) => normPhone(p.phone_number))
      .filter((x) => x.length >= 10))];
    const checkedPhones = new Set<string>();
    for (let i = 0; i < livePhones.length; i += 150) {
      const { data, error } = await os.from("member_snapshots").select("normalized_phone")
        .in("normalized_phone", livePhones.slice(i, i + 150)).not("pt_checked_at", "is", null);
      if (error) return json({ error: "OS 조회 실패: " + error.message }, 502);
      for (const r of (data ?? []) as { normalized_phone: string | null }[]) checkedPhones.add(normPhone(r.normalized_phone));
    }
    const toClear: { p: AppProfile; label: string; expired: boolean }[] = [];
    let noEvidence = 0;
    for (const p of candidates) {
      const phone = normPhone(p.phone_number);
      const label = `?OO(…${phone.slice(-4)})`;
      if ((p.pt_until ?? "") < today) toClear.push({ p, label, expired: true });
      else if (checkedPhones.has(phone)) toClear.push({ p, label, expired: false });
      else noEvidence++;
    }
    const activeNow = current.filter((p) => p.is_test_account !== true && (p.pt_until ?? "") >= today).length;
    const ending = toClear.filter((x) => !x.expired);
    const cap = Math.max(5, Math.ceil(activeNow * 0.5));
    let held = "";
    let clearList = toClear;
    if (ending.length > cap) {
      held = `PT 종료 ${ending.length}명 보류(한 번에 ${cap}명 초과 — 153OS 확인 이상인지 봐 주세요): ${ending.slice(0, 10).map((x) => x.label).join(", ")}`;
      clearList = toClear.filter((x) => x.expired);
    }
    let ended = 0, tidied = 0;
    for (const { p, label, expired } of clearList) {
      if (!dryRun) {
        const { error } = await app.from("profiles")
          .update({ pt_until: null, pt_ticket: null, pt_remaining: null }).eq("user_id", p.user_id);
        if (error) { failed.push(`${label}: ${error.message}`); continue; }
      }
      if (expired) tidied++; else ended++;
    }

    const ok = failed.length === 0;
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const note = [
      `PT ${want.size}명 · 새로 ${added} · 갱신 ${refreshed} · 종료 ${ended}${tidied ? ` · 만료 정리 ${tidied}` : ""}${testSkipped ? ` · 체험용 제외 ${testSkipped}` : ""}`,
      unmatched.length ? `앱 계정 없음 ${unmatched.length}명: ${unmatched.slice(0, 10).join(", ")}${unmatched.length > 10 ? " 외" : ""}` : null,
      noEvidence ? `확인 대기 ${noEvidence}명(153OS 확인 기록 없음 — 유효일이 지나면 저절로 끝남)` : null,
      lapsed ? `기간·확인이 지난 PT 기록 ${lapsed}건` : null,
      badPhone ? `번호 형식 오류 ${badPhone}건` : null,
      held || null,
      `${elapsed}초${dryRun ? " (dry-run)" : ""}`,
    ].filter(Boolean).join(" / ");

    if (!dryRun) {
      await app.from("member_sync_runs").insert({
        mode: "pt-sync", ok, scanned: ptRows.length, updated: added + refreshed + ended + tidied,
        failed: failed.length, error: failed.length ? failed.join(" | ").slice(0, 500) : null, note: note.slice(0, 500),
      });
    }
    return json({
      ok, dry_run: dryRun, pt: want.size, added, refreshed, ended, tidied, test_skipped: testSkipped,
      unmatched: unmatched.slice(0, 20), unmatched_count: unmatched.length, waiting_evidence: noEvidence,
      lapsed, bad_phone: badPhone, held: held || null, failed, note,
    }, ok ? 200 : 502);
  } catch (e) {
    console.error("sync-pt-members error:", e);
    await app.from("member_sync_runs")
      .insert({ mode: "pt-sync", ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
      .then(() => undefined, () => undefined);
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
