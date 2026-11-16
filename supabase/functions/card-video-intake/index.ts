// 카드 영상 넣기 통로 — 클로드가 작업 공간에서 비공개 저장소 training-videos 에 회원용 영상 · 첫 장면을 올릴 때만 (2026-11-16)
//   대표님 「구글 드라이브에 있는 복싱 기본기 · 기술 영상 모두 볼 수 있게」 — 크롬 자동화는 한 번에 10MB 아래만 넣을 수 있어
//   큰 영상(최대 20MB)을 바로 올리는 길. 앱 화면은 이 함수를 부르지 않는다.
//   · 열쇠: internal_sync_config key 'card_video_intake' = {"hash": sha256(일회 열쇠) 16진, "exp": ISO 시각} 를
//     클로드가 SQL 로 잠깐(2시간 안) 넣고, 다 올리면 지운다 — 열쇠 원문은 DB · 채팅 · 저장소 어디에도 없다.
//   · POST {token, path} → 서명된 올리기 주소(signedUrl, 2시간). path = member/<…>.mp4 | .webp 만 · 이미 있는 파일은 거절(덮어쓰기 없음).
//   · verify_jwt = false (config.toml) — 열쇠가 문지기.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const BUCKET = "training-videos";
const PATH_RE = /^member\/[A-Za-z0-9._-]{1,120}\.(mp4|webp)$/;

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, code: "METHOD" }, 405);
  const body = (await req.json().catch(() => null)) as { token?: unknown; path?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const path = typeof body?.path === "string" ? body.path : "";
  if (token.length < 32 || token.length > 200) return json({ ok: false, code: "FORBIDDEN" }, 403);
  if (!PATH_RE.test(path)) return json({ ok: false, code: "BAD_PATH" }, 400);

  const app = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: row } = await app.from("internal_sync_config").select("value").eq("key", "card_video_intake").maybeSingle();
  let cfg: { hash?: string; exp?: string } | null = null;
  try {
    cfg = row?.value ? JSON.parse(row.value) : null;
  } catch {
    cfg = null;
  }
  const exp = cfg?.exp ? Date.parse(cfg.exp) : NaN;
  if (!cfg?.hash || !Number.isFinite(exp) || exp < Date.now() || exp > Date.now() + 3 * 3600_000) {
    return json({ ok: false, code: "FORBIDDEN" }, 403);
  }
  if (!sameText(await sha256Hex(token), String(cfg.hash).toLowerCase())) return json({ ok: false, code: "FORBIDDEN" }, 403);

  const { data, error } = await app.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data?.signedUrl) return json({ ok: false, code: "STORAGE", message: error?.message ?? "no url" }, 409);
  return json({ ok: true, path: data.path, signedUrl: data.signedUrl });
});
