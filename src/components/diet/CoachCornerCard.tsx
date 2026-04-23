import { MessageCircle, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoachCornerCardProps {
  /** 가장 최근 코치 노트 본문 (없으면 null) */
  latestNoteText: string | null;
  /** 노트 작성 시각 (ISO) */
  createdAt: string | null;
  /** 코치 노트가 아직 없을 때 보여줄 격려 기본 문구 */
  fallback?: string;
  className?: string;
}

/**
 * 코치 한마디 카드.
 *
 * 톤 규칙 — "한 번 놓쳐도 다음 끼니부터 다시 시작" 복귀형 카피 기본값.
 * 사용자 기분 저하 상황에서도 친절한 톤을 유지.
 */
export const CoachCornerCard = ({
  latestNoteText,
  createdAt,
  fallback = "한 끼 놓쳤다면 다음 끼니부터 다시 시작해요. 완벽보다 꾸준함이 이깁니다.",
  className,
}: CoachCornerCardProps) => {
  const hasNote = !!latestNoteText;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 space-y-2",
        hasNote
          ? "border-primary/25 bg-primary/5"
          : "border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            hasNote ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {hasNote ? <MessageCircle className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            오삼 코치님의 한마디
          </p>
          {createdAt && (
            <p className="text-[10px] text-muted-foreground">
              {new Date(createdAt).toLocaleDateString("ko-KR")}
            </p>
          )}
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-line">
        {latestNoteText ?? fallback}
      </p>
    </div>
  );
};

export default CoachCornerCard;
