import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, AlertTriangle } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; isError?: boolean };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-assistant`;

const WELCOME_MSG: Msg = {
  role: "assistant",
  content: "안녕하세요! 153복싱짐 AI 코치입니다. 오늘 어떤 퀘스트나 동작이 궁금하신가요? 🥊",
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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [...messages, userMsg].filter((m) => m !== WELCOME_MSG).map(({ role, content }) => ({ role, content })) }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        if (resp.status === 429 || resp.status === 402) {
          setIsApiLimitReached(true);
          throw new Error("현재 AI 코치봇이 스파링을 마치고 휴식 중입니다 💦 급한 질문은 관장님께 직접 문의해 주세요!");
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
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              const snapshot = assistantSoFar;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && last !== WELCOME_MSG) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: snapshot } : m));
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
        { role: "assistant", content: e.message || "오류가 발생했습니다. 다시 시도해주세요.", isError: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 플로팅 버튼 */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-black shadow-2xl transition-transform hover:scale-105 active:scale-95"
        >
          <MessageCircle className="h-7 w-7 text-white" />
        </button>
      )}

      {/* 챗봇 윈도우 */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white sm:inset-auto sm:bottom-24 sm:right-4 sm:h-[500px] sm:w-[400px] sm:rounded-2xl sm:border sm:border-gray-100 sm:shadow-2xl sm:overflow-hidden animate-in slide-in-from-bottom-5">
          
          {/* 헤더 */}
          <div className="bg-black text-white p-4 flex justify-between items-center shadow-sm sm:rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <Bot size={24} className="text-red-500" />
              <div>
                <h3 className="font-bold text-sm">AI 코치봇</h3>
                <p className="text-xs text-gray-300">153 랭크업 시스템</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-white transition-colors active:scale-95">
              <X size={20} />
            </button>
          </div>

          {/* 대화창 */}
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center mr-2 shrink-0">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-red-500 text-white rounded-tr-none"
                      : m.isError
                        ? "bg-red-50 border border-red-200 text-red-700 rounded-tl-none"
                        : "bg-white border border-gray-200 text-gray-800 rounded-tl-none shadow-sm"
                  }`}
                >
                  {m.isError && <AlertTriangle size={16} className="inline mr-1 mb-1 text-red-500" />}
                  {m.content}
                </div>
              </div>
            ))}

            {/* 타이핑 인디케이터 */}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex justify-start items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mr-2">
                  <Bot size={16} className="text-gray-500" />
                </div>
                <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none flex space-x-1 shadow-sm">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:75ms]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력창 */}
          <form onSubmit={send} className="p-3 bg-white border-t border-gray-100">
            <div className="flex items-center bg-gray-100 rounded-full px-4 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isApiLimitReached ? "코치봇이 휴식 중입니다." : "복싱 동작에 대해 물어보세요..."}
                disabled={isLoading || isApiLimitReached}
                className="flex-1 bg-transparent outline-none text-sm disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || isApiLimitReached}
                className="ml-2 text-red-500 disabled:text-gray-400 transition-colors"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default ChatAssistant;
