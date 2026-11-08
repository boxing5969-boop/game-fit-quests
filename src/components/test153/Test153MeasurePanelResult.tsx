/**
 * ⏱ 153 PB 측정 — 공식 기록 저장 뒤 '이번 결과 한 장' + 악력 칸 (2026-10-25 체력 프로필 1단계 · 2026-11-08 히트로 나누며 따로 뺌)
 *   영역 숫자는 서버 get_my_fitness_profile(회원) — 같은 지점 코치 · 지점장 · 관리자만 읽는다. 문구는 lib/test153Profile.
 *   측정 화면(Test153MeasurePanel)이 참가자마다 연다 — 1명이면 저장하자마자, 히트면 '결과 한 장'을 누를 때.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatPct } from "@/lib/healthGains153";
import { fmtMs, TEST153_CAP_MS, type Test153Division } from "@/lib/test153";
import { gripText, measureErrorText, measureInputError, parseMeasure, resultSummary } from "@/lib/test153Profile";
import { fetchFitnessProfile, saveFitnessMeasure } from "@/services/test153Service";
import type { HeatSaved } from "@/lib/test153Heat";

interface Props {
  memberId: string;
  memberName: string;
  division: Test153Division;
  finished: boolean;
  result: HeatSaved;
  /** 1명 측정이면 '다음 회원 측정' 단추를 여기에 */
  onDone?: () => void;
  doneLabel?: string;
}

const Test153MeasurePanelResult = ({ memberId, memberName, division, finished, result, onDone, doneLabel }: Props) => {
  const qc = useQueryClient();
  const [grip, setGrip] = useState("");
  const [gripSaving, setGripSaving] = useState(false);

  const { data: memberProfile } = useQuery({
    queryKey: ["test153", "profile", memberId, result.id],
    staleTime: 60_000,
    retry: 1,
    queryFn: () => fetchFitnessProfile(memberId),
  });
  const summaryDiv = memberProfile?.divisions[division] ?? null;
  const summary = summaryDiv && summaryDiv.latest.id === result.id ? resultSummary(summaryDiv) : null;
  const gripLine = gripText(memberProfile?.grip ?? null);

  const saveGrip = async () => {
    if (gripSaving) return;
    const v = parseMeasure("grip_kg", grip);
    const err = v == null ? "악력을 넣어 주세요 (좌우 각 2번 중 가장 높은 값)" : measureInputError("grip_kg", v);
    if (v == null || err) {
      toast.error(err ?? "악력을 넣어 주세요");
      return;
    }
    setGripSaving(true);
    try {
      await saveFitnessMeasure(memberId, "grip_kg", v);
      toast.success("악력을 저장했어요");
      setGrip("");
      void qc.invalidateQueries({ queryKey: ["test153", "profile", memberId] });
    } catch (e) {
      toast.error(measureErrorText(e));
    } finally {
      setGripSaving(false);
    }
  };

  return (
    <div className={cn("rounded-2xl border p-4 text-center", result.is_pb ? "border-amber-400/60 bg-amber-400/10" : "border-border bg-card")}>
      {result.is_pb && <Trophy className="mx-auto h-8 w-8 text-amber-500" />}
      <p className="mt-1 text-sm font-bold text-muted-foreground">{memberName}</p>
      <p className="text-lg font-black text-foreground">
        {result.is_pb ? (result.prev_pb_ms ? "개인 최고 기록 경신!" : "첫 공식 기록!") : "저장했어요"}
      </p>
      {result.prev_pb_ms != null && finished && result.prev_pb_ms > result.score_ms && result.prev_pb_ms <= TEST153_CAP_MS && (
        <p className="text-sm text-muted-foreground">
          이전 최고 {fmtMs(result.prev_pb_ms)} → {fmtMs(result.score_ms)} ({((result.prev_pb_ms - result.score_ms) / 1000).toFixed(1)}초 단축)
        </p>
      )}

      {/* 이번 결과 한 장 — 회원과 함께 보며 이야기 (2026-10-25) */}
      {summary && (
        <div className="mt-3 rounded-xl bg-muted/50 p-3 text-left">
          <p className="text-[12.5px] font-black text-foreground">이번 결과 한 장</p>
          <p className="mt-1 text-[13px] text-foreground">
            이번 <b className="tabular-nums">{summary.thisText}</b>
            {summary.prevText && (
              <span className="text-muted-foreground">
                {" "}
                · 지난번 <span className="tabular-nums">{summary.prevText}</span>
              </span>
            )}
          </p>
          {summary.fasterMs != null && (
            <p className="text-[12.5px] font-bold text-primary">지난번보다 {(summary.fasterMs / 1000).toFixed(1)}초 빨라졌어요</p>
          )}
          {summary.best && (
            <p className="text-[12.5px] font-bold text-primary">
              가장 좋아진 영역 · {summary.best.label} +{formatPct(summary.best.pct)}%
            </p>
          )}
          <ul className="mt-2 space-y-1 text-[12px]">
            {summary.changes.map((c) => (
              <li key={c.key} className="flex items-baseline justify-between gap-2">
                <span className="shrink-0 text-muted-foreground">{c.label}</span>
                <span className="min-w-0 text-right tabular-nums text-foreground">
                  {c.value ?? "—"}
                  {c.pct != null && <b className="ml-1 text-primary">+{formatPct(c.pct)}%</b>}
                </span>
              </li>
            ))}
          </ul>
          {!summary.prevText && (
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">첫 기록이에요 — 다음 측정부터 지난번과 비교해 보여 드려요</p>
          )}
        </div>
      )}

      {/* 악력 — 좌우 각 2번 중 가장 높은 값 (공식 기록과 같은 날 · 같은 코치) */}
      <div className="mt-3 rounded-xl border border-border p-3 text-left">
        <p className="text-[12.5px] font-black text-foreground">
          악력 (kg) <span className="font-normal text-muted-foreground">좌우 각 2번 중 가장 높은 값</span>
        </p>
        <div className="mt-2 flex gap-2">
          <Input
            inputMode="decimal"
            value={grip}
            onChange={(e) => setGrip(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
            placeholder="예: 42.5"
            aria-label={`${memberName} 악력 (kg)`}
            className="h-11 text-center text-lg font-bold tabular-nums"
          />
          <button
            type="button"
            disabled={gripSaving || !grip.trim()}
            onClick={() => void saveGrip()}
            className="h-11 shrink-0 rounded-xl bg-foreground px-4 text-sm font-bold text-background active:scale-95 disabled:opacity-50"
          >
            {gripSaving ? "저장 중…" : "악력 저장"}
          </button>
        </div>
        {gripLine && <p className="mt-1.5 text-[12px] font-bold text-primary">최근 {gripLine}</p>}
      </div>

      {onDone && (
        <button
          type="button"
          onClick={onDone}
          className="mt-3 h-12 w-full rounded-xl bg-primary text-base font-black text-primary-foreground active:scale-[0.98]"
        >
          {doneLabel ?? "다음 회원 측정"}
        </button>
      )}
    </div>
  );
};

export default Test153MeasurePanelResult;
