// 타이틀매치 영상 보관 한 달 — 크론이 매일 04:23 KST 에 부른다 (2026-11-12 대표님 「2번까지 하고 보관기관은 한달로」)
//   · 도전이 끝난(합격 · 마감 · 취소) 지 30일 지난 도전의 영상 파일(치는 영상 · 받는 영상)을 저장소에서 지우고
//     title_match_attempts.video_deleted_at 에 지운 시각을 남긴다 — 합격 · 불합격 기록은 그대로.
//   · 기록에 붙지 않은 영상(올리다 끊긴 파일)은 하루 지나면 지운다.
//   · 고르기 = DB title_match_video_cleanup_targets(_days, _limit) · 지운 표시 = title_match_mark_videos_deleted(_paths)
//     (마이그레이션 20261112173151_title_match_video_retention.sql). storage.objects 는 SQL 로 못 지운다 → 저장소 API(remove).
//   · x-auto-key(internal_sync_config.auto_sync_key) · verify_jwt = false (config.toml).
//   · body: { dry_run?: true (고르기만), days?: 30 (보관 날수, 1~365) }
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const BUCKET = "title-match-videos";
const KEEP_DAYS = 30;
const BATCH = 200;
const CHUNK = 100;

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const app = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });

  const provided = req.headers.get("x-auto-key") || "";
  const { data: cfg } = await app.from("internal_sync_config").select("value").eq("key", "auto_sync_key").maybeSingle();
  if (!provided || !cfg?.value || provided !== cfg.value) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const dryRun = body?.dry_run === true;
  const daysIn = Number(body?.days ?? KEEP_DAYS);
  const days = Number.isFinite(daysIn) ? Math.min(365, Math.max(1, Math.round(daysIn))) : KEEP_DAYS;

  const { data: targets, error } = await app.rpc("title_match_video_cleanup_targets", { _days: days, _limit: BATCH });
  if (error) return json({ error: "targets_failed", detail: error.message }, 500);
  const rows = (targets ?? []) as { path: string; reason: string }[];
  const paths = [...new Set(rows.map((r) => r.path).filter(Boolean))];
  const closed = rows.filter((r) => r.reason === "closed").length;
  const orphans = rows.filter((r) => r.reason === "orphan").length;
  if (dryRun || paths.length === 0) return json({ ok: true, dryRun, days, found: paths.length, closed, orphans, sample: paths.slice(0, 5) });

  // 저장소에서 지우기 — 이미 없는 파일은 조용히 넘어간다(지운 것으로 본다)
  let removed = 0;
  const failed = new Set<string>();
  for (let i = 0; i < paths.length; i += CHUNK) {
    const chunk = paths.slice(i, i + CHUNK);
    const { data, error: rmErr } = await app.storage.from(BUCKET).remove(chunk);
    if (rmErr) {
      console.error("title-video-cleanup remove", rmErr.message);
      chunk.forEach((p) => failed.add(p));
      continue;
    }
    removed += (data ?? []).length;
  }

  const done = paths.filter((p) => !failed.has(p));
  const { data: marked, error: markErr } = await app.rpc("title_match_mark_videos_deleted", { _paths: done });
  if (markErr) console.error("title-video-cleanup mark", markErr.message);

  return json({
    ok: !markErr && failed.size === 0,
    days,
    found: paths.length,
    closed,
    orphans,
    removed,
    failed: failed.size,
    marked: marked ?? 0,
    markError: markErr?.message ?? null,
  });
});
