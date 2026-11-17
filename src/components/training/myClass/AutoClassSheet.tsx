/**
 * 🪄 내 수업 자동으로 짜기 — 시간(15 · 30 · 50분) · 목표(기본기 · 기술 · 방어 · 체력) → 미리 보기 → 저장 (2026-11-16 5단계)
 *   계산은 lib/autoClass(규칙 · AI 비용 0). 저장하면 내 수업 편집 창이 열려 이름 · 순서 · 분을 고친다.
 *   고른 시간 · 목표는 이 기기에 기억(153learn:auto) — 다음에 열면 같은 자리.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { DmSheet } from "@/components/dm/DmParts";
import {
  AUTO_GOALS,
  AUTO_MINUTES,
  DEFAULT_AUTO_GOAL,
  DEFAULT_AUTO_MINUTES,
  autoClass,
  type AutoCandidate,
  type AutoGoal,
  type AutoMinutes,
} from "@/lib/autoClass";
import { MAX_CLASSES, itemAmountText, type ClassItem } from "@/lib/myClass";
import { SHELF_INFO } from "@/lib/trainingCards";
import { cn } from "@/lib/utils";

const PICK_KEY = "153learn:auto";

function readPick(): { minutes: AutoMinutes; goal: AutoGoal } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PICK_KEY) ?? "{}") as { minutes?: number; goal?: string };
    const minutes = (AUTO_MINUTES as readonly number[]).includes(raw.minutes ?? 0) ? (raw.minutes as AutoMinutes) : DEFAULT_AUTO_MINUTES;
    const goal = AUTO_GOALS.some((g) => g.id === raw.goal) ? (raw.goal as AutoGoal) : DEFAULT_AUTO_GOAL;
    return { minutes, goal };
  } catch {
    return { minutes: DEFAULT_AUTO_MINUTES, goal: DEFAULT_AUTO_GOAL };
  }
}
function writePick(v: { minutes: AutoMinutes; goal: AutoGoal }) {
  try {
    window.localStorage.setItem(PICK_KEY, JSON.stringify(v));
  } catch {
    /* 무시 */
  }
}

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={cn(
      "flex h-11 flex-1 items-center justify-center rounded-full border px-3 text-body font-bold transition-transform active:scale-95",
      on ? "border-transparent bg-foreground text-background" : "border-border bg-card text-foreground",
    )}
  >
    {children}
  </button>
);

export default function AutoClassSheet({
  open,
  onClose,
  pool,
  myLevel,
  classCount,
  busy,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** 회원님께 보이는 카드 · 레벨 미션 영상 (화면이 골라서) */
  pool: readonly AutoCandidate[];
  myLevel: number;
  classCount: number;
  busy: boolean;
  onSave: (name: string, items: ClassItem[]) => Promise<void> | void;
}) {
  const [pick, setPick] = useState(readPick);
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (open) setSeed(0);
  }, [open]);
  const choose = (v: Partial<{ minutes: AutoMinutes; goal: AutoGoal }>) => {
    const next = { ...pick, ...v };
    setPick(next);
    setSeed(0);
    writePick(next);
  };

  const result = useMemo(() => autoClass(pool, { minutes: pick.minutes, goal: pick.goal, myLevel, seed }), [pool, pick, myLevel, seed]);
  const byKey = useMemo(() => new Map(pool.map((c) => [c.key, c])), [pool]);
  const goal = AUTO_GOALS.find((g) => g.id === pick.goal) ?? AUTO_GOALS[0];
  const full = classCount >= MAX_CLASSES;

  return (
    <DmSheet backClose
      open={open}
      onClose={onClose}
      title="내 수업 자동으로 짜기"
      subtitle="시간과 목표를 고르면 내 레벨에 맞춰 짜 드려요"
      footer={
        <div className="space-y-2">
          {full && <p className="text-label text-muted-foreground">내 수업은 {MAX_CLASSES}개까지 — 안 쓰는 수업을 지우면 더 만들 수 있어요</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSeed((s) => s + 1)}
              disabled={!result}
              className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-border bg-card px-4 text-body font-bold text-foreground active:scale-[0.98] disabled:opacity-40"
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> 다시 짜기
            </button>
            <button
              type="button"
              onClick={() => result && void onSave(result.name, result.items)}
              disabled={!result || busy || full}
              className="flex h-12 flex-1 items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-40"
            >
              {busy ? "저장하는 중…" : "이 수업 저장"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 pb-4">
        <div className="space-y-2">
          <p className="text-label font-bold text-muted-foreground">시간</p>
          <div className="flex gap-2">
            {AUTO_MINUTES.map((m) => (
              <Chip key={m} on={pick.minutes === m} onClick={() => choose({ minutes: m })}>
                {m}분
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-label font-bold text-muted-foreground">목표</p>
          <div className="grid grid-cols-4 gap-2">
            {AUTO_GOALS.map((g) => (
              <Chip key={g.id} on={pick.goal === g.id} onClick={() => choose({ goal: g.id })}>
                {g.label}
              </Chip>
            ))}
          </div>
          <p className="px-1 text-label text-muted-foreground">{goal.hint}</p>
        </div>

        {result ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-heading font-black text-foreground">{result.name}</span>
              <span className="shrink-0 text-label font-bold text-muted-foreground">
                {result.items.length}동작 · 약 {result.minutes}분
              </span>
            </p>
            <ol className="mt-3 space-y-2">
              {result.items.map((x, i) => {
                const c = byKey.get(x.k);
                const info = c ? SHELF_INFO[c.shelf] : null;
                return (
                  <li key={x.k} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-label font-black text-foreground tabular-nums">{i + 1}</span>
                    <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: info?.color ?? "#9AA3AE" }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-foreground">{c?.name ?? "동작"}</span>
                      <span className="block text-label text-muted-foreground">
                        {info?.label ?? ""}
                        {c && !c.video ? " · 그림" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-body font-bold tabular-nums text-foreground">{itemAmountText(x)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ) : (
          <p className="rounded-2xl bg-secondary px-4 py-5 text-body text-muted-foreground">
            아직 짤 동작이 부족해요 — 다른 목표를 골라 보세요
          </p>
        )}
        <p className="px-1 text-label text-muted-foreground">저장하면 내 수업에서 이름 · 순서 · 시간을 고칠 수 있어요</p>
      </div>
    </DmSheet>
  );
}
