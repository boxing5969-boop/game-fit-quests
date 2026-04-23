import { useState } from "react";
import {
  CheckCircle2,
  HeartHandshake,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DietPostProgramPlan } from "@/lib/diet/postProgramTypes";
import { useEndExtendCycle } from "@/hooks/useDietPostProgram";

interface ExtendCycleResultProps {
  plan: DietPostProgramPlan;
  totalWeeks: number;
  onDone?: () => void;
}

type Choice = "maintenance_transition" | "extend_again" | "coach_consult";

/**
 * 연장 사이클 종료 후 결과 선택 화면 (3갈래).
 *
 *   A. 유지 모드로 전환 — 목표에 도달했거나 유지가 적절
 *   B. 한 번 더 연장 — 체지방 감량을 안정적으로 이어가기
 *   C. 코치와 개별 상담 — 정체기·이탈 전 개입
 *
 * 톤: "실패/성공" 이분법 금지. 선택지의 평등한 제안.
 */
export const ExtendCycleResult = ({
  plan,
  totalWeeks,
  onDone,
}: ExtendCycleResultProps) => {
  const [selected, setSelected] = useState<Choice | null>(null);
  const end = useEndExtendCycle();

  const handleConfirm = async () => {
    if (!selected) return;
    const res = await end.mutateAsync({ planId: plan.id, result: selected });
    if (res.success) onDone?.();
  };

  return (
    <section className="space-y-4">
      {/* 축하 — 실패 프레임 없이 */}
      <div className="rounded-2xl border border-reward/30 bg-gradient-to-b from-reward/10 to-transparent p-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#F6C453]" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F6C453]">
            EXTEND CYCLE DONE
          </p>
        </div>
        <h2 className="mt-1 text-[20px] font-extrabold leading-tight text-foreground">
          {plan.extension_cycle_length}일 연장 {totalWeeks}주 완주
        </h2>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
          사이클을 이어갔다는 것이 이미 큰 변화입니다.
          <br />
          지금 몸에 맞는 다음 단계를 골라요.
        </p>
      </div>

      {/* 3갈래 카드 */}
      <div className="grid grid-cols-1 gap-2.5">
        <ChoiceCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="유지 모드로 전환"
          subtitle="이제는 빼는 단계보다 지키는 단계"
          bullets={[
            "주 1회 체중·허리 체크",
            "외식/자유식 후 다음 끼니 복귀",
            "급증 시 3일 복귀 미션 자동",
          ]}
          selected={selected === "maintenance_transition"}
          onClick={() => setSelected("maintenance_transition")}
          tone="good"
        />
        <ChoiceCard
          icon={<RefreshCw className="h-5 w-5" />}
          title="한 번 더 연장하기"
          subtitle="안정적인 감량 루틴을 한 사이클 더"
          bullets={[
            "재평가 결과·패턴 태그 유지",
            "주차별 미션 새 사이클 리셋",
            "정체기 대응 안내 포함",
          ]}
          selected={selected === "extend_again"}
          onClick={() => setSelected("extend_again")}
          tone="focus"
        />
        <ChoiceCard
          icon={<MessageSquare className="h-5 w-5" />}
          title="코치와 개별 상담"
          subtitle="경로를 고르기 전 1:1 점검"
          bullets={[
            "정체·이탈 전 조기 개입",
            "약점 패턴 재분류",
            "맞춤 식단/운동 리플랜",
          ]}
          selected={selected === "coach_consult"}
          onClick={() => setSelected("coach_consult")}
          tone="neutral"
        />
      </div>

      <Button
        onClick={handleConfirm}
        disabled={!selected || end.isPending}
        className={cn(
          "h-12 w-full rounded-2xl font-bold tracking-wide",
          "bg-primary text-primary-foreground disabled:opacity-60",
        )}
      >
        {end.isPending
          ? "처리 중..."
          : selected
            ? "이 단계로 이동"
            : "하나를 선택해 주세요"}
      </Button>

      {end.isError && (
        <p className="text-center text-[11px] text-destructive">
          저장에 실패했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}

      <p className="pt-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        언제든 코치와 상담 후 경로를 바꿀 수 있어요.
      </p>
    </section>
  );
};

const ChoiceCard = ({
  icon,
  title,
  subtitle,
  bullets,
  selected,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  bullets: string[];
  selected: boolean;
  onClick: () => void;
  tone: "good" | "focus" | "neutral";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-2xl border p-4 text-left transition-all active:scale-[0.99]",
      selected
        ? tone === "good"
          ? "border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_0_1px_rgba(52,211,153,0.3)]"
          : tone === "focus"
            ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
            : "border-muted-foreground/40 bg-muted/40"
        : "border-border bg-card",
    )}
  >
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          tone === "good"
            ? "bg-emerald-400/15 text-emerald-500"
            : tone === "focus"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div>
        <h3 className="text-[15px] font-extrabold leading-tight text-foreground">
          {title}
        </h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      {tone === "good" && (
        <HeartHandshake className="ml-auto h-3 w-3 text-emerald-500 opacity-0" />
      )}
    </div>
    <ul className="mt-2 space-y-0.5 text-[12px] text-foreground">
      {bullets.map((b) => (
        <li key={b} className="flex gap-1.5">
          <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
          <span className="leading-relaxed">{b}</span>
        </li>
      ))}
    </ul>
  </button>
);

export default ExtendCycleResult;
