/**
 * 🌱 오늘의 1분 성장 교육 — 홈 (2026-10-27 대표님: "내가 공유한 정보를 복싱에 대입해서 오늘의 1분 성장 교육이라고 하고
 *   방향에 대해 알려주자")
 *   카드는 짧게(제목 · 한 줄) — 누르면 아래에서 1분 이야기 + '오늘의 방향' + 한 줄 다짐.
 *   '오늘 하나 해 볼게요'를 누르면 이 기기에 오늘 날짜로 남겨 카드에 '오늘 실천 약속' 표시 (서버에 쓰지 않는다).
 *   교육 내용은 data/growthLessons.ts 한 곳.
 */
import { useState } from "react";
import { Check, ChevronRight, Compass, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuth } from "@/contexts/AuthContext";
import { todayLesson } from "@/data/growthLessons";
import { kstToday } from "@/lib/attendanceCheer";
import { cn } from "@/lib/utils";

const doneKey = (uid: string, day: string, id: string) => `mb153.growth.done:${uid}:${day}:${id}`;
const readDone = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};

const GrowthLessonCard = ({ className }: { className?: string }) => {
  const { user } = useAuth();
  const today = kstToday();
  const lesson = todayLesson(today);
  const key = lesson ? doneKey(user?.id ?? "anon", today, lesson.id) : "";
  const [open, setOpen] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const done = justDone || (!!key && readDone(key));

  if (!lesson) return null;

  const promise = () => {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* 저장 못 하는 브라우저면 이 화면에서만 */
    }
    setJustDone(true);
    setOpen(false);
    toast.success("좋아요! 오늘의 방향 하나, 응원할게요");
  };

  return (
    <>
      <section
        aria-label="오늘의 1분 성장 교육"
        className={cn(
          "overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.12] via-card to-card shadow-elev-1",
          className,
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-start gap-3 p-4 text-left transition-transform active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Sprout className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[11.5px] font-black tracking-wide text-emerald-700 dark:text-emerald-400">
              오늘의 1분 성장 교육
              <span className="rounded-full bg-emerald-500/15 px-1.5 py-px text-[10px] font-black">1분</span>
            </span>
            <span className="mt-0.5 block text-[16px] font-black leading-snug text-foreground">{lesson.title}</span>
            <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">{lesson.hook}</span>
            <span className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-bold text-emerald-700 dark:text-emerald-400">
              {done ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden /> 오늘 실천 약속 완료 · 다시 보기
                </>
              ) : (
                <>
                  오늘의 방향 보기 <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </>
              )}
            </span>
          </span>
        </button>
      </section>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader className="pb-1 text-left">
            <p className="flex items-center gap-1.5 text-[12px] font-black text-emerald-700 dark:text-emerald-400">
              <Sprout className="h-4 w-4" aria-hidden /> 오늘의 1분 성장 교육 · {lesson.theme}
            </p>
            <DrawerTitle className="mt-1 text-[20px] font-black leading-snug">{lesson.title}</DrawerTitle>
            <DrawerDescription className="text-[13px]">{lesson.hook}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
            <div className="space-y-2.5">
              {lesson.story.map((p, i) => (
                <p key={i} className="text-[14.5px] leading-relaxed text-foreground">
                  {p}
                </p>
              ))}
            </div>

            <section aria-label="오늘의 방향" className="rounded-2xl bg-emerald-500/[0.08] p-3.5 ring-1 ring-inset ring-emerald-500/20">
              <p className="flex items-center gap-1.5 text-[14px] font-black text-foreground">
                <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden /> 오늘의 방향
              </p>
              <ol className="mt-2.5 space-y-2.5">
                {lesson.directions.map((d, i) => (
                  <li key={d.title} className="flex gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[12px] font-black text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-black leading-snug text-foreground">{d.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">{d.body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>

            <p className="rounded-2xl bg-foreground px-4 py-3.5 text-center text-[15px] font-black leading-snug text-background">
              {lesson.pledge}
            </p>

            {done ? (
              <p className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/10 text-[14px] font-bold text-emerald-700 dark:text-emerald-400">
                <Check className="h-4 w-4" aria-hidden /> 오늘 실천 약속 완료
              </p>
            ) : (
              <button
                type="button"
                onClick={promise}
                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-[14.5px] font-black text-white transition-transform active:scale-[0.98]"
              >
                오늘 하나 해 볼게요
              </button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default GrowthLessonCard;
