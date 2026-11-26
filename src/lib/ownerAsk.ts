/**
 * 📊 오삼코치 관장 모드 — 화면 쪽 글 · 판단 (2026-11-27 대표님 「다음가지」 · 관장님 앱 ③ · docs/features/69)
 *   관장 · 지점장 · 본사이고 관장 모드를 켠 지점(서버 owner_ai_scope)일 때만:
 *     · 오삼코치 첫 인사 · 추천 질문을 관장님 것으로, 운영 숫자 질문은 앱 안내(지식 베이스) 대신 바로 AI 로
 *     · 관장님 숫자 칸 아래 질문 단추 세 개 → 오삼코치가 열리며 바로 묻는다(창 이벤트 osami:ask)
 *   서버는 supabase/functions/_shared/ownerAi.ts(도구 6개 · 지점마다 하루 50번). 시험 ownerAsk.test.ts.
 */
import type { OwnerHomeData } from "@/lib/ownerKpi";

export interface OwnerAiScope {
  on: boolean;
  role: "admin" | "manager" | "none";
  branch: string | null;
  daily: number;
  left: number;
}

export const OWNER_AI_OFF: OwnerAiScope = { on: false, role: "none", branch: null, daily: 0, left: 0 };

const numOr = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** 서버 owner_ai_scope() 답 → 화면 범위 */
export function normalizeOwnerAiScope(raw: unknown): OwnerAiScope {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  if (o.on !== true || typeof o.branch !== "string" || !o.branch) return OWNER_AI_OFF;
  return {
    on: true,
    role: o.role === "admin" ? "admin" : "manager",
    branch: o.branch,
    daily: Math.max(0, numOr(o.daily, 50)),
    left: Math.max(0, numOr(o.left, 0)),
  };
}

const honorific = (s: OwnerAiScope) => (s.role === "admin" ? "대표님" : "지점장님");

/** 첫 인사 — 관장 모드 */
export function ownerWelcome(s: OwnerAiScope): string {
  return [
    `${honorific(s)}, 오삼코치 관장 모드예요 🥊`,
    "",
    "153OS 숫자(출석률 · 재등록률 · 매출 · 회원 명단)를 보고 답해 드려요. 「출석률 왜 떨어졌어?」처럼 편하게 물어보세요.",
    `숫자를 보는 질문은 지점마다 하루 ${s.daily || 50}번까지예요. 복싱 · 앱 사용법도 그대로 물어보셔도 돼요.`,
  ].join("\n");
}

/** 머리글 추천 질문 — 관장 모드 */
export const OWNER_CHIPS = ["이번 달 숫자 요약", "출석률 왜 떨어졌어?", "오늘 연락할 회원", "재등록 올리려면?", "첫 4주 신규 누구 챙겨?", "잽 잘 치는 법"];

/** 머리글 아래 작은 글 */
export function ownerSubtitle(s: OwnerAiScope): string {
  return s.left > 0 ? `153OS 숫자로 답해요 · 오늘 ${s.left}번 남음` : "오늘 숫자 질문을 다 썼어요 · 복싱 · 앱 질문은 그대로";
}

/**
 * 운영 숫자 질문인가 — 맞으면 앱 안내(지식 베이스) 즉답을 건너뛰고 AI(관장 모드)로 보낸다.
 * 「출석 방법」「홀딩 어떻게 해요」 같은 앱 사용법은 걸리지 않게 숫자 · 운영 낱말만 본다.
 */
const OWNER_Q =
  /(출석률|출석\s*율|재등록|매출|유효\s*회원|회원\s*수|몇\s*명|기간\s*임박|만료\s*(예정|임박|회원)|안\s*(온|오는|나오는)\s*회원|명단|연락할|챙길|챙겨|신규|첫\s*4\s*주|톡톡|문의|코치별|이번\s*달|지난\s*달|이번달|지난달|흐름|추세|떨어졌|떨어진|올랐|올리려면|늘리려면|줄었|늘었|요약|객단가|전환율|체험\s*(몇|수)|등록\s*(수|률|율))/;

export const isOwnerQuestion = (text: string): boolean => OWNER_Q.test(text.replace(/\s+/g, " "));

/** 관장님 숫자 칸 아래 질문 단추 세 개 — 숫자에 맞춰 고른다 */
export function ownerAskChips(d: OwnerHomeData | null | undefined): string[] {
  const a = d?.owner?.attendance;
  const down = !!a && a.rate !== null && a.prevRate !== null && a.rate < a.prevRate;
  const first = down ? "출석률 왜 떨어졌어?" : "출석률 80% 만들려면?";
  const second = "이번 주 재등록 챙길 회원은?";
  const third = d?.salesVisible ? "이번 달 매출 지난달이랑 비교해 줘" : "첫 4주 신규 누구 챙겨?";
  return [first, second, third];
}

/** 오삼코치를 열고 바로 묻는다 — ChatAssistant 가 듣는다 */
export const OSAMI_ASK_EVENT = "osami:ask";
export interface OsamiAskDetail {
  q: string;
  /** 관장 모드로 물어 달라(서버가 owner_ai_scope 로 다시 확인한다) */
  owner?: boolean;
}

type AskWindow = Window & { __osamiAsk?: OsamiAskDetail | null };

/**
 * 묻기 — 창 이벤트로 보내고, 오삼코치 조각이 아직 안 받아졌을 때를 위해 한 번 남겨 둔다
 * (ChatAssistant 는 따로 받는 조각이라 첫 화면 직후에는 아직 없을 수 있다 · 받아지면 takePendingOsamiAsk 로 꺼낸다).
 */
export function askOsami(q: string, opts: { owner?: boolean } = {}): void {
  if (typeof window === "undefined" || !q.trim()) return;
  const detail: OsamiAskDetail = { q: q.trim(), owner: !!opts.owner };
  (window as AskWindow).__osamiAsk = detail;
  window.dispatchEvent(new CustomEvent<OsamiAskDetail>(OSAMI_ASK_EVENT, { detail }));
}

/** 남겨 둔 질문을 꺼낸다(한 번만) */
export function takePendingOsamiAsk(): OsamiAskDetail | null {
  if (typeof window === "undefined") return null;
  const w = window as AskWindow;
  const d = w.__osamiAsk ?? null;
  w.__osamiAsk = null;
  return d && typeof d.q === "string" && d.q.trim() ? d : null;
}
