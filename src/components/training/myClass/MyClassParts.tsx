/**
 * 🎬 내 수업 조각 — 항목 그림 · 수업 카드 그림(네 칸) · 코치 한마디 · 스위치 (2026-11-14 2단계)
 *   회원 화면이라 글씨는 6단계 이름만(text-heading · body · label · micro).
 */
import type { ReactNode } from "react";
import { Film, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { noteWhen, type ClassNote } from "@/lib/myClass";
import { itemPoster, type PosterOf, type ResolvedItem } from "./useMyClassFlow";

/** 항목 그림 — 첫 장면, 없으면 칸 색 바탕에 칸 이름 · 영상이 있으면 ▶ */
export const ItemThumb = ({ item, posterOf, className, play = true }: { item: ResolvedItem | null; posterOf: PosterOf; className?: string; play?: boolean }) => {
  const src = itemPoster(item, posterOf);
  const color = item?.color ?? "#8B95A1";
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-xl", className)} style={{ backgroundColor: `${color}1A` }}>
      {src ? (
        <img src={src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color }}>
          <Film className="h-5 w-5" aria-hidden />
        </span>
      )}
      {play && item?.hasVideo && (
        <span className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60">
          <Play className="h-3 w-3 fill-white text-white" aria-hidden />
        </span>
      )}
    </span>
  );
};

/** 수업 카드 그림 — 담긴 카드 첫 장면 네 칸 */
export const ClassGrid = ({ items, posterOf, className }: { items: (ResolvedItem | null)[]; posterOf: PosterOf; className?: string }) => {
  const four = items.slice(0, 4);
  return (
    <span className={cn("grid shrink-0 grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-2xl bg-secondary p-1", className)} aria-hidden>
      {four.map((it, i) => (
        <ItemThumb key={i} item={it} posterOf={posterOf} play={false} className="h-full w-full rounded-lg" />
      ))}
      {Array.from({ length: Math.max(0, 4 - four.length) }).map((_, i) => (
        <span key={`e${i}`} className="rounded-lg bg-background/70" />
      ))}
    </span>
  );
};

const initial = (name: string) => (name.trim()[0] ?? "코").toUpperCase();

/** 코치 한마디 — 이름 직함 · 시각 · 글 (오래된 것부터) */
export const NoteList = ({ notes, onRemove, removing }: { notes: ClassNote[]; onRemove?: (id: string) => void; removing?: string | null }) => (
  <ul className="space-y-2.5">
    {notes.map((n) => (
      <li key={n.id} className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-label font-black text-primary">
          {n.by.avatarUrl ? <img src={n.by.avatarUrl} alt="" className="h-full w-full object-cover" /> : initial(n.by.name)}
        </span>
        <span className="min-w-0 flex-1 rounded-2xl bg-secondary px-3.5 py-2.5">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-label font-bold text-foreground">
              {n.by.name} {n.by.title}
            </span>
            <span className="shrink-0 text-micro text-muted-foreground">{noteWhen(n.at)}</span>
          </span>
          <span className="mt-0.5 block whitespace-pre-wrap break-words text-body text-foreground">{n.body}</span>
          {onRemove && n.mine && (
            <button
              type="button"
              disabled={removing === n.id}
              onClick={() => onRemove(n.id)}
              className="mt-1 text-label font-bold text-muted-foreground underline underline-offset-2 disabled:opacity-50"
            >
              지우기
            </button>
          )}
        </span>
      </li>
    ))}
  </ul>
);

/** 켜고 끄기 */
export const Switch = ({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!on)}
    className={cn(
      "relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50",
      on ? "bg-primary" : "bg-muted-foreground/30",
    )}
  >
    <span className={cn("absolute top-1 h-6 w-6 rounded-full bg-white shadow-elev-1 transition-all", on ? "left-7" : "left-1")} />
  </button>
);

/** 큰 단추 (시트 아래) */
export const BigButton = ({
  onClick,
  children,
  tone = "dark",
  disabled,
  className,
}: {
  onClick: () => void;
  children: ReactNode;
  tone?: "dark" | "light" | "primary";
  disabled?: boolean;
  className?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl text-body font-black transition-all active:scale-[0.99] disabled:opacity-50",
      tone === "dark" && "bg-foreground text-background",
      tone === "primary" && "bg-primary text-primary-foreground",
      tone === "light" && "border border-border bg-card text-foreground",
      className,
    )}
  >
    {children}
  </button>
);
