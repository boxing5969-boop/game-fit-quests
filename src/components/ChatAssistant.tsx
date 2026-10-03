import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Send, AlertTriangle, Sparkles, ChevronRight, Bot } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { findOsamiFaq, type OsamiFaqLink } from "@/data/osamiFaq";
import { buildKbContext, isCoachingTopic, matchOsamiFaq, planOsamiReply, type OsamiMatch } from "@/lib/osamiKb";

/**
 * 🥊 오삼 코치 — 2단 답변 (2026-10-03)
 *   1단: 앱 사용법·규칙 질문은 지식 베이스(data/osamiFaq.ts)에서 바로 답한다 — AI 서버를 부르지 않는다.
 *        애매하면 "이걸 물어보신 걸까요?" 후보 칩을 보여 주고, 회원이 고르면 그 답을 보여 준다.
 *   2단: 복싱 기술·식단·고민처럼 지식 베이스에 없는 질문만 chat-assistant 에지 함수(AI)로 보낸다.
 *        이때 같은 지식 베이스에서 고른 관련 항목(kb)을 함께 보내 AI 가 앱 사실을 틀리지 않게 한다 — 서버에 복사본 없음.
 * 경로는 하나다 — 이 컴포넌트 + supabase/functions/chat-assistant. 새 챗 박스를 만들지 않는다.
 */

type Suggestion = { id: string; q: string };

type Msg = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
  /** faq = 앱 안내(지식 베이스), ai = AI 코치, local = 인사 등 */
  source?: "faq" | "ai" | "local";
  /** 앱 안내 답이면 그 항목 id — 이어지는 AI 질문에 참고 자료로 넘긴다 */
  faqId?: string;
  /** 앱 안 바로가기 */
  links?: OsamiFaqLink[];
  /** "이걸 물어보신 걸까요?" 후보 */
  suggestions?: Suggestion[];
  /** 이 질문을 AI 코치에게 그대로 넘길 수 있게 */
  askAi?: string;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`;

// 무료 AI 쿼터 보호:
//   COOLDOWN_MS — 연타 방지. 동일 유저가 이 간격 이내 재전송 시도 시 무시.
//   CACHE_TTL_MS — 같은 질문을 이 시간 안에 다시 묻는 경우 API 호출 없이 재사용.
//   CACHE_MAX — 메모리 캐시 엔트리 상한 (오래된 것부터 제거).
const COOLDOWN_MS = 1_500;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 20;

const normalizeQ = (s: string) =>
  s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * AI 답의 마크다운 기호를 걷어낸다 — 말풍선은 글자를 그대로 보여 주므로 **굵게**·# 제목·`코드`가 기호째 노출된다.
 * 프롬프트로도 금지하지만 모델이 가끔 어겨서 화면에서 한 번 더 지운다. (지식 베이스 답은 손대지 않는다)
 */
const stripMarkdown = (s: string) =>
  s
    // 추론 모델의 생각 과정(<think>…</think>) — 서버가 숨기도록 요청하지만 혹시 섞여 오면 지운다 (닫히기 전 스트리밍 중에도)
    .replace(/<think>[\s\S]*?(<\/think>|$)/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s).,!?]|$)/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/[ \t]+$/gm, "");

const WELCOME_MSG: Msg = {
  role: "assistant",
  source: "local",
  content:
    "안녕하세요! 153복싱짐 오삼 코치예요 🥊\n\n출석·레벨업·수강권·알림처럼 앱 사용법은 바로 답해 드리고, 복싱 기술이나 식단 고민은 AI 코치가 자세히 설명해 드려요. 말하듯이 편하게 물어보세요!",
};

/** 머리글 추천 질문 — 누르면 바로 보낸다 */
const QUICK_CHIPS = ["레벨업 조건", "출석 방법", "마일리지", "휴대폰 알림 켜기", "타이틀매치가 뭐예요", "잽 잘 치는 법"];

const toSuggestions = (list: OsamiMatch[], excludeId?: string, max = 3): Suggestion[] =>
  list
    .filter((m) => m.entry.id !== excludeId)
    .slice(0, max)
    .map((m) => ({ id: m.entry.id, q: m.entry.q }));

/** 로그인 전 안내 칩 — 계정·로그인 도움말 (문구는 지식 베이스에서) */
const LOGIN_HELP: Suggestion[] = ["start-first-login", "acct-find-id", "acct-reset-pw"]
  .map((id) => findOsamiFaq(id))
  .filter((f): f is NonNullable<typeof f> => !!f)
  .map((f) => ({ id: f.id, q: f.q }));

/**
 * AI 요청에 실을 앱 지식 — 질문과 관련 있는 항목 + 바로 앞에 보여 준 앱 안내 답.
 * 앱 안내 즉답은 AI 대화 기록에 들어가지 않으므로 "그건 어디서 해요?" 같은 후속 질문의 문맥을 여기로 넘긴다.
 * history 의 마지막은 방금 보낸 회원 말이고, 그 바로 앞이 앱 안내 답일 때만 붙인다.
 * 복싱·식단·마음가짐 질문은 그 자체로 완결된 새 화제라 붙이지 않는다 (토큰 절약·엉뚱한 참고 방지).
 */
const kbFor = (text: string, history: Msg[]) => {
  const kb = buildKbContext(text);
  if (isCoachingTopic(text)) return kb;
  const prev = history[history.length - 2];
  const f = prev?.role === "assistant" && prev.source === "faq" && prev.faqId ? findOsamiFaq(prev.faqId) : undefined;
  if (f && !kb.hints.some((h) => h.q === f.q)) kb.hints = [{ q: f.q, answer: f.answer }, ...kb.hints].slice(0, 4);
  return kb;
};

const ChatAssistant = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLimitReached, setIsApiLimitReached] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSendAtRef = useRef(0);
  const cacheRef = useRef(new Map<string, { answer: string; at: number }>());
  /** 계정이 바뀔 때마다 1씩 — 진행 중이던 AI 답이 새 계정의 대화에 붙지 않게 */
  const sessionRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, isLoading]);

  // 로그아웃·다른 계정 로그인 — 앞 사람의 대화와 AI 답 캐시(개인화 답 포함)를 남기지 않는다
  const userId = user?.id ?? null;
  useEffect(() => {
    sessionRef.current += 1;
    setMessages([WELCOME_MSG]);
    cacheRef.current.clear();
    setIsApiLimitReached(false);
  }, [userId]);

  const push = useCallback((m: Msg) => setMessages((prev) => [...prev, m]), []);

  /** 지식 베이스 항목 하나를 답으로 보여 준다 */
  const showFaq = useCallback((id: string, others: Suggestion[] = [], askAi?: string) => {
    const f = findOsamiFaq(id);
    if (!f) return;
    push({ role: "assistant", source: "faq", faqId: f.id, content: f.answer, links: f.links, suggestions: others, askAi });
  }, [push]);

  /**
   * 2단 — AI 코치에게 묻는다 (지식 베이스에 없거나 회원이 직접 요청했을 때).
   * trailing: 답이 끝난 뒤 말풍선 아래 붙일 "관련 앱 안내" 칩 (1단 후보가 애매했던 경우).
   */
  const askAi = useCallback(async (text: string, history: Msg[], trailing: Suggestion[] = []) => {
    const qKey = normalizeQ(text);
    const cached = cacheRef.current.get(qKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      push({ role: "assistant", source: "ai", content: cached.answer, suggestions: trailing });
      return;
    }
    setIsLoading(true);
    const session = sessionRef.current;
    const stale = () => sessionRef.current !== session;
    let assistantSoFar = "";
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      // 모델에게는 "회원 질문 → AI 답" 짝만 보낸다. 지식 베이스 즉답·인사·오류 토스트와
      // 그 질문들은 모델의 대화가 아니었으므로 빼야 한다 — 섞으면 LLM 이 자기 발언으로 오해하거나
      // 답 없는 질문이 연달아 보여 흐름이 깨진다. (서버가 다시 최근 몇 개로 자른다)
      const convo: Array<{ role: "user" | "assistant"; content: string }> = [];
      history.forEach((m, i) => {
        if (m.role !== "assistant" || m.source !== "ai" || m.isError || m === WELCOME_MSG) return;
        const q = history[i - 1];
        if (q?.role === "user") convo.push({ role: "user", content: q.content });
        // 화면과 같은 글로 — 모델이 자기 마크다운을 보고 따라 하지 않게
        convo.push({ role: "assistant", content: stripMarkdown(m.content) });
      });

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        // kb: 지식 베이스에서 고른 관련 항목 + (앱 화제면) 기능 지도 — 서버가 [앱 안내]·[앱 기능 지도] 로 프롬프트에 끼운다
        body: JSON.stringify({ messages: [...convo, { role: "user", content: text }], kb: kbFor(text, history) }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429 || resp.status === 402) {
          setIsApiLimitReached(true);
          // 60초 후 자동 해제 — 분당 한도면 1분 안에 회복. 실제로 한도 안 풀려 있으면 다음 호출에서 다시 잠김.
          setTimeout(() => setIsApiLimitReached(false), 60_000);
          throw new Error("AI 코치가 잠시 숨 고르는 중이에요 💦\n질문이 몰려서 그래요. 1분 뒤에 다시 물어봐 주세요. (앱 사용법은 지금도 바로 답해 드려요)");
        }
        if (resp.status === 401) {
          throw new Error("로그인이 풀린 것 같아요. 다시 로그인한 뒤 물어봐 주세요 🥊 (앱 사용법은 지금도 바로 답해 드려요)");
        }
        // 진단 정보 포함 — 어느 provider 에서 어떤 코드/내용으로 실패했는지 드러내
        // 사용자가 화면 캡처 → 운영팀에게 전달하면 즉시 원인 파악 가능.
        const provider = errData.provider ? ` (${errData.provider})` : "";
        const upstream = errData.status ? ` ${errData.status}` : "";
        const detail = errData.detail ? `\n· 응답: ${String(errData.detail).slice(0, 200)}` : "";
        const baseMsg = errData.error || "요청 실패";
        throw new Error(`${baseMsg}${provider}${upstream}\n· HTTP ${resp.status}${detail}\n· 잠시 뒤 다시 시도해 주시고, 계속 그러면 코치님께 이 화면을 보내 주세요.`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        if (stale()) { void reader.cancel().catch(() => {}); return; }
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content && !stale()) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last.source === "ai" && !last.isError) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snapshot } : m));
                }
                return [...prev, { role: "assistant", source: "ai", content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // 스트림 정상 완료 시 질문→응답 캐시에 저장. 에러 경로는 저장하지 않음.
      if (assistantSoFar) {
        cacheRef.current.set(qKey, { answer: assistantSoFar, at: Date.now() });
        if (cacheRef.current.size > CACHE_MAX) {
          const oldestKey = cacheRef.current.keys().next().value;
          if (oldestKey !== undefined) cacheRef.current.delete(oldestKey);
        }
        if (trailing.length > 0) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            return last?.role === "assistant" && last.source === "ai" && !last.isError
              ? prev.map((m, i) => (i === prev.length - 1 ? { ...m, suggestions: trailing } : m))
              : prev;
          });
        }
      } else {
        throw new Error("AI 코치의 답이 비어서 왔어요. 다시 한 번 물어봐 주세요.");
      }
    } catch (e) {
      if (stale()) return; // 그사이 로그아웃·계정 전환 — 앞 계정의 오류를 새 대화에 띄우지 않는다
      // AI 가 막혀도 앱 안내는 보여 줄 수 있다 — 비슷한 항목이 있으면 칩으로
      const near = toSuggestions(matchOsamiFaq(text).candidates, undefined, 3);
      push({
        role: "assistant",
        isError: true,
        content: (e instanceof Error && e.message) || "오류가 발생했습니다. 다시 시도해주세요.",
        suggestions: near,
      });
    } finally {
      setIsLoading(false);
    }
  }, [push]);

  /** 회원 말 한 마디 처리 — 1단(즉답) → 2단(AI) */
  const handleQuestion = useCallback(async (raw: string, opts: { forceAi?: boolean } = {}) => {
    const text = raw.trim();
    if (!text || isLoading) return;
    const now = Date.now();
    if (now - lastSendAtRef.current < COOLDOWN_MS) return;
    lastSendAtRef.current = now;

    const userMsg: Msg = { role: "user", content: text };
    const history = messages;
    push(userMsg);
    setInput("");

    // 어디로 보낼지는 lib/osamiKb.ts planOsamiReply 가 정한다 (테스트로 고정된 판단)
    let trailing: Suggestion[] = [];
    if (!opts.forceAi) {
      const plan = planOsamiReply(text);
      if (plan.kind === "small") { push({ role: "assistant", source: "local", content: plan.reply }); return; }
      if (plan.kind === "faq") { showFaq(plan.best.entry.id, toSuggestions(plan.others, undefined, 2), text); return; }
      if (plan.kind === "suggest") {
        push({
          role: "assistant",
          source: "local",
          content: "이걸 물어보신 걸까요? 아래에서 골라 주세요. 아니면 AI 코치에게 그대로 물어볼 수도 있어요.",
          suggestions: toSuggestions(plan.candidates, undefined, 3),
          askAi: text,
        });
        return;
      }
      // 복싱·식단·마음가짐·모르는 질문 → AI. 관련 앱 안내는 답 아래 칩으로.
      trailing = toSuggestions(plan.related, undefined, 2);
    }

    // AI 코치는 로그인한 회원만 — 로그인 전에는 앱 안내(계정·로그인 도움말)로 안내한다
    if (!user) {
      push({
        role: "assistant",
        source: "local",
        content: "AI 코치의 자세한 답은 로그인한 회원에게 드려요 🥊 로그인·계정 문제라면 아래 안내를 눌러 보세요.",
        suggestions: trailing.length > 0 ? trailing : LOGIN_HELP,
      });
      return;
    }
    if (isApiLimitReached) {
      push({ role: "assistant", isError: true, content: "AI 코치가 잠시 숨 고르는 중이에요 💦 1분 뒤에 다시 물어봐 주세요. (앱 사용법은 지금도 바로 답해 드려요)", suggestions: trailing });
      return;
    }
    await askAi(text, [...history, userMsg], trailing);
  }, [askAi, isApiLimitReached, isLoading, messages, push, showFaq, user]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    void handleQuestion(input);
  };

  const goLink = (l: OsamiFaqLink) => {
    setOpen(false);
    if (l.href) window.location.assign(l.to);
    else navigate(l.to);
  };

  // 복싱 트레이닝은 풀스크린 터치 게임이라 플로팅 버튼이 펀치 입력에 겹쳐 오조작을 유발함.
  // QR 출석 화면은 카메라 뷰 위에 버튼이 겹치면 안 된다.
  // 메시지 대화방은 내 말풍선(오른쪽 아래)·입력창을 가린다 (2026-09-30).
  if (location.pathname === "/minigame" || location.pathname === "/qr-checkin" || location.pathname.startsWith("/messages/")) return null;

  return (
    <>
      {/* ── 플로팅 버튼 ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-50 group"
          aria-label="오삼 코치에게 물어보기"
        >
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-red-600 to-orange-500 shadow-[0_4px_20px_rgba(232,85,58,0.45)] transition-transform active:scale-90 group-hover:scale-105">
            <img src="/assets/mascot/osami_wink.png" alt="오삼 코치" className="h-12 w-12 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" draggable={false} />
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-red-600 shadow ring-2 ring-red-500">
              AI
            </span>
          </div>
        </button>
      )}

      {/* ── 챗봇 윈도우 ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[560px] sm:w-[400px] sm:rounded-3xl sm:shadow-[0_8px_40px_rgba(0,0,0,0.25)] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">

          {/* ── 헤더 ── */}
          {/* 아이폰: 휴대폰에서는 전체 화면이라 머리글(X)이 시계 밑에 깔리지 않게 상태바만큼 내린다 (2026-10-01) */}
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:pt-4">
            {/* 배경 워터마크 — 브랜드 "153" 을 연하게 배치. */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-2 right-4 text-5xl font-black tracking-tighter text-white">153</div>
              <div className="absolute bottom-0 left-3 text-3xl font-black tracking-tighter text-white">GYM</div>
            </div>

            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
                  <img src="/assets/mascot/osami_smile.png" alt="오삼 코치" className="h-10 w-10 object-contain" draggable={false} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-white text-[15px] tracking-tight">오삼 코치</h3>
                    <span className="flex items-center gap-0.5 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                      온라인
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium">앱 사용법은 바로 · 복싱·식단은 AI 코치가</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/70 backdrop-blur transition hover:bg-white/20 hover:text-white active:scale-90"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => { if (!isLoading) void handleQuestion(chip); }}
                  className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur transition hover:bg-white/20 hover:text-white active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* ── 대화 영역 ── */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 shadow-md">
                    <img src="/assets/mascot/osami_default.png" alt="오삼" className="h-7 w-7 object-contain" draggable={false} />
                  </div>
                )}

                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap shadow-elev-1 ${
                    m.role === "user"
                      ? "rounded-tr-md bg-gradient-to-br from-red-500 to-red-600 text-white"
                      : m.isError
                        ? "rounded-tl-md border border-red-200 bg-red-50 text-red-700"
                        : "rounded-tl-md border border-gray-100 bg-white text-gray-800"
                  }`}
                >
                  {m.isError && (
                    <div className="mb-1.5 flex items-center gap-1 text-red-500">
                      <AlertTriangle size={14} />
                      <span className="text-[11px] font-bold">연결 오류</span>
                    </div>
                  )}
                  {m.role === "assistant" && !m.isError && m.source === "faq" && (
                    <div className="mb-1 text-[10px] font-bold tracking-wide text-emerald-600">앱 안내</div>
                  )}
                  {m.role === "assistant" && !m.isError && m.source === "ai" && (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-bold tracking-wide text-orange-500"><Bot size={11} /> AI 코치</div>
                  )}
                  {m.source === "ai" ? stripMarkdown(m.content) : m.content}

                  {/* 앱 안 바로가기 */}
                  {m.links && m.links.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {m.links.map((l) => (
                        <button
                          key={l.to + l.label}
                          type="button"
                          onClick={() => goLink(l)}
                          className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-700 ring-1 ring-emerald-200 active:scale-95"
                        >
                          {l.label} <ChevronRight size={12} />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 후보 질문 칩 + AI 코치에게 넘기기 */}
                  {((m.suggestions && m.suggestions.length > 0) || m.askAi) && (
                    <div className="mt-2.5 border-t border-gray-100 pt-2">
                      {m.suggestions && m.suggestions.length > 0 && (
                        <>
                          <div className="mb-1 text-[10.5px] font-semibold text-gray-400">
                            {m.source === "faq" ? "다른 질문이었나요?" : m.source === "ai" ? "관련 앱 안내" : "혹시 이 질문?"}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {m.suggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                disabled={isLoading}
                                onClick={() => {
                                  push({ role: "user", content: s.q });
                                  showFaq(s.id);
                                }}
                                className="rounded-full bg-gray-100 px-3 py-1 text-[11.5px] font-semibold text-gray-700 ring-1 ring-gray-200 active:scale-95 disabled:opacity-40"
                              >
                                {s.q}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                      {m.askAi && user && (
                        <button
                          type="button"
                          disabled={isLoading || isApiLimitReached}
                          onClick={() => void handleQuestion(m.askAi!, { forceAi: true })}
                          className="mt-1.5 flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500 px-3 py-1 text-[11.5px] font-bold text-white shadow active:scale-95 disabled:opacity-40"
                        >
                          <Bot size={12} /> AI 코치에게 더 자세히 묻기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (messages[messages.length - 1]?.role !== "assistant" || messages[messages.length - 1]?.source !== "ai") && (
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 shadow-md">
                  <img src="/assets/mascot/osami_default.png" alt="오삼" className="h-7 w-7 object-contain" draggable={false} />
                </div>
                <div className="rounded-2xl rounded-tl-md border border-gray-100 bg-white px-4 py-3 shadow-elev-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-orange-400 animate-spin" style={{ animationDuration: "2s" }} />
                    <span className="text-[12px] text-gray-500 font-medium">AI 코치가 생각 중...</span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce" />
                    <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:100ms]" />
                    <span className="h-2 w-2 rounded-full bg-gray-300 animate-bounce [animation-delay:200ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* ── 입력 영역 ── */}
          <div className="border-t border-gray-100 bg-white p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:pb-3">
            {isApiLimitReached && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <span className="text-lg">💤</span>
                <p className="text-[11px] text-amber-700 font-medium">AI 코치가 잠시 쉬는 중이에요. 앱 사용법 질문은 지금도 바로 답해 드려요.</p>
              </div>
            )}
            <form onSubmit={send} className="flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 transition-colors focus-within:border-red-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-red-100">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="무엇이든 물어보세요..."
                  maxLength={500}
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 disabled:opacity-40"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-md transition-all hover:shadow-lg disabled:opacity-30 disabled:shadow-none active:scale-90"
                aria-label="보내기"
              >
                <Send size={18} />
              </button>
            </form>
            <p className="mt-1.5 text-center text-[10px] text-gray-300">Powered by 153 AI Coach</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
