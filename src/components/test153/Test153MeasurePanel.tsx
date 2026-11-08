/**
 * ⏱ 153 PB 코치 측정 화면 — 관리자 홈 '153 PB 측정' (2026-10-15 대표님 확정 · 2026-11-08 히트 「2단계넘어가자」)
 *   ① 참가자 1~4명 고르기(사람마다 부문 · 성별) → '시작' — 한 번에 같이 시작(히트)
 *   ② 큰 타이머 하나 + 사람마다 칸: 지금 구간(셀트런/종목 · 개수 · 인정 기준) · 큰 '다음 구간' 버튼 · 되돌리기 · 멈춤
 *      칸 색 = TV 레일 동그라미 색. 25:00 이 되면 달리는 사람은 모두 타임캡.
 *   ③ 완주하면 4초 뒤 공식 기록(구간 16개)으로 저절로 저장 — 그 사이 '되돌리기'. 캡 · 멈춤은 남은 개수를 넣어 저장.
 *   ④ 저장하면 '결과 한 장'(이번 vs 지난번 · 가장 좋아진 영역) + 악력 — 1명이면 바로 열린다 (Test153MeasurePanelResult)
 *   측정 중 화면이 꺼지거나 다른 화면에 다녀와도 이어지게 이 기기에 적어 둔다(localStorage · 1단계 한 명 측정도 이어받음).
 *   📺 TV: 레인마다 이름 없는 신호(useTest153LiveSender) + 서버 test153_heat_save(바뀔 때마다) — TV 는 닉네임 · 지난번의 나를
 *      board_test153_live 로 읽는다. 서버 동기화가 안 돼도 측정 · 공식 기록 저장은 그대로.
 *   계산은 전부 lib/test153Heat · 사람 칸은 Test153MeasurePanelLane.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { translateError } from "@/lib/errorMessages";
import { buildSegments, DIVISION_LABEL, fmtMs, TEST153_CAP_MS, TEST153_NAME, type Test153Division } from "@/lib/test153";
import {
  HEAT_MAX,
  HEAT_STORE_KEY,
  RUN_V1_STORE_KEY,
  applyHeatGhosts,
  capHeat,
  dropLane,
  heatAllResolved,
  heatAnyPendingSave,
  heatAnyRunning,
  heatCapDue,
  heatFromRunV1,
  heatLiveItems,
  heatPayload,
  laneElapsed,
  lanePhase,
  laneRemaining,
  laneSplits,
  lanesDueForSave,
  markLaneSaved,
  parseHeat,
  resumeLane,
  setLaneLeft,
  setLaneNote,
  startHeat,
  stopLane,
  tapLane,
  undoLane,
  type HeatMember,
  type HeatSetupLane,
  type HeatState,
} from "@/lib/test153Heat";
import { pbLaneColor } from "@/lib/pbBoard";
import { saveTest153Heat, saveTest153Record } from "@/services/test153Service";
import { useTest153LiveSender } from "@/hooks/useTest153LiveSender";
import Test153MeasurePanelLane from "@/components/test153/Test153MeasurePanelLane";
import Test153MeasurePanelResult from "@/components/test153/Test153MeasurePanelResult";

const loadHeat = (coachBranch: string): HeatState | null => {
  try {
    const raw = localStorage.getItem(HEAT_STORE_KEY);
    if (raw) {
      const h = parseHeat(JSON.parse(raw));
      if (h) return h;
    }
    // 1단계(한 명씩) 측정이 남아 있으면 1명 히트로 이어받는다
    const old = localStorage.getItem(RUN_V1_STORE_KEY);
    if (old) {
      const h = heatFromRunV1(JSON.parse(old), coachBranch);
      localStorage.removeItem(RUN_V1_STORE_KEY);
      if (h) {
        localStorage.setItem(HEAT_STORE_KEY, JSON.stringify(h));
        return h;
      }
    }
  } catch {
    /* 저장소가 막힌 기기여도 측정은 된다 */
  }
  return null;
};
const storeHeat = (h: HeatState | null) => {
  try {
    if (h) localStorage.setItem(HEAT_STORE_KEY, JSON.stringify(h));
    else localStorage.removeItem(HEAT_STORE_KEY);
  } catch {
    /* 저장이 안 되는 기기여도 측정은 된다 */
  }
};

const shortBranch = (b: string | null | undefined) => (b ?? "").replace(/^153복싱짐\s*/, "");

interface Props {
  branchName: string;
  isSuperAdmin: boolean;
  onBack: () => void;
}

const Test153MeasurePanel = ({ branchName, isSuperAdmin, onBack }: Props) => {
  const qc = useQueryClient();
  const [heat, setHeat] = useState<HeatState | null>(() => loadHeat(branchName));
  const heatRef = useRef(heat);
  const [now, setNow] = useState(() => Date.now());

  const update = useCallback((next: HeatState | null) => {
    heatRef.current = next;
    setHeat(next);
    storeHeat(next);
  }, []);

  // 설정 단계
  const [q, setQ] = useState("");
  const [setup, setSetup] = useState<HeatSetupLane[]>([]);
  const [nextDivision, setNextDivision] = useState<Test153Division>("open");

  // 저장 중 · 저장 실패한 레인 (이 화면에서만)
  const [saving, setSaving] = useState<number[]>([]);
  const [failed, setFailed] = useState<number[]>([]);
  const savingRef = useRef<Set<number>>(new Set());
  const [openResult, setOpenResult] = useState<number | null>(null);

  const running = heatAnyRunning(heat);
  const pending = heatAnyPendingSave(heat);
  const resolved = !!heat && heatAllResolved(heat);

  // 📺 TV 로 레인마다 이름 없는 신호 (2026-11-08) — 지점 = 히트 지점(참가자 지점, 없으면 이 화면 지점)
  const liveItems = useMemo(() => heatLiveItems(heat), [heat]);
  useTest153LiveSender(heat?.branch || branchName, liveItems);

  // 시계 — 달리는 동안 0.1초 · 저장 기다리는 동안 0.5초
  useEffect(() => {
    if (!running && !pending) return;
    const t = window.setInterval(() => setNow(Date.now()), running ? 100 : 500);
    return () => window.clearInterval(t);
  }, [running, pending]);

  // 25:00 → 달리는 사람 모두 타임캡
  useEffect(() => {
    if (heat && heatCapDue(heat, now)) {
      update(capHeat(heat));
      toast("⏱ 25:00 타임캡 — 사람마다 하던 구간에서 남은 개수를 넣어 주세요");
    }
  }, [now, heat, update]);

  // 측정 중 화면 꺼짐 막기 (되는 기기만)
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  useEffect(() => {
    if (!running) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    nav.wakeLock
      ?.request?.("screen")
      .then((l: { release: () => Promise<void> }) => (wakeRef.current = l))
      .catch(() => undefined);
    return () => {
      wakeRef.current?.release().catch(() => undefined);
      wakeRef.current = null;
    };
  }, [running]);

  // ── 공식 기록 저장 (레인 하나) ──
  const saveLane = useCallback(
    async (laneNo: number) => {
      const h = heatRef.current;
      const l = h?.lanes.find((x) => x.lane === laneNo);
      if (!h || !l || savingRef.current.has(laneNo)) return;
      const ph = lanePhase(l, h.startAt);
      if (ph !== "finished" && ph !== "stopped" && ph !== "capped") return;
      const finished = ph === "finished";
      const remaining = finished ? 0 : laneRemaining(l);
      if (!finished && remaining <= 0) {
        toast.error(`${l.member.name} — 하던 구간에서 남은 개수를 넣어 주세요`);
        return;
      }
      savingRef.current.add(laneNo);
      setSaving([...savingRef.current]);
      setFailed((f) => f.filter((n) => n !== laneNo));
      try {
        const r = await saveTest153Record({
          userId: l.member.id,
          division: l.division,
          gender: l.gender,
          splitsMs: laneSplits(l, h.startAt),
          finished,
          remainingReps: remaining,
          note: l.note,
        });
        const cur = heatRef.current;
        if (cur && cur.id === h.id) {
          update(markLaneSaved(cur, laneNo, r));
          if (cur.lanes.length === 1) setOpenResult(laneNo);
        }
        qc.invalidateQueries({ queryKey: ["test153"] });
        toast.success(r.is_pb ? `🏆 ${l.member.name} 개인 최고 기록! 공식 기록으로 저장했어요` : `${l.member.name} 공식 기록으로 저장했어요`);
      } catch (e) {
        setFailed((f) => (f.includes(laneNo) ? f : [...f, laneNo]));
        toast.error(translateError(e, `${l.member.name} 기록을 저장하지 못했어요. 다시 눌러 주세요`));
      } finally {
        savingRef.current.delete(laneNo);
        setSaving([...savingRef.current]);
      }
    },
    [qc, update],
  );

  // 완주 4초 뒤 저절로 저장 (실패하면 '다시 저장' 단추 — 저절로 되풀이하지 않는다)
  useEffect(() => {
    if (!heat) return;
    for (const n of lanesDueForSave(heat, now)) {
      if (!savingRef.current.has(n) && !failed.includes(n)) void saveLane(n);
    }
  }, [now, heat, failed, saveLane]);

  // ── 서버 동기화 (test153_heat_save) — 바뀐 뒤 0.7초 · 실패하면 다음 변화나 20초 뒤 ──
  const syncedRef = useRef<string>("");
  const syncFail = useRef(false);
  const syncHeat = useCallback(async (status: "running" | "done" | "void" = "running") => {
    const h = heatRef.current;
    if (!h) return;
    const payload = heatPayload(h, status);
    const key = JSON.stringify(payload);
    if (status === "running" && key === syncedRef.current) return;
    try {
      const data = await saveTest153Heat(payload);
      syncedRef.current = key;
      syncFail.current = false;
      const cur = heatRef.current;
      if (cur && cur.id === h.id) {
        const withGhosts = applyHeatGhosts(cur, data);
        if (withGhosts !== cur) update(withGhosts);
      }
    } catch {
      syncFail.current = true; // TV 이름 · 지난번의 나만 늦는다 — 측정 · 저장은 그대로
    }
  }, [update]);
  useEffect(() => {
    if (!heat) return;
    const t = window.setTimeout(() => void syncHeat(), 700);
    return () => window.clearTimeout(t);
  }, [heat, syncHeat]);
  useEffect(() => {
    if (!heat) return;
    const t = window.setInterval(() => {
      if (syncFail.current) void syncHeat();
    }, 20_000);
    return () => window.clearInterval(t);
  }, [heat, syncHeat]);

  // ── 회원 찾기 ──
  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ["test153-member-search", q, branchName, isSuperAdmin],
    enabled: !heat && q.trim().length >= 1,
    queryFn: async (): Promise<HeatMember[]> => {
      const term = q.trim().replace(/[%,()]/g, "");
      let query = supabase
        .from("profiles")
        .select("user_id, name, nickname, branch_name, gender")
        .or(`name.ilike.%${term}%,nickname.ilike.%${term}%`)
        .order("name")
        .limit(20);
      if (!isSuperAdmin) query = query.eq("branch_name", branchName);
      const { data, error } = await query;
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return ((data ?? []) as any[]).map((p) => ({
        id: p.user_id,
        name: [p.name, p.nickname && p.nickname !== p.name ? `(${p.nickname})` : null].filter(Boolean).join(" ") || "이름 없음",
        branch: p.branch_name,
        gender: p.gender,
      }));
    },
  });

  const addPick = (m: HeatMember) => {
    if (setup.length >= HEAT_MAX || setup.some((s) => s.member.id === m.id)) return;
    setSetup([...setup, { member: m, division: nextDivision, gender: m.gender === "남" || m.gender === "여" ? m.gender : null }]);
    setQ("");
  };
  const patchPick = (i: number, patch: Partial<HeatSetupLane>) => {
    setSetup(setup.map((s, k) => (k === i ? { ...s, ...patch } : s)));
    if (patch.division) setNextDivision(patch.division);
  };

  const start = () => {
    if (!setup.length) return;
    const t = Date.now();
    setNow(t);
    setFailed([]);
    setOpenResult(null);
    syncedRef.current = "";
    update(startHeat(setup, branchName, t));
  };

  const act = (fn: (h: HeatState) => HeatState | null, vibrate = false) => {
    const h = heatRef.current;
    if (!h) return;
    const next = fn(h);
    if (!next) return;
    update(next);
    if (vibrate && navigator.vibrate) navigator.vibrate(40);
  };

  const finishHeat = (status: "done" | "void") => {
    void syncHeat(status);
    update(null);
    setSetup([]);
    setQ("");
    setFailed([]);
    setOpenResult(null);
  };

  const discard = () => {
    const h = heatRef.current;
    if (!h) return;
    const saved = h.lanes.some((l) => l.saved);
    if (!window.confirm(saved ? "측정을 끝낼까요? 저장한 공식 기록은 그대로 남아요" : "측정을 버릴까요? 기록은 저장되지 않아요")) return;
    finishHeat(saved ? "done" : "void");
  };

  /* ───────── 화면 ───────── */
  const header = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary active:scale-95"
      >
        <ChevronLeft className="h-4 w-4 text-secondary-foreground" />
      </button>
      <h3 className="flex-1 text-base font-bold text-foreground">⏱ {TEST153_NAME} 측정</h3>
      {heat && !resolved && (
        <button type="button" onClick={discard} className="rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground active:scale-95">
          {heat.lanes.some((l) => l.saved) ? "측정 끝내기" : "측정 버리기"}
        </button>
      )}
    </div>
  );

  // ① 설정 — 참가자 1~4명
  if (!heat) {
    const courseDivision = setup[0]?.division ?? nextDivision;
    const segments = buildSegments(courseDivision);
    return (
      <section className="space-y-3">
        {header}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-bold text-foreground">참가자 · 한 번에 최대 {HEAT_MAX}명</p>
            <span className="text-xs font-bold tabular-nums text-muted-foreground">
              {setup.length}/{HEAT_MAX}
            </span>
          </div>

          {setup.length > 0 && (
            <ul className="space-y-2">
              {setup.map((s, i) => (
                <li key={s.member.id} className="rounded-xl border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sm font-black text-white"
                      style={{ background: pbLaneColor(i + 1) }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-foreground">{s.member.name}</p>
                      {isSuperAdmin && <p className="text-[11px] text-muted-foreground">{shortBranch(s.member.branch)}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSetup(setup.filter((_, k) => k !== i))}
                      aria-label={`${s.member.name} 빼기`}
                      className="p-1 text-muted-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {(["starter", "open"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => patchPick(i, { division: d })}
                        className={cn(
                          "rounded-lg border py-1.5 text-xs font-bold active:scale-95",
                          s.division === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground",
                        )}
                      >
                        {DIVISION_LABEL[d]}
                      </button>
                    ))}
                    {(["남", "여"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => patchPick(i, { gender: s.gender === g ? null : g })}
                        className={cn(
                          "rounded-lg border py-1.5 text-xs font-bold active:scale-95",
                          s.gender === g ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-foreground",
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {setup.length < HEAT_MAX && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={setup.length ? "참가자 더 찾기 — 이름·닉네임" : "이름·닉네임 검색"}
                  className="pl-9"
                />
              </div>
              {q.trim() && (
                <ul className="max-h-64 overflow-y-auto rounded-xl border border-border">
                  {candidates.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-muted-foreground">{isFetching ? "찾는 중…" : "찾는 회원이 없어요"}</li>
                  ) : (
                    candidates.map((m, i) => {
                      const taken = setup.some((s) => s.member.id === m.id);
                      return (
                        <li key={m.id} className={i > 0 ? "border-t border-border" : ""}>
                          <button
                            type="button"
                            disabled={taken}
                            onClick={() => addPick(m)}
                            className="flex w-full items-center gap-2 px-3 py-2.5 text-left active:bg-secondary/40 disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4 shrink-0 text-primary" />
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{m.name}</span>
                            {isSuperAdmin && <span className="shrink-0 text-xs text-muted-foreground">{shortBranch(m.branch)}</span>}
                            {taken && <span className="shrink-0 text-xs font-bold text-muted-foreground">골랐어요</span>}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
              <p className="text-[12px] text-muted-foreground">
                새로 고르는 사람은 {DIVISION_LABEL[nextDivision]}으로 들어가요 · 사람마다 부문 · 성별(순위 나누기용)을 바꿀 수 있어요
              </p>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">순서 ({DIVISION_LABEL[courseDivision]}) · 매 라운드 셀트런 100m → 스테이션 · 타임캡 25:00</p>
          <ol className="space-y-0.5 text-[13px] text-foreground">
            {segments
              .filter((s) => s.kind === "station")
              .map((s) => (
                <li key={s.index}>
                  <span className="tabular-nums text-muted-foreground">{s.round}.</span> {s.label}
                  {s.boxing && <span className="ml-1 text-[11px]">🥊</span>}
                </li>
              ))}
          </ol>
        </div>

        <button
          type="button"
          disabled={!setup.length}
          onClick={start}
          className="h-14 w-full rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-elev-1 active:scale-[0.98] disabled:opacity-40"
        >
          {setup.length > 1 ? `${setup.length}명 같이 시작 ▶` : "시작 ▶"}
        </button>
      </section>
    );
  }

  // ② 측정 중 · ③ 끝
  const elapsed = running ? Math.min(now - heat.startAt, TEST153_CAP_MS) : Math.max(...heat.lanes.map((l) => laneElapsed(l, heat.startAt, now)));
  const left = TEST153_CAP_MS - elapsed;
  const compact = heat.lanes.length >= 3;
  const opened = openResult != null ? heat.lanes.find((l) => l.lane === openResult && l.saved) : undefined;

  return (
    <section className="space-y-3">
      {header}

      <div className="rounded-2xl border border-border bg-card px-4 py-3">
        <p
          className={cn(
            "text-center font-black tabular-nums tracking-tight",
            compact ? "text-5xl" : "text-6xl",
            running && left < 60000 ? "text-destructive" : "text-foreground",
          )}
        >
          {fmtMs(elapsed)}
        </p>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {running
            ? `타임캡까지 ${fmtMs(Math.max(0, left), false)} · ${heat.lanes.length}명`
            : resolved
              ? "모두 끝났어요"
              : elapsed >= TEST153_CAP_MS
                ? "25:00 타임캡 — 남은 개수를 넣어 주세요"
                : "끝난 사람부터 저장해요"}
        </p>
      </div>

      <div className={cn("grid grid-cols-1 gap-2", heat.lanes.length > 1 && "sm:grid-cols-2")}>
        {heat.lanes.map((l) => (
          <Test153MeasurePanelLane
            key={l.lane}
            lane={l}
            startAt={heat.startAt}
            now={now}
            compact={compact}
            saving={saving.includes(l.lane)}
            saveError={failed.includes(l.lane)}
            resultOpen={openResult === l.lane}
            onTap={() => act((h) => tapLane(h, l.lane, Date.now()), true)}
            onUndo={() => act((h) => undoLane(h, l.lane))}
            onStop={() => act((h) => stopLane(h, l.lane, Date.now()))}
            onResume={() => act((h) => resumeLane(h, l.lane, Date.now()))}
            onDrop={() => act((h) => dropLane(h, l.lane, true))}
            onRestore={() => act((h) => dropLane(h, l.lane, false))}
            onLeft={(v) => act((h) => setLaneLeft(h, l.lane, v))}
            onNote={(v) => act((h) => setLaneNote(h, l.lane, v))}
            onSave={() => void saveLane(l.lane)}
            onToggleResult={() => setOpenResult(openResult === l.lane ? null : l.lane)}
          />
        ))}
      </div>

      {opened?.saved && (
        <Test153MeasurePanelResult
          key={opened.saved.id}
          memberId={opened.member.id}
          memberName={opened.member.name}
          division={opened.division}
          finished={opened.marks.length >= 16}
          result={opened.saved}
          onDone={heat.lanes.length === 1 ? () => finishHeat("done") : undefined}
        />
      )}

      {heat.lanes.some((l) => l.marks.length > 0) && (
        <details className="rounded-2xl border border-border bg-card p-3">
          <summary className="cursor-pointer text-xs font-bold text-muted-foreground">구간 기록 보기</summary>
          <div className="mt-2 space-y-3">
            {heat.lanes
              .filter((l) => l.marks.length > 0)
              .map((l) => {
                const segs = buildSegments(l.division);
                const splits = laneSplits(l, heat.startAt);
                const stopped = l.stoppedAt != null && l.marks.length < 16;
                return (
                  <div key={l.lane}>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: pbLaneColor(l.lane) }} />
                      {l.member.name}
                    </p>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12.5px]">
                      {splits.map((ms, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="truncate text-muted-foreground">
                            {segs[i].kind === "run" ? `런${segs[i].round}` : segs[i].short}
                            {stopped && i === splits.length - 1 ? " (멈춤)" : ""}
                          </span>
                          <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-foreground">{fmtMs(ms)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        </details>
      )}

      {resolved && (heat.lanes.length > 1 || !opened) && (
        <button
          type="button"
          onClick={() => finishHeat("done")}
          className="h-14 w-full rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-elev-1 active:scale-[0.98]"
        >
          다음 측정
        </button>
      )}
    </section>
  );
};

export default Test153MeasurePanel;
