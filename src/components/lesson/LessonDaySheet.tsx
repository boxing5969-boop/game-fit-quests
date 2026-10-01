/**
 * 📋 하루치 수업 — 대표님 매뉴얼을 순서대로 (2026-09-30).
 *
 * 단계마다: 이름 · 라운드/세트(원문 그대로) · 동작 설명 · 주의할 점 · 한마디 · 153 영상.
 * "2일차 = 1일차 반복" 같은 날은 앞날 내용을 그대로 보여 주고 위에 반복이라고 알린다.
 * 아래 버튼으로 앞뒤 일차를 넘겨 본다 (코치님이 수업 전에 훑어보기 좋게).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Repeat2, Trophy, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useLevelVideosByIds } from "@/hooks/useLevelVideos";
import VideoOverlay, { type OverlayVideo } from "@/components/common/VideoOverlay";
import { overlayVariants } from "@/lib/missionVideos";
import {
  levelShort,
  resolveDay,
  todayHeadline,
  type LessonDay,
  type LessonStep,
  type LessonToday,
} from "@/lib/lessonDays";
import { cn } from "@/lib/utils";

interface Props {
  /** 열 날 — null 이면 닫힘 */
  day: LessonDay | null;
  byDayNo: ReadonlyMap<number, LessonDay>;
  today?: LessonToday | null;
  onClose: () => void;
  /** 앞뒤 일차로 넘기기 */
  onOpenDay: (dayNo: number) => void;
}

const StepCard = ({
  step,
  index,
  onPlay,
  versions,
  showNew,
}: {
  step: LessonStep;
  index: number;
  onPlay: (() => void) | null;
  /** 영상 버전 이름 (실사 · 애니메이션) — 2개 이상일 때만 버튼 옆에 적는다 */
  versions: string[];
  /** 반복하는 날에는 '새로 배워요'를 달지 않는다 (앞날에 이미 배웠다) */
  showNew: boolean;
}) => (
  <li className="rounded-2xl bg-secondary/55 p-3.5">
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[13px] font-black tabular-nums text-background">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <h4 className="text-[15px] font-bold leading-snug text-foreground">{step.name}</h4>
          {step.isNew && showNew && (
            <span className="rounded-md bg-reward/20 px-1.5 py-[1px] text-[10.5px] font-black text-reward">새로 배워요</span>
          )}
        </div>
        {step.amount && (
          <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-[12.5px] font-bold text-primary">
            {step.amount}
          </span>
        )}
        {step.how.length > 0 && (
          <ul className="mt-2 space-y-1">
            {step.how.map((line, i) => (
              <li key={i} className="flex gap-1.5 text-[13px] leading-relaxed text-foreground/85">
                <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-foreground/40" />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        )}
        {step.watch.length > 0 && (
          <div className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2">
            <p className="text-[11.5px] font-black text-amber-700 dark:text-amber-300">주의할 점</p>
            <ul className="mt-0.5 space-y-0.5">
              {step.watch.map((line, i) => (
                <li key={i} className="text-[12.5px] leading-relaxed text-amber-900 dark:text-amber-100/90">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
        {step.tip && <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">💡 {step.tip}</p>}
        {onPlay && (
          <button
            type="button"
            onClick={onPlay}
            className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[12.5px] font-bold text-foreground shadow-elev-1 active:scale-95"
          >
            <Play className="h-3.5 w-3.5 fill-current" /> 153 영상 보기
            {versions.length > 1 && (
              <span className="font-semibold text-muted-foreground">· {versions.join(" · ")}</span>
            )}
          </button>
        )}
      </div>
    </div>
  </li>
);

const LessonDaySheet = ({ day, byDayNo, today, onClose, onOpenDay }: Props) => {
  const open = !!day;
  useModalDismiss(open, onClose);
  const [playing, setPlaying] = useState<OverlayVideo | null>(null);
  const closeVideo = useCallback(() => setPlaying(null), []);
  // 시트가 닫히면(뒤로가기 포함) 틀어 둔 영상도 같이 닫는다
  useEffect(() => {
    if (!open) setPlaying(null);
  }, [open]);

  const resolved = useMemo(() => (day ? resolveDay(day, byDayNo) : null), [day, byDayNo]);
  const steps = useMemo(() => resolved?.steps ?? [], [resolved]);
  const videoIds = useMemo(
    () => [...new Set(steps.map((s) => s.videoMissionId).filter((v): v is string => !!v))],
    [steps],
  );
  const { data: videos = [] } = useLevelVideosByIds(videoIds);
  const videoById = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);

  const daysInLevel = useMemo(
    () => (day ? [...byDayNo.values()].filter((d) => d.level === day.level).length : 0),
    [day, byDayNo],
  );
  const prev = day ? byDayNo.get(day.dayNo - 1) : undefined;
  const next = day ? byDayNo.get(day.dayNo + 1) : undefined;
  const isToday = !!day && !!today && today.dayNo === day.dayNo;

  // body 로 띄운다 — 훈련 상세 화면처럼 transform 애니메이션이 걸린 부모 안에서도 화면 기준으로 덮게
  return createPortal(
    <>
      <AnimatePresence>
        {day && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`${day.dayNo}일차 수업`}
              className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-3xl bg-card shadow-elev-3 sm:rounded-3xl"
            >
              <div className="shrink-0 px-5 pb-2 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11.5px] font-bold text-muted-foreground">
                      {levelShort(day.level)} · {daysInLevel}일 중 {day.dayInLevel}일째
                    </span>
                    {isToday && today && (
                      <span className="rounded-full bg-primary px-2.5 py-0.5 text-[11.5px] font-black text-primary-foreground">
                        {todayHeadline(today)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95"
                    aria-label="닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div key={day.dayNo} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
                <p className="text-[30px] font-black leading-none tabular-nums text-foreground">{day.dayNo}일차</p>
                <h2 className="mt-1.5 text-[16px] font-bold leading-snug text-foreground">{day.title}</h2>
                {day.goal && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{day.goal}</p>}

                {resolved?.repeatOf && (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl bg-primary/10 px-3.5 py-2.5">
                    <Repeat2 className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-[13px] leading-snug text-foreground">
                      <b>{resolved.repeatOf.dayNo}일차와 같은 수업</b> — 아래 순서 그대로 해요
                    </p>
                  </div>
                )}
                <div className="h-3" />

                {steps.length === 0 ? (
                  <p className="rounded-2xl bg-muted/50 px-4 py-8 text-center text-[13px] text-muted-foreground">
                    이 날 수업 내용이 아직 없어요
                  </p>
                ) : (
                  <ol className="space-y-2.5">
                    {steps.map((s, i) => {
                      const v = s.videoMissionId ? videoById.get(s.videoMissionId) : undefined;
                      return (
                        <StepCard
                          key={`${day.dayNo}-${i}`}
                          step={s}
                          index={i}
                          showNew={!resolved?.repeatOf}
                          versions={v ? v.variants.map((x) => x.label) : []}
                          onPlay={
                            v
                              ? () => setPlaying({ url: v.videoUrl, title: v.title, variants: overlayVariants(v.variants) })
                              : null
                          }
                        />
                      );
                    })}
                  </ol>
                )}

                {day.note && (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl bg-reward/15 px-3.5 py-3">
                    <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-reward" />
                    <p className="text-[13px] font-bold leading-snug text-foreground">{day.note}</p>
                  </div>
                )}
                <p className="mt-3 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  라운드 수는 코치님이 그날 컨디션에 맞춰 조절할 수 있어요. 아프거나 불편하면 바로 코치님께 말해 주세요.
                </p>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border/70 px-5 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
                <button
                  type="button"
                  disabled={!prev}
                  onClick={() => prev && onOpenDay(prev.dayNo)}
                  className="flex h-11 items-center justify-center gap-1 rounded-xl bg-secondary text-[13px] font-bold text-foreground active:scale-[0.98] disabled:opacity-35"
                >
                  <ChevronLeft className="h-4 w-4" /> {prev ? `${prev.dayNo}일차` : "처음"}
                </button>
                <button
                  type="button"
                  disabled={!next}
                  onClick={() => next && onOpenDay(next.dayNo)}
                  className={cn(
                    "flex h-11 items-center justify-center gap-1 rounded-xl text-[13px] font-bold active:scale-[0.98] disabled:opacity-35",
                    next ? "bg-foreground text-background" : "bg-secondary text-foreground",
                  )}
                >
                  {next ? `${next.dayNo}일차` : "준비 중"} <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 153 영상 — 시트 위에 뜬다 */}
      <VideoOverlay video={playing} onClose={closeVideo} />
    </>,
    document.body,
  );
};

export default LessonDaySheet;
