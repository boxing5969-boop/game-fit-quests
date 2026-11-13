/**
 * 153운영본부 · 「일정」 — 검색 · 휴지통 · 아침 브리핑 · 끈 반복 일정 범위 묻기 · 캘린더 3-2단계 (2026-11-13 대표님 「3-2 시작」)
 *   · 검색(제목 · 메모 · 장소) — 내 일정 + 대표님 · 지점장님은 그 지점 팀의 공개 일정. 누르면 그 일정의 다음 날로.
 *   · 휴지통 — 지운 지 30일 안 · 되살리기(같이 지운 묶음 함께)
 *   · 아침 8시 브리핑 — 그날 수업 · PT · 약속한 회원이 있을 때만 한 통(대표님 결정 6) · 사람마다 끄기
 *   · 반복 일정을 끌어 옮기면 '이 일정만 / 이후 모두'
 *   3-2 함수가 없는 DB 면 검색 · 휴지통 · 브리핑 줄을 숨긴다(available=false).
 */
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { nextOccurrence } from "@/lib/opsRecur";
import { PLAN_KIND_META, agoLabel, ddayLabel, isRepeat, planDay, planWhenLabel, timeLabel, type OpsPlan, type PlanMember } from "@/lib/opsPlans";
import { useOpsPlanPrefs, useOpsPlanRestore, useOpsPlanSearch, useOpsPlanTrash } from "@/services/opsPlanService";
import { OpsButton, OpsSheet, opsInput } from "./OpsParts";

// ───────────────────────── 검색 ─────────────────────────
/** 검색 줄 맨 아래 — 반복은 '다음 ○월 ○일', 한 번 하는 일정은 날짜가 위에 있으니 '오늘' · 'D-3' 만 */
const nextLabel = (p: OpsPlan, next: string | null, today: string): string => {
  if (!next) return "지난 일정";
  if (isRepeat(p)) return `다음 ${planDay(next)}`;
  return next <= today ? "오늘" : (ddayLabel(next, today) ?? "");
};

export const PlanSearchSheet = ({
  open,
  branch,
  manage,
  members,
  today,
  onClose,
  onGo,
}: {
  open: boolean;
  branch: string;
  manage: boolean;
  members: PlanMember[];
  today: string;
  onClose: () => void;
  onGo: (date: string, plan: OpsPlan) => void;
}) => {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setQ(text.trim()), 300);
    return () => window.clearTimeout(t);
  }, [text]);
  useEffect(() => {
    if (!open) {
      setText("");
      setQ("");
    }
  }, [open]);
  const res = useOpsPlanSearch(q, manage ? branch : null, open);
  const rows = res.data?.rows ?? [];
  const nameOf = (uid: string) => members.find((m) => m.user_id === uid)?.name ?? "팀원";

  return (
    <OpsSheet open={open} onClose={onClose} title="일정 찾기" sub={manage ? "내 일정 + 팀 공개 일정 · 제목 · 메모 · 장소" : "내 일정 · 제목 · 메모 · 장소"}>
      <label className="relative mt-1 block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 40))}
          placeholder="예) PT · 상담 · 2층"
          className={cn(opsInput, "pl-9")}
          aria-label="찾을 말"
          autoFocus
        />
      </label>
      {q && res.isLoading && <p className="mt-4 text-label text-muted-foreground">찾는 중…</p>}
      {q && res.data && rows.length === 0 && <p className="mt-4 text-body text-muted-foreground">맞는 일정이 없어요</p>}
      {res.error && <p className="mt-4 text-label text-muted-foreground">{(res.error as Error).message}</p>}
      {rows.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((p) => {
            const next = nextOccurrence(p, today);
            const go = next ?? p.start_on;
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onGo(go, p)} className="flex w-full items-start gap-2 py-3 text-left active:bg-secondary/60">
                  <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", PLAN_KIND_META[p.kind].chip)}>{PLAN_KIND_META[p.kind].label}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-foreground">{p.masked ? "개인 일정" : p.title || PLAN_KIND_META[p.kind].label}</span>
                    <span className="block truncate text-label text-muted-foreground">
                      {[!p.mine ? nameOf(p.user_id) : null, planWhenLabel(p), timeLabel(p.all_day, p.start_time, p.end_time), p.location].filter(Boolean).join(" · ")}
                    </span>
                    <span className="block text-label font-bold text-foreground">{nextLabel(p, next, today)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 휴지통 ─────────────────────────
export const PlanTrashSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const trash = useOpsPlanTrash(open);
  const restore = useOpsPlanRestore();
  const rows = trash.data?.rows ?? [];
  return (
    <OpsSheet open={open} onClose={onClose} title="휴지통" sub="지운 일정은 30일 동안 여기 있어요">
      {trash.isLoading && <p className="mt-2 text-label text-muted-foreground">불러오는 중…</p>}
      {trash.data && rows.length === 0 && <p className="mt-2 text-body text-muted-foreground">휴지통이 비어 있어요</p>}
      {rows.length > 0 && (
        <ul className="mt-1 divide-y divide-border">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-3">
              <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", PLAN_KIND_META[p.kind].chip)}>{PLAN_KIND_META[p.kind].label}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-bold text-foreground">{p.title || PLAN_KIND_META[p.kind].label}</span>
                <span className="block truncate text-label text-muted-foreground">
                  {planWhenLabel(p)} · {agoLabel(p.deleted_at)} 지움
                </span>
              </span>
              <button
                type="button"
                disabled={restore.isPending}
                onClick={() =>
                  restore.mutate(p.id, {
                    onSuccess: (n) => toast.success(n > 1 ? `일정 ${n}개를 되살렸어요` : "일정을 되살렸어요"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                className="h-9 shrink-0 rounded-full bg-secondary px-3 text-label font-bold text-foreground active:scale-95 disabled:opacity-50"
              >
                되살리기
              </button>
            </li>
          ))}
        </ul>
      )}
    </OpsSheet>
  );
};

// ───────────────────────── 아래 한 줄 — 휴지통 · 아침 브리핑 ─────────────────────────
export const PlanToolsRow = ({ briefOn, onTrash }: { briefOn: boolean; onTrash: () => void }) => {
  const prefs = useOpsPlanPrefs();
  return (
    <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
      <button type="button" onClick={onTrash} className="h-9 rounded-full px-2 text-label font-bold text-muted-foreground active:scale-95">
        휴지통
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={briefOn}
        disabled={prefs.isPending}
        onClick={() =>
          prefs.mutate(!briefOn, {
            onSuccess: () => toast.success(briefOn ? "아침 브리핑을 껐어요" : "아침 8시에 그날 일정을 알려 드릴게요"),
            onError: (e) => toast.error((e as Error).message),
          })
        }
        className="flex h-9 items-center gap-2 rounded-full px-2 text-label font-bold text-foreground active:scale-95 disabled:opacity-50"
      >
        아침 8시 브리핑
        <span className={cn("relative h-6 w-10 rounded-full transition-colors", briefOn ? "bg-primary" : "bg-muted-foreground/30")} aria-hidden>
          <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all", briefOn ? "left-[1.125rem]" : "left-0.5")} />
        </span>
      </button>
    </div>
  );
};

// ───────────────────────── 끈 반복 일정 — 이 일정만 / 이후 모두 ─────────────────────────
export const PlanScopeAsk = ({
  open,
  resize,
  from,
  to,
  following,
  busy,
  onPick,
  onClose,
}: {
  open: boolean;
  /** 아래 끝을 끌어 늘린 것 */
  resize: boolean;
  /** "11월 17일 (화) 19:00~20:00" → "11월 18일 (수) 19:30~20:30" */
  from: string;
  to: string;
  /** 「이후 모두」면 될 반복 — "매주 수 · 목 · 19:30~20:30" */
  following: string | null;
  busy: boolean;
  onPick: (scope: "one" | "following") => void;
  onClose: () => void;
}) => (
  <OpsSheet open={open} onClose={onClose} title={resize ? "반복 일정 시간 바꾸기" : "반복 일정 옮기기"}>
    <div className="mt-1 rounded-2xl bg-secondary/70 px-4 py-3">
      <p className="text-label text-muted-foreground line-through">{from}</p>
      <p className="mt-0.5 text-body font-black text-foreground">→ {to}</p>
    </div>
    <div className="mt-3 space-y-2">
      <OpsButton onClick={() => onPick("one")} disabled={busy}>
        이 일정만
      </OpsButton>
      <OpsButton tone="plain" onClick={() => onPick("following")} disabled={busy}>
        이후 모두
      </OpsButton>
      {following && <p className="px-1 text-label text-muted-foreground">이후 모두 → {following}</p>}
    </div>
  </OpsSheet>
);
