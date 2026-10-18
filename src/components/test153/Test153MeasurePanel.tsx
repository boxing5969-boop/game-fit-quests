/**
 * ⏱ 153 PB 코치 측정 화면 — 관리자 홈 '153 PB 측정' (2026-10-15 대표님 확정)
 *   ① 회원 고르기 → 부문(스타터/오픈) · 성별 → '시작'
 *   ② 큰 타이머 + 지금 구간(셀트런/스테이션 · 개수 · 인정 기준) → 구간이 끝날 때마다 '다음 구간'
 *      잘못 눌렀으면 '되돌리기'. 25:00 이 되면 자동으로 타임캡.
 *   ③ 끝 → (타임캡이면 하던 구간에서 남은 개수) → '공식 기록으로 저장' → 개인 최고 기록이면 크게 알려 준다.
 *   측정 중 화면이 꺼지거나 다른 화면에 다녀와도 이어지게 이 기기에 진행 상황을 적어 둔다(localStorage).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, RotateCcw, Search, Flag, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { translateError } from "@/lib/errorMessages";
import {
  buildSegments,
  DIVISION_LABEL,
  fmtMs,
  TEST153_CAP_MS,
  TEST153_NAME,
  type Test153Division,
} from "@/lib/test153";
import { saveTest153Record, type SaveTest153Result } from "@/services/test153Service";

interface Member {
  id: string;
  name: string;
  branch: string | null;
  gender: string | null;
}

interface RunState {
  member: Member;
  division: Test153Division;
  gender: "남" | "여" | null;
  startAt: number;
  /** 구간이 끝난 시각(epoch ms) — 길이 = 끝낸 구간 수 */
  marks: number[];
  /** 타임캡·중단으로 멈춘 시각 */
  stoppedAt?: number;
}

const STORE_KEY = "test153-run-v1";
const loadRun = (): RunState | null => {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as RunState) : null;
  } catch {
    return null;
  }
};
const storeRun = (r: RunState | null) => {
  try {
    if (r) localStorage.setItem(STORE_KEY, JSON.stringify(r));
    else localStorage.removeItem(STORE_KEY);
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
  const [run, setRun] = useState<RunState | null>(() => loadRun());
  const [now, setNow] = useState(() => Date.now());

  // 설정 단계
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Member | null>(null);
  const [division, setDivision] = useState<Test153Division>("open");
  const [gender, setGender] = useState<"남" | "여" | null>(null);

  // 끝난 뒤
  const [leftInSegment, setLeftInSegment] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<SaveTest153Result | null>(null);

  const update = useCallback((next: RunState | null) => {
    setRun(next);
    storeRun(next);
  }, []);

  const segments = useMemo(() => buildSegments(run?.division ?? division), [run?.division, division]);
  const running = !!run && run.marks.length < segments.length && !run.stoppedAt;
  const finished = !!run && run.marks.length === segments.length;
  const capped = !!run && !!run.stoppedAt && run.marks.length < segments.length;
  const elapsed = run ? (run.stoppedAt ?? (finished ? run.marks[run.marks.length - 1] : now)) - run.startAt : 0;

  // 타이머 — 측정 중에만 0.1초마다
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(t);
  }, [running]);

  // 25:00 → 자동 타임캡
  useEffect(() => {
    if (running && run && now - run.startAt >= TEST153_CAP_MS) {
      update({ ...run, stoppedAt: run.startAt + TEST153_CAP_MS });
      toast("⏱ 25:00 타임캡 — 하던 구간에서 남은 개수를 넣어 주세요");
    }
  }, [now, running, run, update]);

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

  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ["test153-member-search", q, branchName, isSuperAdmin],
    enabled: !run && q.trim().length >= 1,
    queryFn: async (): Promise<Member[]> => {
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

  const pick = (m: Member) => {
    setPicked(m);
    setGender(m.gender === "남" || m.gender === "여" ? m.gender : null);
  };

  const start = () => {
    if (!picked) return;
    const t = Date.now();
    setResult(null);
    setLeftInSegment("");
    setNote("");
    setNow(t);
    update({ member: picked, division, gender, startAt: t, marks: [] });
  };

  const next = () => {
    if (!run || !running) return;
    const t = Date.now();
    update({ ...run, marks: [...run.marks, t] });
    if (navigator.vibrate) navigator.vibrate(40);
  };

  const undo = () => {
    if (!run || run.marks.length === 0 || result) return;
    update({ ...run, marks: run.marks.slice(0, -1), stoppedAt: undefined });
  };

  // 잘못 눌러 멈춘 경우만 이어서 (25:00 타임캡은 못 이어감)
  const canResume = !!run?.stoppedAt && run.stoppedAt - run.startAt < TEST153_CAP_MS;
  const resume = () => {
    if (!run || !canResume) return;
    update({ ...run, stoppedAt: undefined });
  };

  const stopCap = () => {
    if (!run || !running) return;
    update({ ...run, stoppedAt: Date.now() });
  };

  const discard = () => {
    update(null);
    setResult(null);
    setPicked(null);
    setQ("");
  };

  // 구간별 걸린 시간
  const splits = useMemo(() => {
    if (!run) return [] as number[];
    const pts = [run.startAt, ...run.marks];
    const out = pts.slice(1).map((t, i) => t - pts[i]);
    if (capped && run.stoppedAt) out.push(run.stoppedAt - pts[pts.length - 1]);
    return out;
  }, [run, capped]);

  // 타임캡이면 남은 동작 수 = 하던 구간에서 남은 개수 + 그 뒤 구간 개수 전부
  const curIdx = run ? run.marks.length : 0;
  const laterReps = capped ? segments.slice(curIdx + 1).reduce((a, s) => a + s.reps, 0) : 0;
  const leftNum = Math.max(0, Math.min(segments[curIdx]?.reps ?? 0, parseInt(leftInSegment || "0", 10) || 0));
  const remaining = capped ? leftNum + laterReps : 0;

  const save = async () => {
    if (!run || saving) return;
    if (capped && remaining <= 0) {
      toast.error("하던 구간에서 남은 개수를 넣어 주세요");
      return;
    }
    setSaving(true);
    try {
      const r = await saveTest153Record({
        userId: run.member.id,
        division: run.division,
        gender: run.gender,
        splitsMs: splits,
        finished,
        remainingReps: remaining,
        note,
      });
      setResult(r);
      qc.invalidateQueries({ queryKey: ["test153"] });
      toast.success(r.is_pb ? "🏆 개인 최고 기록! 공식 기록으로 저장했어요" : "공식 기록으로 저장했어요");
    } catch (e) {
      toast.error(translateError(e, "저장하지 못했어요. 다시 눌러 주세요"));
    } finally {
      setSaving(false);
    }
  };

  const doneAndNext = () => {
    update(null);
    setResult(null);
    setPicked(null);
    setQ("");
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
      {run && !result && (
        <button type="button" onClick={discard} className="rounded-full px-3 py-1.5 text-xs font-bold text-muted-foreground active:scale-95">
          측정 버리기
        </button>
      )}
    </div>
  );

  // ① 설정
  if (!run) {
    return (
      <section className="space-y-3">
        {header}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">1. 회원 고르기</p>
          {picked ? (
            <div className="flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{picked.name}</p>
                {isSuperAdmin && <p className="text-xs text-muted-foreground">{shortBranch(picked.branch)}</p>}
              </div>
              <button type="button" onClick={() => setPicked(null)} aria-label="다시 고르기" className="p-1 text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·닉네임 검색" className="pl-9" />
              </div>
              {q.trim() && (
                <ul className="max-h-64 overflow-y-auto rounded-xl border border-border">
                  {candidates.length === 0 ? (
                    <li className="px-3 py-3 text-sm text-muted-foreground">{isFetching ? "찾는 중…" : "찾는 회원이 없어요"}</li>
                  ) : (
                    candidates.map((m, i) => (
                      <li key={m.id} className={i > 0 ? "border-t border-border" : ""}>
                        <button type="button" onClick={() => pick(m)} className="flex w-full items-center justify-between px-3 py-2.5 text-left active:bg-secondary/40">
                          <span className="truncate text-sm font-semibold text-foreground">{m.name}</span>
                          {isSuperAdmin && <span className="shrink-0 text-xs text-muted-foreground">{shortBranch(m.branch)}</span>}
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </>
          )}

          <p className="pt-1 text-sm font-bold text-foreground">2. 부문</p>
          <div className="grid grid-cols-2 gap-2">
            {(["starter", "open"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDivision(d)}
                className={cn(
                  "rounded-xl border py-2.5 text-sm font-bold active:scale-95",
                  division === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground",
                )}
              >
                {DIVISION_LABEL[d]}
                <span className="block text-[11px] font-medium opacity-80">{d === "starter" ? "개수 절반 · 처음이면" : "기본"}</span>
              </button>
            ))}
          </div>

          <p className="pt-1 text-sm font-bold text-foreground">3. 성별 <span className="font-normal text-muted-foreground">(순위 나누기용)</span></p>
          <div className="grid grid-cols-2 gap-2">
            {(["남", "여"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(gender === g ? null : g)}
                className={cn(
                  "rounded-xl border py-2 text-sm font-bold active:scale-95",
                  gender === g ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-foreground",
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 p-4">
          <p className="mb-2 text-xs font-bold text-muted-foreground">순서 ({DIVISION_LABEL[division]}) · 매 라운드 셀트런 100m → 스테이션 · 타임캡 25:00</p>
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
          disabled={!picked}
          onClick={start}
          className="h-14 w-full rounded-2xl bg-primary text-lg font-black text-primary-foreground shadow-elev-1 active:scale-[0.98] disabled:opacity-40"
        >
          시작 ▶
        </button>
      </section>
    );
  }

  // ② 측정 중 · ③ 끝
  const cur = segments[Math.min(curIdx, segments.length - 1)];
  const lastMark = run.marks.length ? run.marks[run.marks.length - 1] : run.startAt;
  const segElapsed = running ? now - lastMark : 0;
  const left = TEST153_CAP_MS - elapsed;

  return (
    <section className="space-y-3">
      {header}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-bold text-foreground">{run.member.name}</span>
          <span className="text-muted-foreground">
            {DIVISION_LABEL[run.division]}
            {run.gender ? ` · ${run.gender}` : ""}
          </span>
        </div>

        <p
          className={cn(
            "mt-2 text-center text-6xl font-black tabular-nums tracking-tight",
            running && left < 60000 ? "text-destructive" : "text-foreground",
          )}
        >
          {fmtMs(elapsed)}
        </p>
        <p className="text-center text-xs text-muted-foreground tabular-nums">
          {running ? `타임캡까지 ${fmtMs(Math.max(0, left), false)}` : finished ? "완주!" : "타임캡 · 중단"}
        </p>

        {running && (
          <div className="mt-4 rounded-xl bg-primary/10 p-3">
            <p className="text-xs font-bold text-primary">
              {cur.index + 1} / {segments.length} · 라운드 {cur.round}
            </p>
            <p className="mt-0.5 text-2xl font-black text-foreground">
              {cur.label} {cur.boxing && "🥊"}
            </p>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{cur.standard}</p>
            <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">이 구간 {fmtMs(segElapsed)}</p>
          </div>
        )}
      </div>

      {running && (
        <>
          <button
            type="button"
            onClick={next}
            className="h-24 w-full rounded-3xl bg-primary text-2xl font-black text-primary-foreground shadow-elev-1 active:scale-[0.98]"
          >
            {curIdx === segments.length - 1 ? "완주! 🏁" : `다음 구간 ▶`}
            {curIdx < segments.length - 1 && (
              <span className="block text-sm font-bold opacity-80">다음: {segments[curIdx + 1].label}</span>
            )}
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={run.marks.length === 0}
              onClick={undo}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card text-sm font-bold text-foreground active:scale-95 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" /> 되돌리기
            </button>
            <button
              type="button"
              onClick={stopCap}
              className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-destructive/40 bg-card text-sm font-bold text-destructive active:scale-95"
            >
              <Flag className="h-4 w-4" /> 여기서 멈춤
            </button>
          </div>
        </>
      )}

      {!running && !result && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          {capped && (
            <div>
              <p className="text-sm font-bold text-foreground">
                {segments[curIdx]?.label} — 남은 개수
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  inputMode="numeric"
                  value={leftInSegment}
                  onChange={(e) => setLeftInSegment(e.target.value.replace(/\D/g, ""))}
                  placeholder={`0 ~ ${segments[curIdx]?.reps ?? 0}`}
                  className="w-28 text-center text-lg font-bold"
                />
                <span className="text-sm text-muted-foreground">개 + 뒤 구간 {laterReps}개</span>
              </div>
              <p className="mt-2 text-sm text-foreground">
                기록: <b>25:00 + 남은 {remaining}개</b>
                <span className="block text-xs text-muted-foreground">완주한 사람은 항상 이 기록보다 앞이에요. 셀트런 1구간 = 10개로 셉니다.</span>
              </p>
            </div>
          )}
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="메모 (선택) — 예: 푸시업 노렙 많음" />
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button
              type="button"
              disabled={capped ? !canResume : run.marks.length === 0}
              onClick={capped ? resume : undo}
              className="flex h-12 items-center justify-center gap-1.5 rounded-xl border border-border px-4 text-sm font-bold text-foreground active:scale-95 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" />
              {capped ? "이어서" : "되돌리기"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="h-12 rounded-xl bg-primary text-base font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "저장 중…" : "공식 기록으로 저장"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className={cn("rounded-2xl border p-4 text-center", result.is_pb ? "border-amber-400/60 bg-amber-400/10" : "border-border bg-card")}>
          {result.is_pb && <Trophy className="mx-auto h-8 w-8 text-amber-500" />}
          <p className="mt-1 text-lg font-black text-foreground">
            {result.is_pb ? (result.prev_pb_ms ? "개인 최고 기록 경신!" : "첫 공식 기록!") : "저장했어요"}
          </p>
          {result.prev_pb_ms != null && finished && result.prev_pb_ms > result.score_ms && result.prev_pb_ms <= TEST153_CAP_MS && (
            <p className="text-sm text-muted-foreground">이전 최고 {fmtMs(result.prev_pb_ms)} → {fmtMs(result.score_ms)} ({((result.prev_pb_ms - result.score_ms) / 1000).toFixed(1)}초 단축)</p>
          )}
          <button
            type="button"
            onClick={doneAndNext}
            className="mt-3 h-12 w-full rounded-xl bg-primary text-base font-black text-primary-foreground active:scale-[0.98]"
          >
            다음 회원 측정
          </button>
        </div>
      )}

      {splits.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="mb-2 text-xs font-bold text-muted-foreground">구간 기록</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
            {splits.map((ms, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate text-muted-foreground">
                  {segments[i].kind === "run" ? `런${segments[i].round}` : segments[i].short}
                  {capped && i === splits.length - 1 ? " (멈춤)" : ""}
                </span>
                <span className="shrink-0 whitespace-nowrap tabular-nums font-semibold text-foreground">{fmtMs(ms)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default Test153MeasurePanel;
