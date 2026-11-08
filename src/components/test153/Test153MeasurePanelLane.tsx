/**
 * ⏱ 153 PB 히트 — 참가자 한 명 칸 (2026-11-08 대표님 「2단계넘어가자」)
 *   큰 버튼 = 그 사람이 지금 구간을 끝냈을 때 한 번(1.5초 안 두 번 누름은 무시). 칸 색 = TV 레일 동그라미 색.
 *   완주(16번째) → 4초 뒤 공식 기록으로 저절로 저장 — 그 사이 '되돌리기'. 멈춤 → 남은 개수를 넣어 저장 · 이어서 · 기록 없이 빼기.
 *   상태 계산은 전부 lib/test153Heat — 여기는 그리기만.
 */
import { Flag, RotateCcw, Trophy, Undo2, UserMinus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { buildSegments, DIVISION_LABEL, fmtMs, TEST153_CAP_MS } from "@/lib/test153";
import {
  HEAT_AUTOSAVE_MS,
  HEAT_SEGMENTS,
  laneElapsed,
  laneLaterReps,
  lanePhase,
  laneRemaining,
  type HeatLane,
} from "@/lib/test153Heat";
import { pbLaneColor } from "@/lib/pbBoard";

interface Props {
  lane: HeatLane;
  startAt: number;
  now: number;
  /** 3~4명이면 버튼을 조금 낮게 (폰 한 화면에) */
  compact: boolean;
  saving: boolean;
  saveError: boolean;
  resultOpen: boolean;
  onTap: () => void;
  onUndo: () => void;
  onStop: () => void;
  onResume: () => void;
  onDrop: () => void;
  onRestore: () => void;
  onLeft: (v: string) => void;
  onNote: (v: string) => void;
  onSave: () => void;
  onToggleResult: () => void;
}

/** 지난번의 나 — 같은 구간을 끝낸 시각 차이 (코치 화면은 짧게 ±) */
const ghostChip = (l: HeatLane, startAt: number): { text: string; ahead: boolean } | null => {
  const cum = l.ghost?.cum;
  if (!cum || cum.length !== HEAT_SEGMENTS || l.marks.length === 0) return null;
  const k = Math.min(l.marks.length, HEAT_SEGMENTS);
  const d = l.marks[k - 1] - startAt - cum[k - 1];
  const s = Math.round(Math.abs(d) / 1000);
  const t = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return { text: `지난번 ${d < 0 ? "−" : "+"}${t}`, ahead: d <= 0 };
};

const Test153MeasurePanelLane = (p: Props) => {
  const { lane: l, startAt, now } = p;
  const segments = buildSegments(l.division);
  const phase = lanePhase(l, startAt);
  const color = pbLaneColor(l.lane);
  const curIdx = Math.min(l.marks.length, segments.length - 1);
  const cur = segments[curIdx];
  const elapsed = laneElapsed(l, startAt, now);
  const lastMark = l.marks.length ? l.marks[l.marks.length - 1] : startAt;
  const ghost = ghostChip(l, startAt);

  const header = (
    <div className="flex min-w-0 items-center gap-2">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-black text-white"
        style={{ background: color }}
        aria-label={`${l.lane}번`}
      >
        {l.lane}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-foreground">{l.member.name}</span>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
        {DIVISION_LABEL[l.division]}
        {l.gender ? ` · ${l.gender}` : ""}
      </span>
      {ghost ? (
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
            ghost.ahead ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {ghost.text}
        </span>
      ) : l.first && phase === "running" ? (
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">첫 도전</span>
      ) : null}
    </div>
  );

  // ── 달리는 중 ──
  if (phase === "running") {
    const last = curIdx === HEAT_SEGMENTS - 1;
    const next = segments[curIdx + 1];
    return (
      <div className="min-w-0 rounded-2xl border-2 bg-card p-3" style={{ borderColor: color }}>
        {header}
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate text-lg font-black text-foreground">
            {cur.label} {cur.boxing && "🥊"}
          </p>
          <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
            {cur.index + 1}/{HEAT_SEGMENTS} · R{cur.round}
          </span>
        </div>
        <p className="truncate text-[12px] text-muted-foreground">{cur.standard}</p>
        <button
          type="button"
          onClick={p.onTap}
          className={cn(
            "mt-2 w-full rounded-2xl text-xl font-black text-white shadow-elev-1 active:scale-[0.98]",
            p.compact ? "h-16" : "h-20",
          )}
          style={{ background: color }}
        >
          {last ? "완주! 🏁" : "다음 구간 ▶"}
          {!last && next && <span className="block text-[12px] font-bold opacity-85">다음: R{next.round} {next.kind === "run" ? "셀트런" : next.short}</span>}
        </button>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex-1 text-xs tabular-nums text-muted-foreground">이 구간 {fmtMs(now - lastMark)}</span>
          <button
            type="button"
            disabled={l.marks.length === 0}
            onClick={p.onUndo}
            className="flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-bold text-foreground active:scale-95 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 되돌리기
          </button>
          <button
            type="button"
            onClick={p.onStop}
            className="flex h-9 items-center gap-1 rounded-lg border border-destructive/40 px-2.5 text-xs font-bold text-destructive active:scale-95"
          >
            <Flag className="h-3.5 w-3.5" /> 멈춤
          </button>
        </div>
      </div>
    );
  }

  // ── 완주 · 저장 기다림 ──
  if (phase === "finished") {
    const wait = l.doneAt != null ? Math.max(0, Math.ceil((HEAT_AUTOSAVE_MS - (now - l.doneAt)) / 1000)) : null;
    return (
      <div className="min-w-0 rounded-2xl border-2 bg-card p-3" style={{ borderColor: color }}>
        {header}
        <p className="mt-2 text-center text-3xl font-black tabular-nums text-foreground">🏁 {fmtMs(elapsed)}</p>
        {p.saveError ? (
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-xs font-bold text-destructive">저장하지 못했어요 — 인터넷을 보고 다시 눌러 주세요</p>
            <button type="button" onClick={p.onSave} className="h-10 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground active:scale-95">
              다시 저장
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-center text-xs font-bold text-muted-foreground">
              {p.saving ? "공식 기록으로 저장 중…" : wait != null ? `${wait}초 뒤 공식 기록으로 저장` : "완주"}
            </p>
            {!p.saving && l.doneAt != null && (
              <button
                type="button"
                onClick={p.onUndo}
                className="flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-bold text-foreground active:scale-95"
              >
                <Undo2 className="h-3.5 w-3.5" /> 되돌리기
              </button>
            )}
            {!p.saving && l.doneAt == null && (
              <button type="button" onClick={p.onSave} className="h-9 rounded-lg bg-primary px-3 text-xs font-black text-primary-foreground active:scale-95">
                공식 기록으로 저장
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── 멈춤 · 25:00 캡 — 남은 개수를 넣어 저장 ──
  if (phase === "stopped" || phase === "capped") {
    const later = laneLaterReps(l, segments);
    const remaining = laneRemaining(l, segments);
    return (
      <div className="min-w-0 rounded-2xl border-2 border-destructive/40 bg-card p-3">
        {header}
        <p className="mt-2 text-sm font-bold text-foreground">
          {phase === "capped" ? "25:00 타임캡" : `멈춤 ${fmtMs(Math.min(elapsed, TEST153_CAP_MS))}`} · {cur.label} — 남은 개수
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <Input
            inputMode="numeric"
            value={l.left ?? ""}
            onChange={(e) => {
              // 그 구간 개수보다 크게는 못 넣는다 (셀트런은 10)
              const d = e.target.value.replace(/\D/g, "");
              p.onLeft(d && Number(d) > cur.reps ? String(cur.reps) : d);
            }}
            placeholder={`0 ~ ${cur.reps}`}
            aria-label={`${l.member.name} 남은 개수`}
            className="h-10 w-24 text-center text-lg font-bold"
          />
          <span className="text-xs text-muted-foreground">개 + 뒤 구간 {later}개</span>
        </div>
        <p className="mt-1 text-[13px] text-foreground">
          기록: <b>25:00 + 남은 {remaining}개</b>
        </p>
        <Input
          value={l.note ?? ""}
          onChange={(e) => p.onNote(e.target.value)}
          placeholder="메모 (선택)"
          className="mt-2 h-9 text-sm"
        />
        {p.saveError && <p className="mt-1 text-xs font-bold text-destructive">저장하지 못했어요 — 다시 눌러 주세요</p>}
        <div className="mt-2 grid grid-cols-[auto_auto_1fr] gap-2">
          <button
            type="button"
            disabled={phase !== "stopped"}
            onClick={p.onResume}
            className="flex h-10 items-center justify-center gap-1 rounded-xl border border-border px-3 text-xs font-bold text-foreground active:scale-95 disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 이어서
          </button>
          <button
            type="button"
            onClick={p.onDrop}
            className="flex h-10 items-center justify-center gap-1 rounded-xl border border-border px-3 text-xs font-bold text-muted-foreground active:scale-95"
          >
            <UserMinus className="h-3.5 w-3.5" /> 기록 없이
          </button>
          <button
            type="button"
            disabled={p.saving || remaining <= 0}
            onClick={p.onSave}
            className="h-10 rounded-xl bg-primary text-sm font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {p.saving ? "저장 중…" : "공식 기록으로 저장"}
          </button>
        </div>
      </div>
    );
  }

  // ── 저장함 ──
  if (phase === "saved" && l.saved) {
    const s = l.saved;
    const faster = s.prev_pb_ms != null && s.prev_pb_ms > s.score_ms && s.prev_pb_ms <= TEST153_CAP_MS ? s.prev_pb_ms - s.score_ms : null;
    return (
      <div className={cn("min-w-0 rounded-2xl border-2 p-3", s.is_pb ? "border-amber-400/70 bg-amber-400/10" : "bg-card")} style={s.is_pb ? undefined : { borderColor: color }}>
        {header}
        <div className="mt-2 flex items-center gap-2">
          {s.is_pb && <Trophy className="h-6 w-6 shrink-0 text-amber-500" />}
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-black tabular-nums text-foreground">
              {l.marks.length >= HEAT_SEGMENTS ? fmtMs(s.score_ms) : `캡 + ${Math.round((s.score_ms - TEST153_CAP_MS) / 1000)}개`}
            </p>
            <p className="text-xs font-bold text-muted-foreground">
              {s.is_pb ? (s.prev_pb_ms ? `개인 최고!${faster != null ? ` ${(faster / 1000).toFixed(1)}초 단축` : ""}` : "첫 공식 기록!") : "공식 기록 저장"}
            </p>
          </div>
          <button
            type="button"
            onClick={p.onToggleResult}
            className="h-9 shrink-0 rounded-lg border border-border px-3 text-xs font-bold text-foreground active:scale-95"
          >
            {p.resultOpen ? "접기" : "결과 한 장"}
          </button>
        </div>
      </div>
    );
  }

  // ── 기록 없이 뺌 ──
  return (
    <div className="min-w-0 rounded-2xl border border-dashed border-border bg-muted/30 p-3">
      {header}
      <div className="mt-2 flex items-center gap-2">
        <p className="flex-1 text-xs font-bold text-muted-foreground">기록 없이 뺐어요</p>
        <button type="button" onClick={p.onRestore} className="h-9 rounded-lg border border-border px-3 text-xs font-bold text-foreground active:scale-95">
          되살리기
        </button>
      </div>
    </div>
  );
};

export default Test153MeasurePanelLane;
