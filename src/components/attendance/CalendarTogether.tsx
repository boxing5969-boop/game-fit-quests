/**
 * 🤝 운동 달력 2-4단계 조각 — 일요일 주간 돌아보기 · 153과 함께한 시간 · 달 아래 '앨범 · 카드' 줄
 *   (2026-11-13 대표님 「시작하자」 — 「운동 달력 2단계 보고서」 2-4 · 글 · 계산은 lib/calendarTogether.ts)
 *   하나 넣으면 하나 접기: 주간 돌아보기가 보이는 일요일엔 약속 한 줄을 접고(다음 주 약속 한 줄이 여기 있다),
 *   153과 함께한 시간이 보이면 카드 머리의 첫 4주 칸을 접고, 앨범 · 카드 단추는 지난달 한 줄과 한 줄에 둔다.
 */
import { CalendarHeart, Images, Share2 } from "lucide-react";
import type { RenewalLine, WeekRecap } from "@/lib/calendarTogether";
import { cn } from "@/lib/utils";

/** 일요일 주간 돌아보기 — 잘한 것만 · 다음 주 약속 한 줄 (약속이 없으면 '약속 걸기', 있으면 '고치기') */
export const WeekRecapPanel = ({ recap, onPromise }: { recap: WeekRecap; onPromise?: () => void }) => (
  <section aria-label="이번 주 돌아보기" className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
    <p className="text-label font-bold text-primary">이번 주 돌아보기</p>
    <p className="mt-0.5 text-heading font-black tabular-nums text-foreground">{recap.title.replace(/^이번 주 /, "")}</p>
    {recap.facts.length > 0 && (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {recap.facts.map((f) => (
          <span key={f} className="rounded-full bg-card px-2.5 py-1 text-label font-bold tabular-nums text-foreground shadow-elev-1">
            {f}
          </span>
        ))}
      </div>
    )}
    <div className="mt-2 flex items-center justify-between gap-2">
      <p className="min-w-0 text-label font-bold text-foreground">{recap.next}</p>
      {onPromise && (
        <button
          type="button"
          onClick={onPromise}
          className="shrink-0 rounded-full bg-card px-3 py-1.5 text-label font-bold text-foreground shadow-elev-1 active:scale-95"
        >
          {recap.hasPromise ? "고치기" : "약속 걸기"}
        </button>
      )}
    </div>
  </section>
);

/** 재등록 즈음 '153과 함께한 시간' — 권유 문구 없이 가치만 */
export const RenewalBlock = ({ line }: { line: RenewalLine }) => (
  <div aria-label={line.title} className="mt-3 flex items-center gap-3 rounded-xl border border-reward/40 bg-reward/10 px-4 py-3">
    <CalendarHeart className="h-6 w-6 shrink-0 text-reward" aria-hidden />
    <span className="min-w-0 flex-1">
      <span className="block text-label font-bold text-foreground">{line.title}</span>
      <span className="block text-title font-black leading-tight tabular-nums text-foreground">{line.time}</span>
      <span className="block text-label text-muted-foreground">{line.since}</span>
    </span>
  </div>
);

/** 달 아래 한 줄 — 왼쪽 한 줄(지난달 돌아보기 등) · 오른쪽 '앨범 n' · '카드' */
export const MonthTools = ({
  text,
  gain,
  albumCount = 0,
  onAlbum,
  onCard,
  cardAria = "이번 달 운동 카드 만들기",
  className,
}: {
  text?: string | null;
  gain?: string | null;
  albumCount?: number;
  onAlbum?: () => void;
  onCard?: () => void;
  /** 카드 단추 읽기 글 — '11월 운동 카드 만들기' */
  cardAria?: string;
  className?: string;
}) => {
  const showAlbum = !!onAlbum && albumCount > 0;
  if (!text && !showAlbum && !onCard) return null;
  const pill = "inline-flex h-9 shrink-0 items-center gap-1 rounded-full border border-border bg-card px-3 text-label font-bold text-foreground active:scale-95";
  return (
    <div className={cn("mt-3 flex items-center justify-between gap-2 border-t border-border pt-3", className)}>
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {text && <span className="text-label font-bold tabular-nums text-foreground">{text}</span>}
        {gain && <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-micro font-bold tabular-nums text-primary">{gain}</span>}
      </p>
      <span className="flex shrink-0 items-center gap-1.5">
        {showAlbum && (
          <button type="button" onClick={onAlbum} className={pill} aria-label={`나의 153 앨범 사진 ${albumCount}장`}>
            <Images className="h-4 w-4 text-primary" aria-hidden />
            앨범 {albumCount}
          </button>
        )}
        {onCard && (
          <button type="button" onClick={onCard} className={pill} aria-label={cardAria}>
            <Share2 className="h-4 w-4 text-primary" aria-hidden />
            카드
          </button>
        )}
      </span>
    </div>
  );
};
