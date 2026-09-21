/**
 * 운동 종료 카드 — 오늘 출석이 있을 때만 보인다.
 *
 * 회원이 볼 상태는 셋뿐이다:
 *   1. 출석 없음        → 카드 자체를 렌더하지 않는다(홈을 어지럽히지 않는다)
 *   2. 운동 중          → 경과 시간 + "운동 종료" 버튼
 *   3. 종료함           → 확정된 기록과 받은 XP
 *
 * 안 눌러도 50분(한 타임)으로 기록된다는 사실을 문구로 분명히 적는다.
 * 눌러야만 손해를 면하는 구조가 아니라는 것을 회원이 알아야 불만이 안 생긴다.
 */

import { motion } from "framer-motion";
import { Timer, Check } from "lucide-react";
import { toast } from "sonner";

import { useFinishWorkout, useMyWorkoutToday } from "@/hooks/useWorkoutTime";
import { formatMinutes } from "@/services/workoutTimeService";

const WorkoutFinishCard = () => {
  const { data } = useMyWorkoutToday();
  const finish = useFinishWorkout();

  if (!data?.checked_in) return null;

  const handleFinish = () => {
    if (finish.isPending) return;
    finish.mutate(null, {
      onSuccess: (res) => {
        if (!res.success) {
          toast.error(res.error || "종료 처리에 실패했습니다.");
          return;
        }
        if (res.already_finished) {
          toast.info("이미 종료했어요.");
          return;
        }
        const xp = res.xp_granted ?? 0;
        toast.success(
          `오늘 ${formatMinutes(res.minutes)} 운동했어요${xp > 0 ? ` · XP +${xp}` : ""} 🥊`,
        );
      },
      onError: (e: unknown) => {
        toast.error(e instanceof Error ? e.message : "종료 처리에 실패했습니다.");
      },
    });
  };

  const done = data.finished;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          done ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
        }`}
      >
        {done ? <Check className="h-5 w-5" /> : <Timer className="h-5 w-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
          오늘 운동
        </p>
        {done ? (
          <p className="truncate text-sm font-bold text-foreground">
            {formatMinutes(data.elapsed_minutes)} 기록 완료
          </p>
        ) : (
          <p className="truncate text-sm font-bold text-foreground">
            {formatMinutes(data.elapsed_minutes)}째 운동 중
          </p>
        )}
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {done
            ? `이번 달 ${formatMinutes(data.month_minutes)} · ${data.month_days}일`
            : `안 누르면 ${data.default_minutes}분으로 기록돼요`}
        </p>
      </div>

      {!done && (
        <button
          type="button"
          onClick={handleFinish}
          disabled={finish.isPending}
          className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-60"
          aria-label="오늘 운동 종료하기"
        >
          {finish.isPending ? "처리 중" : "운동 종료"}
        </button>
      )}
    </motion.div>
  );
};

export default WorkoutFinishCard;
