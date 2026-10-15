// 🤖 Claude(Anthropic) 호출 공용 모듈 — 2026-10-15 대표님: 월 200달러 API 크레딧으로 오삼코치 두뇌 교체.
//
// · ANTHROPIC_API_KEY 시크릿이 있을 때만 켜진다. 없으면 hasClaude() = false → 기존 Groq 체인이 그대로 돈다.
// · 앱(ChatAssistant.tsx)의 스트리밍 파서는 OpenAI 형식(data: {choices:[{delta:{content}}]} … [DONE])만 읽는다.
//   Claude 스트림을 그 형식으로 바꿔 흘려보내므로 앱 코드는 손대지 않는다.
// · Sonnet 5.5 주의 (마이그레이션 가이드, 2026-10-15 확인):
//     - temperature·top_p·top_k 에 기본값이 아닌 값을 보내면 400 → 보내지 않는다.
//     - 생각(thinking)이 기본으로 켜진다 → thinking: { type: "between_tools" } 로 끈다 ("disabled" 는 400).
//     - 마지막 메시지가 assistant 면(prefill) 400 → normalizeTurns 가 user 로 끝나게 맞춘다.
//     - 응답이 thinking 블록으로 시작할 수 있다 → text_delta 만 앱에 흘려보낸다.
// · 토큰·비용은 ai_usage_log 테이블에 남긴다 (기록 실패해도 응답에는 영향 없음).
// · 외부 import 가 없는 순수 모듈이다 — globalThis.Deno 만 흉내 내면 Bun 으로 그대로 테스트할 수 있다.

export const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
export const CLAUDE_API_VERSION = "2023-06-01";

/** 채팅 모델 — CLAUDE_CHAT_MODEL 시크릿으로 재배포 없이 바꿀 수 있다 */
export const CLAUDE_CHAT_MODEL = (Deno.env.get("CLAUDE_CHAT_MODEL") ?? "").trim() || "claude-sonnet-5-5";
/** 회원 메시지(오늘의 목표·출석 칭찬 등) 모델 — CLAUDE_COACH_MODEL 시크릿으로 교체 가능 */
export const CLAUDE_COACH_MODEL = (Deno.env.get("CLAUDE_COACH_MODEL") ?? "").trim() || "claude-haiku-5-5";

/** 100만 토큰당 달러 (2026-10-15 platform.claude.com 가격표). 배치는 이 값의 절반. */
const PRICE: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
};

/** 대시보드에 붙여넣을 때 섞이는 비ASCII 문자를 지운다 (chat-assistant cleanKey 와 같은 이유) */
export const claudeKey = (): string => (Deno.env.get("ANTHROPIC_API_KEY") ?? "").replace(/[^\x21-\x7E]/g, "");
export const hasClaude = (): boolean => claudeKey() !== "";

export type ClaudeUsage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

export const emptyUsage = (): ClaudeUsage => ({
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
});

export function costUsd(model: string, u: ClaudeUsage, batch = false): number {
  const p = PRICE[model];
  if (!p) return 0;
  const raw =
    (u.input_tokens * p.input +
      u.output_tokens * p.output +
      u.cache_read_input_tokens * p.cacheRead +
      u.cache_creation_input_tokens * p.cacheWrite) /
    1e6;
  return Math.round((batch ? raw / 2 : raw) * 1e8) / 1e8;
}

export type Turn = { role: "user" | "assistant"; content: string };

/** Claude 규칙에 맞춘다: user 로 시작·끝, 같은 역할이 연달아 오면 합친다, 빈 말은 버린다 */
export function normalizeTurns(msgs: Turn[]): Turn[] {
  const out: Turn[] = [];
  for (const m of msgs) {
    const text = (m.content ?? "").trim();
    if (!text) continue;
    if (out.length === 0 && m.role !== "user") continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + text;
    else out.push({ role: m.role, content: text });
  }
  while (out.length > 0 && out[out.length - 1].role !== "user") out.pop();
  return out;
}

/**
 * 모델별 생각(thinking) 설정 — 5.5 세대는 기본으로 생각이 켜진다 (2026-10-15 각 모델 마이그레이션 가이드).
 *   · Sonnet 5.5: { type: "between_tools" } — 도구가 없는 대화에서는 생각하지 않는다 ("disabled" 는 400)
 *   · Haiku 5.5: "adaptive" 만 받는다 ("enabled" 는 400, 끄는 값 없음) → effort "low" 로 쉬운 요청은 생각을 건너뛰게 한다.
 *     생각 토큰도 max_tokens 에 들어가니 max_tokens 를 넉넉히 준다.
 *   · 그 밖의 모델: 보내지 않는다 (서버 기본값)
 */
export function thinkingFor(model: string): { thinking?: Record<string, unknown>; effort?: string } {
  if (model.startsWith("claude-sonnet-5-5")) return { thinking: { type: "between_tools" } };
  if (model.startsWith("claude-haiku-5-5")) return { thinking: { type: "adaptive" }, effort: "low" };
  return {};
}

/**
 * 시스템 블록 — 글 그대로, 또는 { text, cache }.
 * cache: true 면 그 블록까지(앞 블록 포함)를 5분 캐시한다 — 쓰일 때마다 5분 연장, 읽기 값은 입력값의 5%(Sonnet 5.5).
 * 바뀌지 않는 글을 앞에, 매번 바뀌는 글을 뒤에 둬야 맞는다. 캐시 지점은 요청당 4개까지(넘는 표시는 무시).
 */
export type SystemPart = string | { text: string; cache?: boolean };

/** Messages API 요청 본문 — 스트림·배치가 같은 모양을 쓴다 */
export function buildClaudeBody(opts: {
  model: string;
  system: SystemPart[];
  messages: Turn[];
  maxTokens: number;
  stream?: boolean;
  /** 모든 요청에 똑같이 들어가는 첫 시스템 블록을 1시간 캐시한다 (배치에서 같은 지시문을 반복할 때) */
  cacheFirstSystem?: boolean;
  /** 답을 이 JSON 스키마 모양으로만 받는다 (output_config.format — minLength·maxLength 는 못 쓴다, 길이는 코드에서 검사) */
  jsonSchema?: Record<string, unknown>;
}): Record<string, unknown> {
  let marks = 0;
  const system = opts.system
    .map((s) => (typeof s === "string" ? { text: s, cache: false } : { text: s.text ?? "", cache: !!s.cache }))
    .filter((s) => s.text.trim() !== "")
    .map((s, i) => {
      // 1시간 캐시(첫 블록)가 5분 캐시보다 앞에 와야 한다 — 이 순서라 늘 맞는다
      if (opts.cacheFirstSystem && i === 0) {
        marks++;
        return { type: "text", text: s.text, cache_control: { type: "ephemeral", ttl: "1h" } };
      }
      if (s.cache && marks < 4) {
        marks++;
        return { type: "text", text: s.text, cache_control: { type: "ephemeral" } };
      }
      return { type: "text", text: s.text };
    });
  const t = thinkingFor(opts.model);
  const outputConfig: Record<string, unknown> = {
    ...(t.effort ? { effort: t.effort } : {}),
    ...(opts.jsonSchema ? { format: { type: "json_schema", schema: opts.jsonSchema } } : {}),
  };
  return {
    model: opts.model,
    max_tokens: opts.maxTokens,
    ...(opts.stream ? { stream: true } : {}),
    ...(t.thinking ? { thinking: t.thinking } : {}),
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
    ...(system.length > 0 ? { system } : {}),
    messages: normalizeTurns(opts.messages),
  };
}

export const claudeHeaders = (): Record<string, string> => ({
  "x-api-key": claudeKey(),
  "anthropic-version": CLAUDE_API_VERSION,
  "content-type": "application/json",
});

/** 스트리밍 호출. 응답 본문은 claudeToOpenAiSse 로 바꿔 앱에 넘긴다 */
export async function claudeStream(opts: {
  system: SystemPart[];
  messages: Turn[];
  maxTokens: number;
  model?: string;
}): Promise<Response> {
  return await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: claudeHeaders(),
    body: JSON.stringify(
      buildClaudeBody({
        model: opts.model ?? CLAUDE_CHAT_MODEL,
        system: opts.system,
        messages: opts.messages,
        maxTokens: opts.maxTokens,
        stream: true,
      }),
    ),
  });
}

const STREAM_FAIL_TEXT = "답을 만드는 중에 문제가 생겼어요. 잠시 뒤 다시 물어봐 주세요 🥊";

/**
 * Claude SSE → OpenAI 형식 SSE.
 *   content_block_delta(text_delta) → data: {"choices":[{"index":0,"delta":{"content":"…"}}]}
 *   thinking·ping 등은 버린다. 끝에 data: [DONE] 을 붙이고 onDone(usage, stop_reason) 을 한 번 부른다.
 *   스트림 중 error 이벤트가 오고 아직 보낸 글자가 없으면 안내 문장을 대신 보낸다.
 */
export function claudeToOpenAiSse(
  body: ReadableStream<Uint8Array>,
  onDone: (usage: ClaudeUsage, stop: string | null) => void,
): ReadableStream<Uint8Array> {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const usage = emptyUsage();
  const reader = body.getReader();
  let stop: string | null = null;
  let buf = "";
  let sent = 0;
  let finished = false;

  const emit = (ctrl: ReadableStreamDefaultController<Uint8Array>, text: string) => {
    sent += text.length;
    ctrl.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: text } }] })}\n\n`));
  };
  const finish = (ctrl: ReadableStreamDefaultController<Uint8Array>) => {
    if (finished) return;
    finished = true;
    ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
    try {
      onDone(usage, stop);
    } catch {
      /* 기록 실패는 응답에 영향 없음 */
    }
    ctrl.close();
  };
  const handle = (ctrl: ReadableStreamDefaultController<Uint8Array>, line: string): boolean => {
    if (!line.startsWith("data:")) return false;
    // deno-lint-ignore no-explicit-any
    let ev: any;
    try {
      ev = JSON.parse(line.slice(5).trim());
    } catch {
      return false;
    }
    switch (ev?.type) {
      case "message_start": {
        const u = ev.message?.usage ?? {};
        usage.input_tokens = u.input_tokens ?? 0;
        usage.output_tokens = u.output_tokens ?? 0;
        usage.cache_read_input_tokens = u.cache_read_input_tokens ?? 0;
        usage.cache_creation_input_tokens = u.cache_creation_input_tokens ?? 0;
        return false;
      }
      case "content_block_delta":
        if (ev.delta?.type === "text_delta" && typeof ev.delta.text === "string" && ev.delta.text) emit(ctrl, ev.delta.text);
        return false;
      case "message_delta":
        if (typeof ev.usage?.output_tokens === "number") usage.output_tokens = ev.usage.output_tokens;
        if (typeof ev.usage?.input_tokens === "number" && ev.usage.input_tokens > 0) usage.input_tokens = ev.usage.input_tokens;
        stop = ev.delta?.stop_reason ?? stop;
        return false;
      case "error":
        console.error("[claude] stream error", JSON.stringify(ev.error ?? {}).slice(0, 300));
        if (sent === 0) emit(ctrl, STREAM_FAIL_TEXT);
        return true;
      case "message_stop":
        return true;
      default:
        return false;
    }
  };

  return new ReadableStream<Uint8Array>({
    // pull 은 한 번에 최소 한 조각을 내보내거나 끝내야 한다. 아무것도 넣지 않고 돌아가면
    // 스트림이 다시 pull 하지 않아 멈춘다 (thinking·ping 만 온 조각이 그 경우) — 그래서 반복한다.
    async pull(ctrl) {
      try {
        for (;;) {
          const before = sent;
          const { done, value } = await reader.read();
          if (done) {
            if (buf.trim()) handle(ctrl, buf.replace(/\r$/, ""));
            if (sent === 0) emit(ctrl, STREAM_FAIL_TEXT);
            finish(ctrl);
            return;
          }
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) !== -1) {
            const line = buf.slice(0, i).replace(/\r$/, "");
            buf = buf.slice(i + 1);
            if (handle(ctrl, line)) {
              finish(ctrl);
              void reader.cancel().catch(() => {});
              return;
            }
          }
          if (sent > before) return;
        }
      } catch (e) {
        console.error("[claude] stream read failed", e instanceof Error ? e.message : e);
        if (!finished) {
          if (sent === 0) emit(ctrl, STREAM_FAIL_TEXT);
          finish(ctrl);
        }
      }
    },
    cancel(reason) {
      void reader.cancel(reason).catch(() => {});
    },
  });
}

// ───────────────────────── 단건 호출 · 배치 (오삼코치 메시지) ─────────────────────────

// deno-lint-ignore no-explicit-any
export type ClaudeMessage = { content?: any[]; usage?: Record<string, number>; stop_reason?: string | null; model?: string };

/** 응답의 text 블록만 이어 붙인다 (thinking 블록은 버린다) */
export function messageText(msg: ClaudeMessage | null | undefined): string {
  return (msg?.content ?? [])
    .filter((b) => b && b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
}

export function usageOf(msg: ClaudeMessage | null | undefined): ClaudeUsage {
  const u = msg?.usage ?? {};
  return {
    input_tokens: Number(u.input_tokens) || 0,
    output_tokens: Number(u.output_tokens) || 0,
    cache_read_input_tokens: Number(u.cache_read_input_tokens) || 0,
    cache_creation_input_tokens: Number(u.cache_creation_input_tokens) || 0,
  };
}

/** 스트림 없는 단건 호출 — 실패하면 throw (메시지에 상태 코드와 앞부분만) */
export async function claudeMessage(body: Record<string, unknown>): Promise<ClaudeMessage> {
  const r = await fetch(CLAUDE_API_URL, { method: "POST", headers: claudeHeaders(), body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`claude ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as ClaudeMessage;
}

export const CLAUDE_BATCHES_URL = "https://api.anthropic.com/v1/messages/batches";

export type BatchInfo = {
  id: string;
  processing_status: "in_progress" | "canceling" | "ended" | string;
  request_counts?: Record<string, number>;
  results_url?: string | null;
  created_at?: string;
  ended_at?: string | null;
  expires_at?: string;
};

export type BatchRequest = { custom_id: string; params: Record<string, unknown> };

export type BatchResult = {
  custom_id: string;
  result:
    | { type: "succeeded"; message: ClaudeMessage }
    | { type: "errored"; error?: unknown }
    | { type: "canceled" }
    | { type: "expired" };
};

/** 배치 만들기 — custom_id 는 영문·숫자·_·- 1~64자 (uuid 그대로 된다) */
export async function claudeCreateBatch(requests: BatchRequest[]): Promise<BatchInfo> {
  const r = await fetch(CLAUDE_BATCHES_URL, { method: "POST", headers: claudeHeaders(), body: JSON.stringify({ requests }) });
  const text = await r.text();
  if (!r.ok) throw new Error(`batch create ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as BatchInfo;
}

export async function claudeGetBatch(id: string): Promise<BatchInfo> {
  const r = await fetch(`${CLAUDE_BATCHES_URL}/${encodeURIComponent(id)}`, { headers: claudeHeaders() });
  const text = await r.text();
  if (!r.ok) throw new Error(`batch get ${r.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as BatchInfo;
}

/** 끝난 배치의 결과(JSONL) — 한 줄에 요청 하나. 깨진 줄은 건너뛴다 */
export async function claudeBatchResults(info: BatchInfo): Promise<BatchResult[]> {
  const url = info.results_url || `${CLAUDE_BATCHES_URL}/${encodeURIComponent(info.id)}/results`;
  const r = await fetch(url, { headers: claudeHeaders() });
  const text = await r.text();
  if (!r.ok) throw new Error(`batch results ${r.status}: ${text.slice(0, 300)}`);
  return parseBatchJsonl(text);
}

export function parseBatchJsonl(text: string): BatchResult[] {
  const out: BatchResult[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (j && typeof j.custom_id === "string" && j.result && typeof j.result.type === "string") out.push(j as BatchResult);
    } catch {
      /* 깨진 줄은 건너뛴다 */
    }
  }
  return out;
}

/** ai_usage_log 에 한 줄 남긴다. db 는 서비스 롤 클라이언트(없으면 건너뜀). 실패해도 조용히. */
export async function logAiUsage(
  // deno-lint-ignore no-explicit-any
  db: any,
  row: {
    feature: string;
    model: string;
    usage: ClaudeUsage;
    userId?: string | null;
    batch?: boolean;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  if (!db) return;
  try {
    const { error } = await db.from("ai_usage_log").insert({
      feature: row.feature,
      model: row.model,
      user_id: row.userId ?? null,
      input_tokens: row.usage.input_tokens,
      output_tokens: row.usage.output_tokens,
      cache_read_tokens: row.usage.cache_read_input_tokens,
      cache_write_tokens: row.usage.cache_creation_input_tokens,
      batch: !!row.batch,
      cost_usd: costUsd(row.model, row.usage, !!row.batch),
      meta: row.meta ?? {},
    });
    if (error) console.warn("[claude] usage log failed (non-fatal):", error.message);
  } catch (e) {
    console.warn("[claude] usage log failed (non-fatal):", e instanceof Error ? e.message : e);
  }
}

/** 응답이 끝난 뒤에도 기록 작업이 잘리지 않게 (Supabase Edge Runtime) */
export function keepAlive(p: Promise<unknown>): void {
  (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(p);
}
