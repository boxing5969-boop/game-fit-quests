/**
 * 🥊 오삼코치 오늘 메시지 검수 — 지점장 화면 위쪽 (2026-10-15 대표님 결정: 파일럿 + 2주는 코치가 보고 승인한 것만 나간다).
 *
 *   · 오늘 초안이 있을 때만 보인다 (수강권 신청 인박스처럼 비어 있으면 숨김).
 *   · 본사(super_admin·admin)는 전체 지점, 지점장·코치는 자기 지점만 — 서버 coach_review_list 가 범위를 정한다.
 *   · 승인 · 고쳐서 승인 · 기본 문구로 · 건너뛰기 · 승인 취소 → coach_review_set. '모두 승인'은 두 번 눌러야 된다.
 *   · 승인된 오늘의 목표는 5분 안에(아침 8시 전이면 8시에) 알림함·휴대폰으로, 출석 칭찬은 그 회원이 출석할 때 출석 알림으로 간다.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Pencil, RotateCcw, SkipForward } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  kind: "daily_goal" | "attendance_praise" | "comeback";
  status: "generating" | "ready" | "approved" | "sent";
  source: "ai" | "fallback" | "edited";
  check_reason: string | null;
  title: string;
  body: string;
  detail: string;
  fallback: { title?: string; body?: string; detail?: string } | null;
  state: string | null;
  level_label: string | null;
  drill: string | null;
  member: string;
  member_name: string | null;
  branch: string | null;
  send_at: string | null;
  sent_at: string | null;
};

type ReviewList = { for_date: string; enabled: boolean; review_required: boolean; items: Item[] };

const KEY = "coach-review";
const LIMITS = { title: 20, body: 60, detail: 90 } as const;
const SHOW = 4;

// 새 함수들은 types.ts 재생성 전 — 기존 파일들과 같은 캐스트 패턴
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown> = {}) => (supabase.rpc as any)(name, args);

const KIND: Record<Item["kind"], string> = {
  daily_goal: "오늘의 목표",
  attendance_praise: "출석 칭찬",
  comeback: "복귀 응원",
};
const STATE: Record<string, string> = {
  new: "신규",
  steady: "꾸준",
  near_levelup: "레벨업 임박",
  title_match: "타이틀매치 앞",
  slump: "주춤",
  low_condition: "컨디션 낮음",
};
/** AI 문구를 쓰지 않은 이유 — 사람이 읽는 말로 (키가 없어 기본 문구인 경우는 보이지 않는다) */
const reasonText = (r: string | null): string | null => {
  if (!r || r === "no_ai") return null;
  if (r.startsWith("number_")) return "입력에 없는 숫자를 써서";
  const m: Record<string, string> = {
    banned_body: "체중·외모 이야기를 꺼내서",
    banned_sales: "결제·재등록 권유가 있어서",
    banned_terms: "쓰지 않는 말이 있어서",
    banned_blame: "결석을 탓하는 말이 있어서",
    banned_markup: "기호가 섞여서",
    title_long: "제목이 길어서",
    body_long: "본문이 길어서",
    detail_long: "앱 문장이 길어서",
    detail_sentences: "앱 문장이 길어서",
    emoji: "이모지가 많아서",
    foreign: "영어·한자가 섞여서",
    parse: "형식이 맞지 않아서",
    empty: "빈 문장이라서",
    refusal: "AI가 답하지 않아서",
  };
  return m[r] ?? "AI 응답을 받지 못해서";
};
const chars = (s: string) => Array.from(s).length;

const statusLine = (it: Item): string => {
  if (it.status === "sent") return "보냈어요";
  if (it.status === "generating") return "AI 문구 만드는 중";
  if (it.status === "approved") {
    if (it.kind === "attendance_praise") return "승인됨 · 출석하면 출석 알림으로 가요";
    const due = it.send_at ? Date.parse(it.send_at) : 0;
    return due > Date.now() ? "승인됨 · 아침 8시에 가요" : "승인됨 · 5분 안에 가요";
  }
  return "검수 대기";
};

const CoachDraftsInbox = () => {
  const { user, role } = useAuth();
  const canReview = !!user && isManagerRole(role);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; title: string; body: string; detail: string } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);

  const q = useQuery({
    queryKey: [KEY, user?.id],
    enabled: canReview,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<ReviewList | null> => {
      const { data, error } = await rpc("coach_review_list");
      if (error) return null; // 권한 없음(지점 없는 계정 등) → 카드 숨김
      const d = data as ReviewList | null;
      return d && Array.isArray(d.items) ? d : null;
    },
  });

  // '모두 승인' 두 번 누르기 — 3초 안에 다시 누르지 않으면 풀린다
  useEffect(() => {
    if (!confirmAll) return;
    const t = setTimeout(() => setConfirmAll(false), 3000);
    return () => clearTimeout(t);
  }, [confirmAll]);

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const counts = useMemo(() => {
    const c = { ready: 0, approved: 0, sent: 0, generating: 0 };
    for (const it of items) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  if (!canReview || items.length === 0) return null;

  const refresh = () => qc.invalidateQueries({ queryKey: [KEY] });

  const act = async (it: Item, action: "approve" | "unapprove" | "skip" | "fallback") => {
    setBusy(it.id);
    try {
      const { data, error } = await rpc("coach_review_set", { _id: it.id, _action: action });
      if (error) throw error;
      const r = data as { ok?: boolean; reason?: string } | null;
      if (!r?.ok) {
        toast.error(r?.reason === "locked" ? "이미 보냈거나 지난 메시지예요" : "처리하지 못했어요");
      } else if (action === "skip") {
        toast("이 메시지는 보내지 않아요");
      } else if (action === "unapprove") {
        toast("승인을 취소했어요");
      }
    } catch (e) {
      toast.error("처리하지 못했어요: " + ((e as Error)?.message || ""));
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const saveEdit = async () => {
    if (!edit) return;
    const { id, title, body, detail } = edit;
    if (!title.trim() || !body.trim() || !detail.trim()) {
      toast.error("제목·본문·앱 문장을 모두 채워 주세요");
      return;
    }
    if (chars(title.trim()) > LIMITS.title || chars(body.trim()) > LIMITS.body || chars(detail.trim()) > LIMITS.detail) {
      toast.error(`길이를 줄여 주세요 (제목 ${LIMITS.title} · 본문 ${LIMITS.body} · 앱 문장 ${LIMITS.detail}자)`);
      return;
    }
    setBusy(id);
    try {
      const { data, error } = await rpc("coach_review_set", { _id: id, _action: "edit", _title: title, _body: body, _detail: detail });
      if (error) throw error;
      const r = data as { ok?: boolean; reason?: string } | null;
      if (!r?.ok) {
        toast.error(r?.reason === "locked" ? "이미 보냈거나 지난 메시지예요" : "저장하지 못했어요");
      } else {
        toast.success("고쳐서 승인했어요");
        setEdit(null);
      }
    } catch (e) {
      toast.error("저장하지 못했어요: " + ((e as Error)?.message || ""));
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const approveAll = async () => {
    if (!confirmAll) {
      setConfirmAll(true);
      return;
    }
    setConfirmAll(false);
    setBusy("all");
    try {
      const { data, error } = await rpc("coach_review_approve_all");
      if (error) throw error;
      toast.success(`${Number(data) || 0}건 승인했어요`);
    } catch (e) {
      toast.error("승인하지 못했어요: " + ((e as Error)?.message || ""));
    } finally {
      setBusy(null);
      void refresh();
    }
  };

  const shown = open ? items : items.slice(0, SHOW);

  return (
    <section aria-label="오삼코치 오늘 메시지 검수" className="mb-5 rounded-2xl border border-primary/25 bg-primary/[0.04] p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-foreground">🥊 오삼코치 오늘 메시지</h3>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          대기 {counts.ready} · 승인 {counts.approved} · 보냄 {counts.sent}
        </span>
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
        승인한 것만 회원에게 가요. 오늘의 목표는 아침 8시(지났으면 5분 안에), 출석 칭찬은 그 회원이 출석할 때 출석 알림으로 가요.
        {!q.data?.enabled && " 지금은 오삼코치가 꺼져 있어요."}
      </p>

      {counts.ready > 1 && (
        <button
          type="button"
          onClick={approveAll}
          disabled={!!busy}
          className={cn(
            "mb-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-bold transition-transform active:scale-[0.98] disabled:opacity-60",
            confirmAll ? "bg-status-pending text-white" : "bg-primary text-primary-foreground",
          )}
        >
          <Check className="h-4 w-4" />
          {busy === "all" ? "승인하는 중…" : confirmAll ? `한 번 더 누르면 ${counts.ready}건 모두 승인` : `대기 ${counts.ready}건 모두 승인`}
        </button>
      )}

      <div className="space-y-2">
        {shown.map((it) => {
          const editing = edit?.id === it.id;
          const reason = it.source === "fallback" ? reasonText(it.check_reason) : null;
          const canAct = it.status === "ready" || it.status === "approved";
          return (
            <div key={it.id} className={cn("rounded-xl border bg-card p-3", it.status === "ready" ? "border-border" : "border-border/60 opacity-90")}>
              <div className="mb-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px]">
                <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-foreground">{KIND[it.kind] ?? it.kind}</span>
                <span className="font-semibold text-foreground">{it.member}</span>
                {it.member_name && it.member_name !== it.member && <span className="text-muted-foreground">({it.member_name})</span>}
                {it.level_label && <span className="text-muted-foreground">{it.level_label}</span>}
                {it.state && STATE[it.state] && <span className="text-muted-foreground">· {STATE[it.state]}</span>}
                <span
                  className={cn(
                    "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                    it.source === "ai" ? "bg-primary/15 text-primary" : it.source === "edited" ? "bg-accent/20 text-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {it.source === "ai" ? "AI" : it.source === "edited" ? "수정함" : "기본 문구"}
                </span>
              </div>

              {editing ? (
                <div className="space-y-1.5">
                  {(["title", "body", "detail"] as const).map((f) => (
                    <label key={f} className="block">
                      <span className="flex justify-between text-[10.5px] text-muted-foreground">
                        <span>{f === "title" ? "알림 제목" : f === "body" ? "알림 본문" : "앱 문장 (내 카드)"}</span>
                        <span className={cn(chars(edit[f]) > LIMITS[f] && "font-bold text-destructive")}>
                          {chars(edit[f])}/{LIMITS[f]}
                        </span>
                      </span>
                      <textarea
                        value={edit[f]}
                        rows={f === "title" ? 1 : 2}
                        onChange={(e) => setEdit({ ...edit, [f]: e.target.value })}
                        className="mt-0.5 w-full resize-none rounded-lg border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground outline-none focus:border-primary"
                      />
                    </label>
                  ))}
                  <div className="flex gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={busy === it.id}
                      className="flex h-9 flex-1 items-center justify-center rounded-lg bg-primary text-[12.5px] font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
                    >
                      {busy === it.id ? "저장하는 중…" : "고쳐서 승인"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEdit(null)}
                      className="h-9 rounded-lg border border-border px-3 text-[12.5px] font-semibold text-muted-foreground active:bg-secondary"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-[13.5px] font-bold leading-snug text-foreground">{it.title}</p>
                  <p className="text-[13px] leading-snug text-foreground">{it.body}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{it.detail}</p>
                  {reason && <p className="mt-1 text-[11px] text-status-pending">AI 문구는 {reason} 기본 문구로 바꿨어요</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="mr-auto text-[11px] font-semibold text-muted-foreground">{statusLine(it)}</span>
                    {it.status === "ready" && (
                      <button
                        type="button"
                        onClick={() => act(it, "approve")}
                        disabled={!!busy}
                        className="flex h-8 items-center gap-1 rounded-lg bg-primary px-2.5 text-[12px] font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" /> 승인
                      </button>
                    )}
                    {canAct && (
                      <button
                        type="button"
                        onClick={() => setEdit({ id: it.id, title: it.title, body: it.body, detail: it.detail })}
                        disabled={!!busy}
                        className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-foreground active:bg-secondary disabled:opacity-60"
                      >
                        <Pencil className="h-3.5 w-3.5" /> 고치기
                      </button>
                    )}
                    {canAct && it.source !== "fallback" && it.fallback?.body && (
                      <button
                        type="button"
                        onClick={() => act(it, "fallback")}
                        disabled={!!busy}
                        className="flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] font-semibold text-foreground active:bg-secondary disabled:opacity-60"
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> 기본 문구로
                      </button>
                    )}
                    {it.status === "approved" && (
                      <button
                        type="button"
                        onClick={() => act(it, "unapprove")}
                        disabled={!!busy}
                        className="h-8 rounded-lg px-2 text-[12px] font-semibold text-muted-foreground active:bg-secondary disabled:opacity-60"
                      >
                        승인 취소
                      </button>
                    )}
                    {canAct && (
                      <button
                        type="button"
                        onClick={() => act(it, "skip")}
                        disabled={!!busy}
                        className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-muted-foreground active:bg-secondary disabled:opacity-60"
                      >
                        <SkipForward className="h-3.5 w-3.5" /> 안 보내기
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {items.length > SHOW && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 flex h-9 w-full items-center justify-center gap-1 rounded-lg text-[12.5px] font-semibold text-muted-foreground active:bg-secondary"
        >
          {open ? (
            <>
              접기 <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              {items.length - SHOW}건 더 보기 <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </section>
  );
};

export default CoachDraftsInbox;
