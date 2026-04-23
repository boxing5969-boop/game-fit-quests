import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Flag,
  Salad,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MAINTENANCE_MISSIONS, RECOVERY_MISSIONS } from "@/data/postProgramMissions";
import type {
  DietPostProgramCheckin,
  DietPostProgramPlan,
} from "@/lib/diet/postProgramTypes";
import WeeklyCheckinDialog from "./WeeklyCheckinDialog";

interface MaintenanceHomeProps {
  plan: DietPostProgramPlan;
  checkins: DietPostProgramCheckin[];
}

/**
 * 유지 컨설팅 모드 홈.
 *
 * 섹션:
 *   1. 상단 요약 — 유지 기준 체중/허리·현재 주차
 *   2. 유지 점수 (최근 4주 평균 adherence)
 *   3. 복귀 미션 카드 (서버 트리거 또는 수동)
 *   4. 주간 미션 6개
 *   5. 주간 체크인 CTA
 *   6. 최근 체크인 히스토리
 */
export const MaintenanceHome = ({ plan, checkins }: MaintenanceHomeProps) => {
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);

  const currentWeek = useMemo(
    () => (checkins.length > 0 ? Math.max(...checkins.map((c) => c.week_index)) + 1 : 1),
    [checkins],
  );

  const maintenanceScore = useMemo(() => {
    const last4 = checkins.slice(0, 4);
    if (last4.length === 0) return null;
    const scores = last4.map((c) => c.adherence_score).filter((s): s is number => s != null);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [checkins]);

  const latestCheckin = checkins[0];
  const autoRecovery = latestCheckin?.needs_recovery ?? false;
  const recoveryActive = autoRecovery || showRecovery;

  return (
    <div className="space-y-4">
      {/* 상단 Hero */}
      <section className="rounded-2xl border border-emerald-400/30 bg-gradient-to-b from-emerald-400/10 to-transparent p-5">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-400/20 p-1.5">
            <Salad className="h-4 w-4 text-emerald-500" />
          </span>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
            MAINTENANCE · 유지 컨설팅 모드
          </p>
        </div>
        <h2 className="mt-1 text-[20px] font-extrabold leading-tight text-foreground">
          {currentWeek}주차 유지 중
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          이제는 빼는 단계보다 지키는 단계가 중요합니다.
          <br />
          먹고 싶은 것을 즐기더라도 다시 균형으로 돌아오는 힘을 만드는 과정이에요.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <InfoTile
            label="유지 기준 체중"
            value={
              plan.maintenance_target_weight_kg
                ? `${plan.maintenance_target_weight_kg.toFixed(1)} kg ±${plan.maintenance_range_kg}`
                : "미설정"
            }
          />
          <InfoTile
            label="유지 기준 허리"
            value={
              plan.maintenance_waist_target_cm
                ? `${plan.maintenance_waist_target_cm.toFixed(1)} cm ±${plan.maintenance_waist_range_cm}`
                : "미설정"
            }
          />
        </div>
      </section>

      {/* 유지 점수 */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              유지 점수 (최근 4주 평균)
            </p>
            <p className="mt-0.5 number-font text-[22px] font-extrabold text-foreground">
              {maintenanceScore !== null ? `${maintenanceScore}` : "—"}
              <span className="ml-1 text-[12px] font-bold text-muted-foreground">/ 100</span>
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-reward" />
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          공개 랭킹에 쓰이지 않습니다. 자기 점검 용도입니다.
        </p>
      </section>

      {/* 복귀 미션 카드 */}
      {recoveryActive && (
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-primary" />
            <p className="text-[12px] font-extrabold text-primary">
              3일 복귀 미션
            </p>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
            {autoRecovery
              ? "최근 체크인에서 유지 범위를 넘어섰어요. 3일만 아래 루틴으로 재정렬해요."
              : "최근 일탈이 있었다면 3일만 아래 루틴으로 리셋."}
          </p>
          <ul className="mt-3 space-y-1.5">
            {RECOVERY_MISSIONS.map((m) => (
              <li
                key={m.code}
                className="rounded-xl border border-border bg-card px-3 py-2 text-[12px]"
              >
                <p className="font-bold text-foreground">{m.label}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {m.hint}
                </p>
              </li>
            ))}
          </ul>
          {!autoRecovery && (
            <Button
              variant="outline"
              onClick={() => setShowRecovery(false)}
              className="mt-3 h-9 w-full rounded-xl text-[12px]"
            >
              복귀 미션 닫기
            </Button>
          )}
        </section>
      )}

      {/* 주간 미션 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-extrabold text-foreground">
            이번 주 유지 미션
          </p>
          {!recoveryActive && (
            <button
              type="button"
              onClick={() => setShowRecovery(true)}
              className="text-[11px] font-bold text-muted-foreground underline decoration-dotted"
            >
              복귀 미션 열기
            </button>
          )}
        </div>
        <ul className="space-y-1.5">
          {MAINTENANCE_MISSIONS.map((m) => (
            <li
              key={m.code}
              className="rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[12.5px] font-bold text-foreground">{m.label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    {m.hint}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 주간 체크인 CTA */}
      <Button
        onClick={() => setCheckinOpen(true)}
        className={cn(
          "h-12 w-full rounded-2xl font-bold tracking-wide",
          "bg-emerald-500/90 text-white hover:bg-emerald-500",
        )}
      >
        <CalendarCheck className="mr-1.5 h-4 w-4" />
        {currentWeek}주차 체크인 시작
      </Button>

      {/* 최근 체크인 히스토리 */}
      {checkins.length > 0 && (
        <section className="space-y-2">
          <p className="text-[12px] font-extrabold text-foreground">체크인 히스토리</p>
          <ul className="space-y-1.5">
            {checkins.slice(0, 6).map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-[12px]"
              >
                <div>
                  <p className="font-bold text-foreground">{c.week_index}주차</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {c.checkin_date}
                    {c.weight_kg != null && ` · ${c.weight_kg.toFixed(1)} kg`}
                    {c.waist_cm != null && ` · ${c.waist_cm.toFixed(1)} cm`}
                  </p>
                </div>
                {c.adherence_score != null && (
                  <span className="number-font rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-bold text-emerald-500">
                    {c.adherence_score}
                  </span>
                )}
                {c.needs_recovery && <Flag className="h-3.5 w-3.5 text-primary" />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <WeeklyCheckinDialog
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        planId={plan.id}
        weekIndex={currentWeek}
        mode="maintenance"
      />
    </div>
  );
};

const InfoTile = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-card px-3 py-2">
    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-0.5 text-[13px] font-extrabold text-foreground">{value}</p>
  </div>
);

export default MaintenanceHome;
