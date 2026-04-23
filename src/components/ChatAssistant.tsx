import { useState, useRef, useEffect } from "react";
import { X, Send, AlertTriangle, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string; isError?: boolean };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`;

const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "안녕하세요! 🥊 153복싱짐 AI 코치입니다.\n\n퀘스트, 리그 시스템, 동작 요령 등 궁금한 점을 자유롭게 물어보세요!",
};

const ChatAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLimitReached, setIsApiLimitReached] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, isLoading]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading || isApiLimitReached) return;

    const userMsg: Msg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    try {
      // Get current session token for personalized context
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          // 에러 토스트(isError=true)는 모델 응답이 아닌 UI 알림이라
          // LLM 이 "이전 대화의 자기 발언" 으로 오해하지 않도록 history 전송 시 제외.
          messages: [...messages, userMsg]
            .filter((m) => m !== WELCOME_MSG && !m.isError)
            .map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429 || resp.status === 402) {
          setIsApiLimitReached(true);
          throw new Error(
            "코치봇이 스파링을 마치고 휴식 중입니다 💦\n급한 질문은 관장님께 직접 문의해 주세요!"
          );
        }
        throw new Error(errData.error || "요청 실패");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
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
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last !== WELCOME_MSG) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: snapshot } : m
                  );
                }
                return [...prev, { role: "assistant", content: snapshot }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: e.message || "오류가 발생했습니다. 다시 시도해주세요.",
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* ── 플로팅 버튼 ── */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-50 group"
        >
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-red-600 to-orange-500 shadow-[0_4px_20px_rgba(232,85,58,0.45)] transition-transform active:scale-90 group-hover:scale-105">
            <span className="text-2xl">🥊</span>
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-black text-red-600 shadow ring-2 ring-red-500">
              AI
            </span>
          </div>
        </button>
      )}

      {/* ── 챗봇 윈도우 ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[540px] sm:w-[400px] sm:rounded-3xl sm:shadow-[0_8px_40px_rgba(0,0,0,0.25)] overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          
          {/* ── 헤더 ── */}
          <div className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black px-5 py-4">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 right-8 text-6xl">🥊</div>
              <div className="absolute bottom-1 left-4 text-4xl rotate-12">💪</div>
            </div>
            
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg">
                  <span className="text-xl">🥊</span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-white text-[15px] tracking-tight">AI 코치봇</h3>
                    <span className="flex items-center gap-0.5 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                      온라인
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium">153 랭크업 시스템 · 맞춤 코칭</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/70 backdrop-blur transition hover:bg-white/20 hover:text-white active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {["다음 레벨업 방법", "내 반려 이력", "오늘의 퀘스트", "타이틀매치 준비"].map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    if (!isLoading && !isApiLimitReached) {
                      setInput(chip);
                    }
                  }}
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
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {m.role === "assistant" && (
                  <div className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 shadow-md">
                    <span className="text-sm">🥊</span>
                  </div>
                )}

                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed whitespace-pre-wrap shadow-elev-1 ${
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
                  {m.content}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-start gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 shadow-md">
                  <span className="text-sm">🥊</span>
                </div>
                <div className="rounded-2xl rounded-tl-md border border-gray-100 bg-white px-4 py-3 shadow-elev-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-orange-400 animate-spin" style={{ animationDuration: "2s" }} />
                    <span className="text-[12px] text-gray-500 font-medium">코치가 분석 중...</span>
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
          <div className="border-t border-gray-100 bg-white p-3">
            {isApiLimitReached && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <span className="text-lg">💤</span>
                <p className="text-[11px] text-amber-700 font-medium">코치봇이 휴식 중입니다. 관장님께 직접 문의해주세요.</p>
              </div>
            )}
            <form onSubmit={send} className="flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 transition-colors focus-within:border-red-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-red-100">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isApiLimitReached ? "코치봇 휴식 중..." : "무엇이든 물어보세요..."}
                  disabled={isLoading || isApiLimitReached}
                  className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 disabled:opacity-40"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading || isApiLimitReached}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-md transition-all hover:shadow-lg disabled:opacity-30 disabled:shadow-none active:scale-90"
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
