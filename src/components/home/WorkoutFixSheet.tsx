/**
 * ⏱ 운동 시간 고치기 창 (2026-11-19 선릉역점 회원 제안 → 대표님 「이거진행」)
 *   「깜박잊고 운동종료를 안눌렀는데 12시 지나니까 자동반영이되었어요 · 운동한시간을 수정할수있었으면좋겠어요」
 *
 *   2026-11-21 대표님 「운동시간 고르기는 7일까지수정할수있게 해줘」 → 출석한 날부터 7일째 밤 12시까지.
 *
 *   여는 곳: 홈 '내 운동' — 어제 기록 안내 줄 [운동한 시간 고치기] · 오늘 입장 3시간이 지났는데 끝 기록이 없으면 머리의 [끝난 시각 고르기] ·
 *           운동 달력 그날 카드의 [운동한 시간 고치기](그 앞 날 — WorkoutCalendar).
 *   입장 시각(얼굴 인식 · QR)은 그대로 두고 '운동한 시간'을 10분 단위로 고른다 — 칸마다 끝난 시각을 같이 보여 준다.
 *   규칙 · XP 는 서버(fix_my_workout_end) 그대로: 67 ~ 180분 · 지난 시각까지 · 한 번만 · 출석한 날부터 7일 안.
 *   뒤로가기 = 이 창만 닫힘(useBackClose).
 */
import { useEffect, useRef, useState } from "react";
import { Timer } from "lucide-react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useBackClose } from "@/hooks/useBackClose";
import { useFixWorkout } from "@/hooks/useWorkoutTime";
import { durationLabel } from "@/lib/attendanceHistory";
import {
  fixChoices,
  fixDayLabel,
  fixDaysAgo,
  fixDayWord,
  fixDoneText,
  fixEndLabel,
  fixNoticeSub,
  fixNoticeTitle,
  fixUntilText,
  kstHm,
  type WorkoutFixItem,
} from "@/lib/workoutFix";
import { cn } from "@/lib/utils";

export interface WorkoutFixSheetProps {
  item: WorkoutFixItem | null;
  onClose: () => void;
}

const WorkoutFixSheet = ({ item, onClose }: WorkoutFixSheetProps) => {
  const open = !!item;
  const fix = useFixWorkout();
  const [pick, setPick] = useState<number | null>(null);
  // 닫히며 내려가는 동안에도 글이 그대로 보이게 마지막 기록을 든다
  const last = useRef<WorkoutFixItem | null>(item);
  if (item) last.current = item;
  const view = item ?? last.current;

  // 다른 날을 열면 고른 칸을 비운다
  useEffect(() => {
    setPick(null);
  }, [item?.day]);

  useBackClose(open, onClose);

  const choices = view ? fixChoices(view) : [];
  const ago = view ? fixDaysAgo(view.day) : 0;
  const save = () => {
    if (!item || pick == null || fix.isPending) return;
    fix.mutate(
      { day: item.day, minutes: pick },
      {
        onSuccess: (res) => {
          if (!res.success) {
            toast.error(res.error || "운동 시간을 고치지 못했어요.");
            if (res.already_finished) onClose();
            return;
          }
          toast.success(fixDoneText(item, res.minutes ?? pick, res.xp_granted ?? 0));
          onClose();
        },
        onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "운동 시간을 고치지 못했어요."),
      },
    );
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[92vh]">
        {view && (
          <>
            <DrawerHeader className="pb-1 text-left">
              <DrawerTitle className="text-heading">{fixDayWord(view)} 운동 시간 고치기</DrawerTitle>
              <DrawerDescription className="text-body text-muted-foreground">
                {/* 그 앞 날은 제목에 날짜가 있으니 다시 쓰지 않는다 */}
                {ago <= 1 ? `${fixDayLabel(view.day)} ` : ""}
                {kstHm(view.startedAt)} 입장 ·{" "}
                {ago <= 0
                  ? `운동 종료를 안 누르면 ${durationLabel(view.defaultMinutes)}이에요`
                  : `지금은 기본 ${durationLabel(view.defaultMinutes)}이에요`}
              </DrawerDescription>
            </DrawerHeader>

            <div className="overflow-y-auto px-4 pb-2">
              <p className="mb-2 mt-2 text-label font-bold text-foreground">운동한 시간</p>
              {choices.length === 0 ? (
                <p className="rounded-xl bg-muted/50 px-4 py-3 text-body text-muted-foreground">
                  아직 고를 시간이 없어요 — 운동이 끝나면 다시 열어 주세요
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="운동한 시간">
                  {choices.map((m) => {
                    const on = pick === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPick(m)}
                        className={cn(
                          "flex min-h-[64px] flex-col items-center justify-center rounded-xl border px-1 py-2 transition-transform active:scale-95",
                          on ? "border-2 border-primary bg-primary/10" : "border-border bg-card",
                        )}
                      >
                        <span className={cn("text-body font-bold tabular-nums", on ? "text-primary" : "text-foreground")}>
                          {durationLabel(m)}
                        </span>
                        <span className="text-micro tabular-nums text-muted-foreground">{fixEndLabel(view.startedAt, m)} 끝</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-label leading-relaxed text-muted-foreground">
                실제로 운동을 마친 시각으로 골라 주세요 · 한 번만 고칠 수 있어요 · {fixUntilText(view)}
              </p>
            </div>

            <div className="px-4 pb-6 pt-3">
              <button
                type="button"
                onClick={save}
                disabled={pick == null || fix.isPending}
                className="h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {fix.isPending ? "기록하는 중" : pick == null ? "운동한 시간을 골라 주세요" : `${durationLabel(pick)}으로 기록하기`}
              </button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
};

/** 홈 '내 운동' 안내 줄 — 어제 운동 끝 기록이 없어 기본 시간으로 쳐진 날 (고치면 사라지고, 다음 날부터는 운동 달력 그날 카드에서) */
export const WorkoutFixNotice = ({ item, onOpen, className }: { item: WorkoutFixItem; onOpen: () => void; className?: string }) => (
  <div className={cn("rounded-xl border border-primary/30 bg-primary/5 px-4 py-3.5", className)}>
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Timer className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-bold leading-snug text-foreground">{fixNoticeTitle(item)}</span>
        <span className="mt-0.5 block text-label leading-snug text-muted-foreground">{fixNoticeSub(item)}</span>
      </span>
    </div>
    <button
      type="button"
      onClick={onOpen}
      className="mt-3 h-11 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground transition-transform active:scale-[0.98]"
    >
      운동한 시간 고치기
    </button>
  </div>
);

export default WorkoutFixSheet;
