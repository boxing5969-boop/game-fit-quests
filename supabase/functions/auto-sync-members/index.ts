// 회원 자동 동기화 러너 (크론 전용).
// 흐름: pg_cron → 이 함수 → 기존 sync-members-to-app(SYNC_KEY 는 프로젝트 시크릿에서 읽음)
// 인증: DB(internal_sync_config.auto_sync_key)에 저장된 내부 키를 x-auto-key 헤더로 검증.
//       외부 비밀키를 크론이나 코드에 노출하지 않는다.
//
// 2026-08-07 수정 — 실패가 이력에 안 남던 문제 해결.
//   기존: ok = res.ok && out?.ok === true 만 봐서, 링크가 하나도 안 돼도 ok:true / failed:0 으로 기록됐다.
//   실제로 2026-08-03 ~ 08-07 사이 191회 연속 "성공"으로 기록되는 동안
//   같은 회원 9명이 매번 실패하고 있었다.
//   이제 ① 실패 목록이 있으면 실패로 기록 ② new-members 모드인데 스캔은 됐는데
//   생성·링크가 0인 "헛도는 실행"도 실패로 잡는다.
//
// 2026-09-17 수정 — 전체 새로고침이 전 회원을 도는다.
//   기존: force 모드가 limit 1000 한 번만 호출해서, created_at 이 가장 오래된 1,000명만
//         매일 갱신되고 나머지 2,341명은 한 번도 갱신되지 않았다.
//   이제 internal_sync_config.full_refresh_cursor 에 진행 위치를 저장하고,
//   한 번 실행당 시간 예산(budgetMs) 안에서 여러 페이지를 돌린 뒤 커서를 넘긴다.
//   끝까지 가면 커서를 0으로 되돌려 다음 사이클을 시작한다.
//   또 dup_skipped(같은 사람의 다지점 등록)는 정상 상황이므로 실패로 세지 않는다.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-auto-key",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const CURSOR_KEY = "full_refresh_cursor";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const startedAt = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SYNC_KEY = Deno.env.get("SYNC_KEY") || "";
  const db = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    // 1) 내부 키 검증
    const provided = req.headers.get("x-auto-key") || "";
    const { data: cfg } = await db
      .from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
    if (!cfg?.value || provided !== cfg.value) return json({ error: "unauthorized" }, 401);
    if (!SYNC_KEY) {
      await db.from("member_sync_runs").insert({ mode: "unknown", ok: false, error: "SYNC_KEY 미설정" });
      return json({ error: "SYNC_KEY 미설정" }, 503);
    }

    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;
    const limit = Number(body?.limit) > 0 ? Math.min(1000, Number(body.limit)) : (force ? 500 : 200);
    const mode = force ? "full-refresh" : "new-members";
    // 한 번 실행에 쓸 시간 예산. 크론의 pg_net timeout(150s)보다 넓지 않게 잡는다.
    const budgetMs = Number(body?.budget_ms) > 0 ? Math.min(240_000, Number(body.budget_ms)) : 110_000;
    const maxPages = Number(body?.max_pages) > 0 ? Math.min(20, Number(body.max_pages)) : (force ? 8 : 1);

    // 2) 전체 새로고침은 저장된 커서에서 이어서 돌린다(모두가 공평하게 갱신되도록).
    let cursor = 0;
    if (force) {
      if (Number.isFinite(Number(body?.offset)) && Number(body.offset) >= 0) {
        cursor = Math.floor(Number(body.offset));
      } else {
        const { data: cur } = await db
          .from("internal_sync_config").select("value").eq("key", CURSOR_KEY).maybeSingle();
        cursor = Math.max(0, Number(cur?.value ?? 0) || 0);
      }
    }
    const startCursor = cursor;

    // 3) 페이지를 돌린다.
    let scanned = 0, createdN = 0, updatedN = 0, linkedN = 0, dupN = 0, pages = 0;
    let wrapped = false, ran = true, httpErr: string | null = null;
    const failedList: Array<{ member_id?: string; reason?: string }> = [];

    while (pages < maxPages) {
      const payload: Record<string, unknown> = { force, limit };
      if (force) payload.offset = cursor;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-members-to-app`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sync-key": SYNC_KEY },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      pages++;

      if (!res.ok || out?.ok !== true) {
        ran = false;
        httpErr = String(out?.error ?? `HTTP ${res.status}`).slice(0, 400);
        break;
      }

      const pageScanned = Number(out?.scanned ?? 0);
      scanned += pageScanned;
      createdN += Number(out?.created ?? 0);
      updatedN += Number(out?.updated ?? 0);
      linkedN += Number(out?.linked ?? 0);
      dupN += Number(out?.dup_skipped ?? 0);
      if (Array.isArray(out?.failed)) failedList.push(...out.failed);

      if (!force) break;

      const next = out?.next_offset;
      if (next === null || next === undefined) {
        // 마지막 페이지 — 한 바퀴 완주. 다음 사이클은 처음부터.
        cursor = 0;
        wrapped = true;
        break;
      }
      cursor = Number(next);
      if (Date.now() - startedAt > budgetMs) break;
    }

    // 4) 커서 저장(다음 실행이 여기서 이어받는다).
    if (force && ran) {
      await db.from("internal_sync_config")
        .upsert({ key: CURSOR_KEY, value: String(cursor), updated_at: new Date().toISOString() }, { onConflict: "key" });
    }

    // 5) 실패 판정
    // new-members 모드는 '아직 연결 안 된 회원'만 스캔한다.
    // 스캔은 됐는데 생성·링크가 0이면 그 회원들은 이번에도 처리되지 않았다는 뜻 —
    // 다음 실행에서 똑같이 반복되므로 반드시 실패로 남긴다.
    // 단, dup_skipped(같은 사람의 다지점 등록)는 영원히 링크되지 않는 게 정상이므로 제외한다.
    const stuck = ran && !force && scanned > 0 && createdN === 0 && linkedN === 0 && dupN === 0;
    const ok = ran && failedList.length === 0 && !stuck;

    let error: string | null = null;
    if (!ran) {
      error = httpErr;
    } else if (failedList.length > 0) {
      const reasons = failedList
        .map((f) => `${f.member_id ?? "?"}: ${f.reason ?? "사유없음"}`)
        .join(" | ");
      error = `실패 ${failedList.length}건 — ${reasons}`.slice(0, 500);
    } else if (stuck) {
      error = `헛도는 실행: ${scanned}건 스캔했으나 생성·링크 0건 (같은 회원이 매 실행 반복 처리 중)`.slice(0, 500);
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const note = force
      ? `커서 ${startCursor}→${cursor}${wrapped ? " (한 바퀴 완주)" : ""} / ${pages}페이지 / 다지점중복 ${dupN}건 / ${elapsed}초`
      : `${pages}페이지 / 다지점중복 ${dupN}건 / ${elapsed}초`;

    // 6) 이력 기록
    await db.from("member_sync_runs").insert({
      mode, ok, scanned, created: createdN, updated: updatedN, linked: linkedN,
      failed: failedList.length, error, note,
    });

    return json({ ok, mode, stuck, pages, cursor, wrapped, scanned, created: createdN, updated: updatedN, linked: linkedN, dup_skipped: dupN, failed: failedList }, ok ? 200 : 502);
  } catch (e) {
    await db.from("member_sync_runs").insert({
      mode: "error", ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
    });
    return json({ error: "처리 중 오류가 발생했습니다." }, 500);
  }
});
