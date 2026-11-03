/**
 * 💬 1:1 문의 — 지점 운영진에게 묻고 답장 받기 (2026-11-02 대표님 「둘 다 차례로」 · 153OS 33단계 앱 연결)
 *
 *   /inquiries          내 문의 목록 · '새 문의 남기기'
 *   /inquiries?new=1    새 문의(분류 · 제목 · 내용) — 하루 5건까지(153OS 가 막는다)
 *   /inquiries/:id      대화 — 운영진 답장은 일일경영리포트(153OS) '문의함'에서. 끝난 문의도 이어 쓰면 다시 열린다.
 * 문의는 153OS 에만 있다 — Edge Function os-app-content(op inquiries · inquiry · inquiry_new · inquiry_reply).
 * 회원끼리 1:1 메시지(/messages)와는 다르다 — 이건 지점 운영진 창구.
 */
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ChevronRight, MessageCircleQuestion, Send } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import { OsBackButton, OsChip, OsEmpty, OsErrorState, OsLoading } from "@/components/os/OsParts";
import { isNotRegistered, useCreateOsInquiry, useOsInquiries, useOsInquiry, useReplyOsInquiry } from "@/services/osContentService";
import {
  INQUIRY_BODY_MAX,
  INQUIRY_CATEGORIES,
  INQUIRY_TITLE_MAX,
  inquiryBadge,
  type InquiryCategory,
  type OsInquiryMessage,
} from "@/lib/osContent";
import { dmBubbleTime, dmDayLabel, dmListTime, kstDayKey } from "@/lib/dmTime";
import { cn } from "@/lib/utils";

// ── 목록 ───────────────────────────────────────────────────────
function InquiryList() {
  const navigate = useNavigate();
  const list = useOsInquiries();
  const rows = list.data ?? [];
  // 153OS 회원과 아직 안 이어진 계정은 문의를 남길 수 없다 — 단추 없이 안내만 (2026-11-03 검수)
  const notLinked = list.isError && isNotRegistered(list.error);
  return (
    <div className="space-y-4">
      {!notLinked && (
        <>
          <button
            type="button"
            onClick={() => navigate("/inquiries?new=1")}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-extrabold text-primary-foreground shadow-elev-1 active:scale-[0.98]"
          >
            <MessageCircleQuestion className="h-5 w-5" aria-hidden /> 새 문의 남기기
          </button>
          <p className="px-1 text-center text-label text-muted-foreground">지점 운영진이 확인하고 답장해요</p>
        </>
      )}
      {list.isLoading ? (
        <OsLoading label="문의 불러오는 중" />
      ) : list.isError ? (
        <OsErrorState error={list.error} onRetry={() => list.refetch()} what="문의" />
      ) : rows.length === 0 ? (
        <OsEmpty
          icon={<MessageCircleQuestion className="h-7 w-7 text-muted-foreground" />}
          title="남긴 문의가 없어요"
          line="이용권 · 수업 · 시설 · 환불 무엇이든 물어보세요"
        />
      ) : (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-elev-1" aria-label="내 문의">
          {rows.map((q) => {
            const b = inquiryBadge(q);
            return (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/inquiries/${q.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-secondary/70"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <OsChip>{q.category_label}</OsChip>
                      <span
                        className={cn(
                          "text-micro font-bold",
                          b.tone === "new" ? "text-primary" : b.tone === "wait" ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {b.tone === "new" && <span className="mr-1 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-hidden />}
                        {b.label}
                      </span>
                      <span className="ml-auto shrink-0 text-micro tabular-nums text-muted-foreground">{dmListTime(q.last_message_at)}</span>
                    </span>
                    <span className="mt-1 block truncate text-body font-bold text-foreground">{q.title}</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="열기" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── 새 문의 ────────────────────────────────────────────────────
function NewInquiry() {
  const navigate = useNavigate();
  const create = useCreateOsInquiry();
  const list = useOsInquiries();
  const [category, setCategory] = useState<InquiryCategory>("membership");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const ready = title.trim().length > 0 && body.trim().length > 0;
  // 주소로 바로 들어와도 — 153OS 회원과 안 이어진 계정이면 쓰기 칸 대신 안내 (2026-11-03 검수)
  if (list.isError && isNotRegistered(list.error)) return <OsErrorState error={list.error} onRetry={() => list.refetch()} what="문의" />;

  const submit = () => {
    if (!ready || create.isPending) return;
    create.mutate(
      { category, title: title.trim(), body: body.trim() },
      {
        onSuccess: (r) => {
          toast.success(r.message ?? "문의를 남겼어요");
          navigate(`/inquiries/${r.data.id}`, { replace: true });
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "잠시 뒤 다시 시도해 주세요"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 px-1 text-label font-bold text-muted-foreground">무엇에 대한 문의인가요?</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="문의 분류">
          {INQUIRY_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={category === c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "h-11 rounded-xl border text-label font-bold transition-colors",
                category === c.key ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={INQUIRY_TITLE_MAX}
        placeholder="제목"
        aria-label="제목"
        className="h-12 w-full rounded-2xl border border-border bg-card px-4 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
      />
      <div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          maxLength={INQUIRY_BODY_MAX}
          placeholder="궁금한 점을 자세히 적어 주세요"
          aria-label="내용"
          className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
        />
        <p className="mt-1 text-right text-micro tabular-nums text-muted-foreground">
          {body.length.toLocaleString("ko-KR")} / {INQUIRY_BODY_MAX.toLocaleString("ko-KR")}
        </p>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!ready || create.isPending}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-extrabold text-primary-foreground shadow-elev-1 active:scale-[0.98] disabled:opacity-50"
      >
        <Send className="h-5 w-5" aria-hidden />
        {create.isPending ? "보내는 중…" : "문의 보내기"}
      </button>
      <p className="px-1 text-center text-label text-muted-foreground">답장이 오면 이 화면에서 볼 수 있어요</p>
    </div>
  );
}

// ── 대화 ───────────────────────────────────────────────────────
function Bubble({ m }: { m: OsInquiryMessage }) {
  const mine = m.sender === "member";
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      {!mine && <span className="mb-1 px-1 text-label font-bold text-muted-foreground">지점 운영진</span>}
      <div className={cn("flex max-w-[86%] items-end gap-1.5", mine && "flex-row-reverse")}>
        <p
          className={cn(
            "whitespace-pre-line break-words rounded-2xl px-4 py-2.5 text-body leading-relaxed",
            mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card text-foreground shadow-elev-1",
          )}
        >
          {m.body}
        </p>
        <span className="shrink-0 pb-0.5 text-micro tabular-nums text-muted-foreground">{dmBubbleTime(m.created_at)}</span>
      </div>
    </div>
  );
}

function InquiryThread({ id }: { id: string }) {
  const q = useOsInquiry(id);
  const reply = useReplyOsInquiry(id);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const count = q.data?.messages.length ?? 0;

  useEffect(() => {
    if (count) endRef.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const send = () => {
    const body = text.trim();
    if (!body || reply.isPending) return;
    reply.mutate(body, {
      onSuccess: () => setText(""),
      onError: (e) => toast.error(e instanceof Error ? e.message : "잠시 뒤 다시 시도해 주세요"),
    });
  };

  const inq = q.data?.inquiry;
  const msgs = q.data?.messages ?? [];

  return (
    <div className="flex flex-col bg-background" style={{ height: "calc(100dvh - env(safe-area-inset-top, 0px))" }}>
      <PageHeader
        title={inq?.title ?? "문의"}
        subtitle={inq ? `${inq.category_label} · ${inquiryBadge({ ...inq, unread_by_member: false }).label}` : undefined}
        leftAction={<OsBackButton fallback="/inquiries" />}
        className="shrink-0"
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-lg space-y-3 px-4 py-4">
          {q.isLoading ? (
            <OsLoading rows={2} label="대화 불러오는 중" />
          ) : q.isError ? (
            <OsErrorState error={q.error} onRetry={() => q.refetch()} what="문의" />
          ) : (
            msgs.map((m, i) => {
              const day = kstDayKey(m.created_at);
              const newDay = i === 0 || kstDayKey(msgs[i - 1].created_at) !== day;
              return (
                <div key={m.id}>
                  {newDay && (
                    <p className="my-3 text-center">
                      <span className="rounded-full bg-secondary px-3 py-1 text-micro font-semibold text-muted-foreground">{dmDayLabel(m.created_at)}</span>
                    </p>
                  )}
                  <Bubble m={m} />
                </div>
              );
            })
          )}
          {inq?.status === "open" && msgs.length > 0 && msgs[msgs.length - 1].sender === "member" && (
            <p className="pt-1 text-center text-label text-muted-foreground">지점 운영진이 확인하고 답장할게요</p>
          )}
          {inq?.status === "closed" && (
            <p className="pt-1 text-center text-label text-muted-foreground">끝난 문의예요 — 이어서 적으면 다시 열려요</p>
          )}
          <div ref={endRef} />
        </div>
      </div>
      {!q.isError && (
        <div className="shrink-0 border-t-[0.5px] border-black/[0.1] bg-card/95 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur dark:border-white/[0.08]">
          <div className="mx-auto flex max-w-lg items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={1}
              maxLength={INQUIRY_BODY_MAX}
              placeholder="이어서 적기"
              aria-label="이어서 적기"
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || reply.isPending}
              aria-label="보내기"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95 disabled:opacity-40"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 화면 ───────────────────────────────────────────────────────
const InquiriesPage = () => {
  const { id } = useParams<{ id?: string }>();
  const [params] = useSearchParams();
  if (id) return <InquiryThread id={id} />;
  const isNew = params.get("new") === "1";
  return (
    <AppPage
      header={
        <PageHeader
          title={isNew ? "새 문의" : "1:1 문의"}
          sticky
          leftAction={<OsBackButton fallback={isNew ? "/inquiries" : "/home"} />}
        />
      }
    >
      {isNew ? <NewInquiry /> : <InquiryList />}
    </AppPage>
  );
};

export default InquiriesPage;
