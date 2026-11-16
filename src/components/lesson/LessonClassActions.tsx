/**
 * 📥 오늘 수업 담기 · 자율 운동 = 내 수업 — 훈련 탭 「오늘 할 것」 오늘 수업 카드 바로 아래 (2026-11-16 대표님 「추천대로진행」 · 보고서 5단계)
 *
 *   · 그날 153 수업 매뉴얼 동작이 있으면 「이 수업 내 수업에 담기」 — 영상(레벨 미션) · 라운드 그대로 새 내 수업 「153 수업 n일차」 → 편집 창.
 *     같은 이름의 수업이 이미 있으면 「담은 수업 열기」. 영상도 카드도 없는 동작(예: 기초 근력)은 빼고 담는다(lib/autoClass).
 *   · 오늘 출석했으면 「자율 운동 — 내 수업 열기」 · 수업이 없으면 「자율 운동 — 내 수업 짜기」(자동 짜기 창 · ?auto=1).
 *   감정 설계: 체육관에 온 날을 더 좋게(자율 운동 시간) · 수업에서 한 동작을 집에서 복습(확신). 안 온 날 · 못한 것은 말하지 않는다.
 *   서버에 내 수업 함수가 없으면(옛 DB 미리보기) 아무것도 안 그린다.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Play, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useLessonDays, useLessonToday } from "@/hooks/useLessonDays";
import { lessonClassName, lessonToClassItems, matchCardByName } from "@/lib/autoClass";
import { resolveDay } from "@/lib/lessonDays";
import { MAX_CLASSES } from "@/lib/myClass";
import { cardKey } from "@/lib/shelfLayout";
import { isMemberVisible } from "@/lib/trainingCards";
import { cn } from "@/lib/utils";
import { useMyClassActions, useMyClasses } from "@/services/myClassService";
import { useTrainingCards } from "@/services/trainingCardService";

const LessonClassActions = ({ className }: { className?: string }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: today } = useLessonToday();
  const { byDayNo } = useLessonDays();
  const classesQ = useMyClasses(user?.id ?? null, !!user);
  const cardsQ = useTrainingCards(!!user);
  const actions = useMyClassActions();
  const [busy, setBusy] = useState(false);

  const state = classesQ.data;
  if (!state?.available || !today) return null;
  const day = today.dayNo != null ? byDayNo.get(today.dayNo) : undefined;
  const steps = day ? resolveDay(day, byDayNo).steps : [];
  const name = day ? lessonClassName(day.dayNo) : "";
  const existing = day ? state.classes.find((c) => c.name === name) ?? null : null;
  const showLesson = !!day && steps.length > 0;
  const showFree = today.attendedToday;
  if (!showLesson && !showFree) return null;

  const openClass = (id: string) => navigate(`/missions?learn=1&shelf=mine&class=${id}`);

  const saveLesson = async () => {
    if (busy || !day) return;
    if (existing) {
      openClass(existing.id);
      return;
    }
    if (state.classes.length >= MAX_CLASSES) {
      toast.error(`내 수업은 ${MAX_CLASSES}개까지 만들 수 있어요`);
      return;
    }
    const cards = (cardsQ.data ?? []).filter(isMemberVisible).map((c) => ({ key: cardKey(c.id), name: c.name }));
    const { items, skipped } = lessonToClassItems(steps, (n) => matchCardByName(n, cards));
    if (items.length === 0) {
      toast.error("담을 수 있는 영상이 아직 없어요");
      return;
    }
    setBusy(true);
    try {
      const r = await actions.save({ id: null, name, items, shared: false });
      toast.success(`‘${name}’을 내 수업에 담았어요`, {
        description: skipped.length > 0 ? `영상 · 카드가 아직 없는 ${skipped.length}동작은 빼고 담았어요` : "집에서 ▶ 로 복습해요",
      });
      openClass(r.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const btn =
    "flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-3 text-body font-bold text-foreground transition-all active:scale-[0.99] disabled:opacity-50";

  const both = showLesson && showFree;
  return (
    <div className={cn("grid gap-2", both && "grid-cols-2", className)}>
      {showLesson && (
        <button type="button" onClick={() => void saveLesson()} disabled={busy} className={btn}>
          <Download className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{existing ? "담은 수업 열기" : busy ? "담는 중…" : both ? "오늘 수업 담기" : "이 수업 내 수업에 담기"}</span>
        </button>
      )}
      {showFree &&
        (state.classes.length > 0 ? (
          <button type="button" onClick={() => navigate("/missions?learn=1&shelf=mine")} className={btn}>
            <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden />
            <span className="truncate">{both ? "자율 운동 시작" : "자율 운동 — 내 수업 열기"}</span>
          </button>
        ) : (
          <button type="button" onClick={() => navigate("/missions?learn=1&auto=1")} className={btn}>
            <Wand2 className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{both ? "자율 운동 짜기" : "자율 운동 — 내 수업 짜기"}</span>
          </button>
        ))}
    </div>
  );
};

export default LessonClassActions;
