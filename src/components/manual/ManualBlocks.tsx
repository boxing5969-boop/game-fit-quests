/**
 * 📘 153 매뉴얼 — 카드 안의 글 · 목록 · 표 · 그림 · 영상 (읽기 화면 ManualReader 가 쓴다)
 *   표는 휴대폰 폭에서 줄마다 작은 상자로 바꿔 보인다(첫 칸 = 줄 제목, 나머지 = '머리글 · 내용')
 *   글 안의 **굵게** · *기울임* · [글](주소) · [12] 출처 번호만 알아본다 (HTML 은 그리지 않는다)
 */
import { Fragment, type ReactNode } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { manualImg, type ManualBlock } from "@/lib/coachManual/types";

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*?\*|\[[^\]]+\]\((?:https?:\/\/)[^)\s]+\)|\[\d+\](?:\s?\[\d+\])*)/g;

/** 한 줄 글 → 굵게 · 기울임 · 링크 · 출처 번호 */
export function ManualInline({ text }: { text: string }) {
  const parts = text.split(TOKEN).filter((p) => p !== "");
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**") && p.length > 4)
          return (
            <strong key={i} className="font-black text-foreground">
              {p.slice(2, -2)}
            </strong>
          );
        const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(p);
        if (link)
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer noopener" className="font-bold text-primary underline underline-offset-2">
              {link[1]}
            </a>
          );
        if (/^\[\d+\](?:\s?\[\d+\])*$/.test(p))
          return (
            <span key={i} className="whitespace-nowrap font-bold text-muted-foreground">
              {p.replace(/\]\s?\[/g, "·")}
            </span>
          );
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2)
          return (
            <em key={i} className="not-italic text-muted-foreground">
              {p.slice(1, -1)}
            </em>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

const bodyCls = (big: boolean) => (big ? "text-heading font-normal leading-8" : "text-body leading-7");

export function ManualBlockView({
  block,
  big,
  onPlay,
}: {
  block: ManualBlock;
  big: boolean;
  onPlay: (missionId: string, title: string) => void;
}): ReactNode {
  switch (block.t) {
    case "p":
      return (
        <p className={cn(bodyCls(big), "text-foreground")}>
          <ManualInline text={block.text} />
        </p>
      );
    case "quote":
      return (
        <p className={cn(bodyCls(big), "rounded-2xl bg-secondary px-4 py-3 font-bold text-foreground")}>
          <ManualInline text={block.text} />
        </p>
      );
    case "ul":
      return (
        <ul className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className={cn(bodyCls(big), "flex gap-2.5 text-foreground")}>
              <span className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="min-w-0">
                <ManualInline text={it} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="space-y-2">
          {block.items.map((it, i) => (
            <li key={i} className={cn(bodyCls(big), "flex gap-2.5 text-foreground")}>
              <span className="mt-0.5 flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-secondary px-1.5 text-micro font-black tabular-nums text-foreground">
                {(block.start ?? 1) + i}
              </span>
              <span className="min-w-0 break-words">
                <ManualInline text={it} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="space-y-2">
          {block.rows.map((row, ri) => (
            <div key={ri} className="rounded-2xl bg-secondary/70 px-4 py-3">
              <p className={cn(big ? "text-heading" : "text-body", "font-black text-foreground")}>
                <ManualInline text={row[0] ?? ""} />
              </p>
              {row.slice(1).map((cell, ci) =>
                cell ? (
                  <div key={ci} className="mt-1.5">
                    {block.head.length > 2 && block.head[ci + 1] && (
                      <p className="text-label font-bold text-muted-foreground">{block.head[ci + 1]}</p>
                    )}
                    <p className={cn(big ? "text-heading font-normal leading-8" : "text-body leading-relaxed", "text-foreground")}>
                      <ManualInline text={cell} />
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          ))}
        </div>
      );
    case "image":
      return (
        <img
          src={manualImg(block.src)}
          alt={block.alt}
          loading="lazy"
          className="block aspect-[4/3] w-full rounded-2xl border border-border object-cover"
        />
      );
    case "video":
      return (
        <button
          type="button"
          onClick={() => onPlay(block.missionId, block.title)}
          className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left active:scale-[0.99]"
        >
          <span className="relative block aspect-video w-full bg-secondary">
            <img src={manualImg(block.poster)} alt="" loading="lazy" className="block h-full w-full object-cover" />
            <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55">
              <Play className="h-6 w-6 translate-x-0.5 fill-white text-white" aria-hidden />
            </span>
          </span>
          <span className="flex items-baseline justify-between gap-2 px-4 py-3">
            <span className="text-body font-black text-foreground">{block.title}</span>
            {block.caption && <span className="shrink-0 text-label font-bold text-primary">{block.caption}</span>}
          </span>
        </button>
      );
    default:
      return null;
  }
}
