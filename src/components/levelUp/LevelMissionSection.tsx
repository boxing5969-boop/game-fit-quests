/**
 * 🎯 이번 레벨 미션 칸 — 홈 「다음 레벨까지」 카드 안 (LevelUpRequestCard missions · 2026-11-16 대표님
 * 「홈화면에 … 다음 레벨로 가려면 얼마나 출석하면 될지? 또 어떤 미션을 달성하면 되는지 알려주자」)
 *
 *   · 번호 줄(타이틀미션 두 줄) · 목표 한 줄(영상이 아직 없는 레벨) · 미션 영상 줄 — 누르면 그 자리에서 재생 → 「따라했어요」
 *   · '따라했어요' 표시는 훈련 탭 「오늘의 영상」 · 「내 레벨 연습하기」와 같은 기기 저장(153_video_watched)
 *   · 못한 것은 세지 않는다 — 따라 한 미션에만 표시 (회원 감정 설계 기준 ③)
 *   · 무엇을 보일지는 lib/nextLevelGuide.ts (화면 없는 계산 · 시험)
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, CheckCircle2, Play } from "lucide-react";
import { OverlayMedia } from "@/components/common/VideoOverlay";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import type { LevelVideo } from "@/hooks/useLevelVideos";
import { overlayVariants } from "@/lib/missionVideos";
import type { MissionGuide } from "@/lib/nextLevelGuide";
import { cn } from "@/lib/utils";

interface Props {
  guide: MissionGuide;
  /** 이 레벨의 미션 영상 — 줄을 누르면 id 로 찾아 튼다 */
  videos: readonly LevelVideo[];
  /** 「따라했어요」 — 표시만 한다(이미 표시된 것을 풀지 않는다) */
  onDone: (id: string) => void;
}

const LevelMissionSection = ({ guide, videos, onDone }: Props) => {
  const [playing, setPlaying] = useState<{ video: LevelVideo; name: string } | null>(null);
  const close = () => setPlaying(null);
  // 뒤 화면 스크롤 잠금 · Esc · 휴대폰 뒤로가기 — 홈 당겨서 새로고침도 창이 열린 동안은 받지 않는다
  useModalDismiss(!!playing, close, { back: true });

  const open = (id: string, name: string) => {
    const video = videos.find((v) => v.id === id);
    if (video) setPlaying({ video, name });
  };

  return (
    <div className="mt-4 border-t border-border pt-4">
      <p className="text-label font-bold text-muted-foreground">{guide.heading}</p>

      {guide.steps.length > 1 ? (
        <ol className="mt-2 space-y-2">
          {guide.steps.map((s, i) => (
            <li key={s} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-reward/15 text-label font-bold text-reward"
              >
                {i + 1}
              </span>
              <span className="min-w-0 break-keep text-body text-foreground">{s}</span>
            </li>
          ))}
        </ol>
      ) : guide.steps.length === 1 ? (
        <p className="mt-1.5 break-keep text-body text-foreground">{guide.steps[0]}</p>
      ) : null}

      {guide.rows.length > 0 && (
        <ul className="-mx-2 mt-1.5">
          {guide.rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => open(row.id, row.name)}
                aria-label={`${row.name} 영상 보기${row.done ? " · 따라 했어요" : ""}`}
                className="flex h-12 w-full items-center gap-3 rounded-xl px-2 text-left transition-colors active:bg-muted/50"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    row.done ? "bg-status-complete/15 text-status-complete" : "bg-primary/10 text-primary",
                  )}
                >
                  {row.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-body font-bold text-foreground">{row.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* 영상 — body 로 띄워 카드 · 홈 어디서든 화면 기준으로 덮는다 */}
      {playing &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${playing.name} 영상`}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-4"
            onClick={close}
          >
            <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              {/* 실사 | 애니메이션 — 버전이 둘 이상이면 영상 아래에서 바꿔 본다 */}
              <OverlayMedia
                key={playing.video.id}
                url={playing.video.videoUrl}
                title={playing.video.title}
                variants={overlayVariants(playing.video.variants)}
              />
              <button
                type="button"
                onClick={() => {
                  onDone(playing.video.id);
                  close();
                }}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-bold text-primary-foreground active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden /> 따라했어요
              </button>
              <button
                type="button"
                onClick={close}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-neutral-800 text-body font-bold text-white ring-1 ring-white/10 active:scale-[0.98]"
              >
                닫기
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default LevelMissionSection;
