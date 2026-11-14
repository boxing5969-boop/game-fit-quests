/**
 * 🃏 영상으로 배우기 타일 그림 — 카드 · 레벨 미션 영상 · 묶음(폴더) (2026-11-14 정리 편집)
 *   화면 없는 계산은 lib/shelfLayout · 이 파일은 그림만. TrainingShelf(회원 · 코치진 · 대표님 편집)가 같이 쓴다.
 */
import type { ReactNode } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";

/** 타일 그림 — 첫 장면 · 그림, 없으면 칸 색 바탕에 칸 이름 */
export const Thumb = ({
  src,
  color,
  label,
  video,
  pinned,
  count,
  editing,
  children,
}: {
  src: string | null;
  color: string;
  label: string;
  video?: boolean;
  /** 대표님 편집 중 — 왼쪽 위 − 표시 자리를 비운다 */
  editing?: boolean;
  /** 맨 앞 고정 — 「추천」 */
  pinned?: boolean;
  /** 대표님 편집 — 지난 7일 연 회원 수 */
  count?: number | null;
  children?: ReactNode;
}) => (
  <div className="relative aspect-square w-full overflow-hidden" style={{ backgroundColor: `${color}14` }}>
    {src ? (
      <img
        src={src}
        alt=""
        loading="lazy"
        draggable={false}
        className="h-full w-full object-cover"
        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
      />
    ) : (
      <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-heading font-black" style={{ color }}>
        {label}
      </span>
    )}
    {video && (
      <span className={cn("absolute top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-micro font-bold text-white", editing ? "left-8" : "left-2")}>
        <Play className="h-3 w-3 fill-white" /> 영상
      </span>
    )}
    {pinned && <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-micro font-bold text-primary-foreground">추천</span>}
    {count != null && count > 0 && (
      <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-micro font-bold text-foreground shadow-elev-1">
        {count}명
      </span>
    )}
    {children}
  </div>
);

/** 묶음 그림 — 안의 카드 첫 장면 네 칸 (아이폰 폴더처럼) */
export const FolderThumb = ({
  items,
  pinned,
  count,
}: {
  items: { src: string | null; color: string; label: string }[];
  pinned?: boolean;
  count?: number | null;
}) => {
  const four = items.slice(0, 4);
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-secondary p-2.5">
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1.5">
        {four.map((it, i) => (
          <div key={i} className="relative overflow-hidden rounded-xl" style={{ backgroundColor: `${it.color}1f` }}>
            {it.src ? (
              <img src={it.src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-micro font-black" style={{ color: it.color }}>
                {it.label.slice(0, 3)}
              </span>
            )}
          </div>
        ))}
        {Array.from({ length: Math.max(0, 4 - four.length) }).map((_, i) => (
          <div key={`e${i}`} className="rounded-xl bg-background/60" />
        ))}
      </div>
      {pinned && <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-1 text-micro font-bold text-primary-foreground">추천</span>}
      {count != null && count > 0 && (
        <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-micro font-bold text-foreground shadow-elev-1">
          {count}명
        </span>
      )}
    </div>
  );
};

/** 편집 중 흐린 카드 위 표시 — 숨김 · 합침 */
export const FadeTag = ({ text, className }: { text: string; className?: string }) => (
  <span className={cn("absolute inset-x-2 bottom-2 truncate rounded-full bg-foreground/80 px-2 py-1 text-center text-micro font-bold text-background", className)}>
    {text}
  </span>
);
