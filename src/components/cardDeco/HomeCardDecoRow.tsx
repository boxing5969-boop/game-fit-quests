/**
 * 홈 내 카드 바로 아래 한 줄 — 「카드 꾸미기」 · 「리뷰 미션 +n점」 (2026-11-21).
 * 두 시트(CardDecoSheet · ReviewMissionSheet)를 여기서 연다. 알림에서 온 주소 ?sheet=review · ?sheet=card-deco 도 여기서 열고 지운다.
 * 회원 카드에만(지도진 카드는 지도진 모양이 먼저라 꾸미기가 보이지 않는다).
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Palette, Star } from "lucide-react";

import CardDecoSheet, { type CardDecoPreview } from "@/components/cardDeco/CardDecoSheet";
import ReviewMissionSheet from "@/components/reviewMission/ReviewMissionSheet";
import { remainingMileage, useMyReviewMissions } from "@/services/reviewMissionService";
import { useMyCardDeco } from "@/services/cardDecoService";

const HomeCardDecoRow = ({ preview }: { preview: CardDecoPreview }) => {
  const [decoOpen, setDecoOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const { data: review } = useMyReviewMissions();
  const { data: deco } = useMyCardDeco();
  const { search, pathname } = useLocation();
  const navigate = useNavigate();

  // 알림 → ?sheet=review | card-deco
  useEffect(() => {
    const q = new URLSearchParams(search);
    const sheet = q.get("sheet");
    if (sheet !== "review" && sheet !== "card-deco") return;
    if (sheet === "review") setReviewOpen(true);
    else setDecoOpen(true);
    q.delete("sheet");
    const rest = q.toString();
    navigate(`${pathname}${rest ? `?${rest}` : ""}`, { replace: true });
  }, [search, pathname, navigate]);

  const left = remainingMileage(review);
  const showReview = !!review?.on && !review.allDone;
  const decorated = !!deco?.equipped;

  return (
    <>
      <div className={`grid gap-2 ${showReview ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={() => setDecoOpen(true)}
          className="flex h-12 items-center gap-2 rounded-2xl border border-border bg-card px-3.5 text-left active:scale-[0.99]"
        >
          <Palette className="h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate text-label font-black text-foreground">
            {decorated ? "내 카드 꾸미기" : "카드 꾸미기 · TV에도 떠요"}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        {showReview && (
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="flex h-12 items-center gap-2 rounded-2xl border border-reward/40 bg-reward/10 px-3.5 text-left active:scale-[0.99]"
          >
            <Star className="h-4 w-4 shrink-0 fill-current text-reward" />
            <span className="min-w-0 flex-1 truncate text-label font-black text-foreground">
              리뷰 미션 {left > 0 ? `+${left.toLocaleString("ko-KR")}점` : ""}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      </div>

      <CardDecoSheet
        open={decoOpen}
        onClose={() => setDecoOpen(false)}
        preview={preview}
        onOpenReview={
          review?.on
            ? () => {
                setDecoOpen(false);
                setReviewOpen(true);
              }
            : undefined
        }
      />
      <ReviewMissionSheet
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        onOpenDeco={() => {
          setReviewOpen(false);
          setDecoOpen(true);
        }}
      />
    </>
  );
};

export default HomeCardDecoRow;
