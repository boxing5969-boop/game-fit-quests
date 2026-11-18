/**
 * 운동 종료 카드 — 오늘 출석이 있을 때만 보인다.
 *
 * 회원이 볼 상태는 셋뿐이다:
 *   1. 출석 없음        → 카드 자체를 렌더하지 않는다(홈을 어지럽히지 않는다)
 *   2. 운동 중          → 경과 시간 + "운동 종료" 버튼
 *   3. 종료함           → 확정된 기록과 받은 XP
 *
 * 안 눌러도 기본 시간(서버 workout_default_minutes — 2026-10-22 부터 66분)으로 기록된다는 사실을 문구로 분명히 적는다.
 * 2026-10-22 대표님: 운동 끝나고 입구 얼굴 인식을 한 번 더 해도 종료와 같다 (첫 출석에서 66분 ~ 3시간 · 최대 3시간,
 *   서버 attendance_checkout_scan 트리거) — "오래 하신 분들은 한 번 더 안면 인식" 안내를 여기 한 줄로.
 *   QR 출석은 하루 두 번째를 저장하지 않아(이미 출석) 두 번째 체크가 안 된다 — 얼굴 인식이 없는 지점은 종료 버튼.
 * 눌러야만 손해를 면하는 구조가 아니라는 것을 회원이 알아야 불만이 안 생긴다.
 *
 * 2026-11-19 운동 시간 고치기 (선릉역점 회원 제안 → 대표님 「이거진행」 · 홈 '내 운동'과 같은 창 WorkoutFixSheet):
 *   오늘 입장 3시간이 지났는데 끝 기록이 없으면 '운동 종료' 대신 '끝난 시각 고르기' · 오늘 출석이 없어도 어제 끝 기록이 없으면 안내 줄.
 *
 * 120분까지는 오래 할수록 XP 와 승급 진행이 더 쌓인다(workout_progress).
 * 그 숫자는 서버에만 있고 여기서 계산하지 않는다 — 화면과 랭킹이 어긋나지 않게.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Timer, Check } from "lucide-react";
import { toast } from "sonner";

import WorkoutFixSheet, { WorkoutFixNotice } from "@/components/home/WorkoutFixSheet";
import { useFinishWorkout, useMyWorkoutFix, useMyWorkoutToday } from "@/hooks/useWorkoutTime";
import { todayFix, yesterdayFix, type WorkoutFixItem } from "@/lib/workoutFix";
import { formatMinutes } from "@/services/workoutTimeService";

const WorkoutFinishCard = () => {
  const { data } = useMyWorkoutToday();
  const finish = useFinishWorkout();
  const { data: fixItems } = useMyWorkoutFix();
  const [fixOpen, setFixOpen] = useState<WorkoutFixItem | null>(null);
  const sheet = <WorkoutFixSheet item={fixOpen} onClose={() => setFixOpen(null)} />;

  if (!data?.checked_in) {
    // 오늘 출석이 없어도 — 어제 운동 끝 기록이 없으면 고칠 수 있게
    const yFix = yesterdayFix(fixItems ?? []);
    if (!yFix) return null;
    return (
      <>
        <WorkoutFixNotice item={yFix} onOpen={() => setFixOpen(yFix)} />
        {sheet}
      </>
    );
  }
  const tFix = !data.finished ? todayFix(fixItems ?? [], data.elapsed_minutes) : null;

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
        <p className="text-label font-bold text-primary">
          오늘 운동
        </p>
        {done ? (
          <p className="truncate text-body font-bold text-foreground">
            {formatMinutes(data.elapsed_minutes)} 기록 완료
          </p>
        ) : (
          <p className="truncate text-body font-bold text-foreground">
            {formatMinutes(data.elapsed_minutes)}째 운동 중
          </p>
        )}
        <p className="mt-0.5 truncate text-label text-muted-foreground">
          {done
            ? `이번 달 ${formatMinutes(data.month_minutes)} · ${data.month_days}일`
            : tFix
              ? "입장 3시간이 지났어요 · 끝난 시각을 골라 주세요"
              : `끝나면 종료 버튼이나 얼굴 인식 한 번 더 · 안 하면 ${data.default_minutes}분`}
        </p>
      </div>

      {!done && tFix && (
        <button
          type="button"
          onClick={() => setFixOpen(tFix)}
          className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-label font-bold text-primary-foreground transition-all active:scale-95"
          aria-label="오늘 운동 끝난 시각 고르기"
        >
          끝난 시각 고르기
        </button>
      )}
      {!done && !tFix && (
        <button
          type="button"
          onClick={handleFinish}
          disabled={finish.isPending}
          className="shrink-0 rounded-xl bg-primary px-3.5 py-2 text-label font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-60"
          aria-label="오늘 운동 종료하기"
        >
          {finish.isPending ? "처리 중" : "운동 종료"}
        </button>
      )}
      {sheet}
    </motion.div>
  );
};

export default WorkoutFinishCard;
