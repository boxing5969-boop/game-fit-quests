/**
 * 「운동을 끝낼까요?」 — 출석하고 50분이 지나서 앱을 열면 (2026-11-23 대표님 「추천대로」).
 *
 * 누구에게: 보호자가 연결된 회원 + 생년월일로 미성년인 회원 (서버 my_guardian_state.prompt).
 * 언제: 오늘 출석 뒤 promptMin(50)분 ~ promptMaxMin(180)분, 끝 기록이 없을 때 · 홈을 열 때 · 앱으로 돌아올 때.
 * [운동 끝] → 운동 종료와 같은 길(finish_workout_session) — 서버가 1분 안에 보호자에게 「운동 끝」 알림.
 * [아직 하는 중] → snoozeMin(20)분 뒤 다시 (그 출석 한 건에만 · 이 기기).
 * 아이 알림(70분 · 끝 기록 없음)은 /home?finish=1 로 열려 기다림 없이 바로 띄운다.
 * 다른 창이 떠 있으면 닫힐 때까지 기다린다(굿즈 팝업과 같은 방식).
 * 예시: /home?finishdemo=1 (서버를 안 부르고 창만).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useFinishWorkout, useMyWorkoutToday } from "@/hooks/useWorkoutTime";
import { finishPromptDue, finishSnoozeKey, minutesSince, minutesText, readSnooze, writeSnooze } from "@/lib/guardian";
import { formatMinutes } from "@/services/workoutTimeService";
import { guardianDemo, useMyGuardianState } from "@/services/guardianService";

const otherOverlayOpen = (): boolean => {
  if (document.querySelector('[aria-modal="true"], [role="dialog"], [role="alertdialog"]')) return true;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(".fixed.inset-0"))) {
    const z = Number.parseInt(window.getComputedStyle(el).zIndex, 10);
    if (!Number.isFinite(z) || z < 50) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
  }
  return false;
};

const WorkoutFinishPrompt = () => {
  const demo = guardianDemo("finishdemo");
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const force = params.get("finish") === "1";
  const { data: st } = useMyGuardianState(!demo);
  const state = st?.available ? st.state : null;
  const wanted = demo || (!!state && state.on && state.prompt);
  const { data: today, refetch } = useMyWorkoutToday(wanted && !demo);
  const finish = useFinishWorkout();
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const forcedRef = useRef(false);

  const startedAt = demo ? new Date(Date.now() - 62 * 60_000).toISOString() : today?.started_at ?? null;
  const key = user?.id ? finishSnoozeKey(user.id, startedAt) : null;

  // 앱으로 돌아올 때(다른 앱에 갔다 오기) 다시 본다 — 출석 기록도 새로
  useEffect(() => {
    if (!wanted) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!demo) void refetch();
      setTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    // 화면을 켜 둔 채로 50분이 넘어갈 때도 — 1분마다 한 번 계산만
    const iv = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(iv);
    };
  }, [wanted, demo, refetch]);

  useEffect(() => {
    if (open || !wanted || !key) return;
    const due = demo
      ? !forcedRef.current
      : !!state &&
        finishPromptDue(state, today, Date.now(), readSnooze(key), force && !forcedRef.current);
    if (!due) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      if (otherOverlayOpen()) {
        tries += 1;
        if (tries < 40) timer = setTimeout(check, 1500);
        return;
      }
      forcedRef.current = true;
      setOpen(true);
    };
    timer = setTimeout(check, force ? 400 : 1200);
    return () => clearTimeout(timer);
  }, [open, wanted, key, demo, state, today, force, tick]);

  const dropFinishParam = useCallback(() => {
    if (params.get("finish") !== "1") return;
    const next = new URLSearchParams(params);
    next.delete("finish");
    setParams(next, { replace: true });
  }, [params, setParams]);

  const later = useCallback(() => {
    if (key) writeSnooze(key, Date.now() + (state?.snoozeMin ?? 20) * 60_000);
    setOpen(false);
    dropFinishParam();
  }, [key, state?.snoozeMin, dropFinishParam]);

  useModalDismiss(open, later);

  const done = () => {
    if (demo) {
      setOpen(false);
      toast.success("오늘 1시간 2분 운동했어요 🥊");
      return;
    }
    if (finish.isPending) return;
    // 기록을 다시 읽기 전에 창이 또 뜨지 않게 — 그 출석 한 건은 더 묻지 않는다(실패하면 짧게)
    if (key) writeSnooze(key, Date.now() + 6 * 3_600_000);
    finish.mutate(null, {
      onSuccess: (res) => {
        setOpen(false);
        dropFinishParam();
        if (!res.success) {
          if (key) writeSnooze(key, Date.now() + (state?.snoozeMin ?? 20) * 60_000);
          toast.error(res.error || "종료 처리에 실패했습니다.");
          return;
        }
        if (res.already_finished) {
          toast.info("이미 종료했어요.");
          return;
        }
        const xp = res.xp_granted ?? 0;
        toast.success(
          `오늘 ${formatMinutes(res.minutes)} 운동했어요${xp > 0 ? ` · XP +${xp}` : ""}${state?.hasGuardian ? " · 보호자에게 알림이 가요" : ""}`,
        );
      },
      onError: (e: unknown) => {
        if (key) writeSnooze(key, Date.now() + (state?.snoozeMin ?? 20) * 60_000);
        setOpen(false);
        toast.error(e instanceof Error ? e.message : "종료 처리에 실패했습니다.");
      },
    });
  };

  if (!open) return null;
  const m = minutesSince(startedAt) ?? 0;
  const guardianLine = demo || state?.hasGuardian;

  return createPortal(
    <div className="fixed inset-0 z-[106] flex items-end justify-center bg-black/55 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6 sm:items-center" onClick={later}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="finish-prompt-heading"
        className="w-full max-w-sm rounded-3xl bg-card p-5 shadow-elev-3 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Timer className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-label font-bold text-primary">오늘 {minutesText(m)}째 운동 중</p>
            <h2 id="finish-prompt-heading" className="text-heading font-black text-foreground">
              운동을 끝낼까요?
            </h2>
          </div>
        </div>
        <p className="mt-3 text-body text-muted-foreground [text-wrap:pretty]">
          {guardianLine
            ? "운동이 끝났으면 눌러 주세요. 끝난 시각이 엄마 · 아빠에게 바로 알림으로 가요."
            : "운동이 끝났으면 눌러 주세요. 오늘 운동 시간이 그대로 기록돼요."}
        </p>
        <button
          type="button"
          onClick={done}
          disabled={finish.isPending}
          className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-title font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {finish.isPending ? "기록하는 중" : "운동 끝"}
        </button>
        <button
          type="button"
          onClick={later}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-muted text-body font-bold text-muted-foreground transition-transform active:scale-[0.98]"
        >
          아직 하는 중이에요 · {state?.snoozeMin ?? 20}분 뒤 다시
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default WorkoutFinishPrompt;
