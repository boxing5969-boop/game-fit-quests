/**
 * 📘 153 매뉴얼 — 카드 안의 글 · 목록 · 표 · 그림 · 영상 (읽기 화면 ManualReader 가 쓴다)
 *   표는 휴대폰 폭에서 줄마다 작은 상자로 바꿔 보인다(첫 칸 = 줄 제목, 나머지 = '머리글 · 내용')
 *   글 안의 **굵게** · *기울임* · [글](주소) · [12] 출처 번호만 알아본다 (HTML 은 그리지 않는다)
 *   2권(2026-11-13): 카드 영상(153 콘텐츠 카드 타일 → 카드 시트) · 순서 영상(수업 템플릿 영상) — 찾기 · 열기는 ManualReader 가 hooks 로
 */
import { Fragment, type ReactNode } from "react";
import { ChevronRight, Clapperboard, Dumbbell, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { manualImg, type ManualBlock } from "@/lib/coachManual/types";

/** 카드 영상 블록에 보일 것 — 읽기 화면(ManualReader)이 153 콘텐츠 카드에서 찾아 넘긴다 */
export interface ManualCardInfo {
  name: string;
  /** 칸 이름 · 색 (lib/trainingCards SHELF_INFO) */
  shelf: string;
  color: string;
  /** 첫 장면 그림(서명 주소) — 없으면 칸 색 네모 */
  poster: string | null;
  /** 코치용 또는 회원용 영상이 있다 */
  video: boolean;
}

export interface ManualBlockHooks {
  /** 카드 찾기 — undefined = 아직 불러오는 중 · null = 없는 카드(지운 카드) */
  card?: (cardId: string) => ManualCardInfo | null | undefined;
  onOpenCard?: (cardId: string) => void;
  /** 순서 영상이 들어 있나 — undefined = 불러오는 중 */
  tplReady?: (template: string, step: number) => boolean | undefined;
  onPlayTemplate?: (template: string, step: number, title: string) => void;
}

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
  hooks,
}: {
  block: ManualBlock;
  big: boolean;
  onPlay: (missionId: string, title: string) => void;
  hooks?: ManualBlockHooks;
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
    case "card":
      return <CardBlock cardId={block.cardId} caption={block.caption} big={big} hooks={hooks} />;
    case "tplvideo":
      return <TemplateVideoBlock block={block} hooks={hooks} />;
    default:
      return null;
  }
}

/** ▶ 카드 영상 — 카드 타일(첫 장면 · 이름 · 칸) → 누르면 카드 시트 */
function CardBlock({ cardId, caption, big, hooks }: { cardId: string; caption?: string; big: boolean; hooks?: ManualBlockHooks }) {
  const info = hooks?.card?.(cardId);
  if (info === null) return null; // 지운 카드 — 칸을 비우지 않고 건너뛴다
  const loading = info === undefined;
  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => hooks?.onOpenCard?.(cardId)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left active:scale-[0.99] disabled:opacity-60"
    >
      <span
        className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        style={{ backgroundColor: info?.color ?? "#E5E8EB" }}
      >
        {info?.poster ? (
          <img src={info.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <Dumbbell className="h-6 w-6 text-white" aria-hidden />
        )}
        {info?.video && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Play className="h-5 w-5 translate-x-0.5 fill-white text-white" aria-hidden />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-label font-bold" style={{ color: info?.color }}>
          {loading ? "카드" : `카드 영상 · ${info.shelf}`}
        </span>
        <span className={cn(big ? "text-heading" : "text-body", "block truncate font-black text-foreground")}>
          {loading ? "불러오는 중…" : info.name}
        </span>
        {caption && <span className="block truncate text-label text-muted-foreground">{caption}</span>}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

/** ▶ 순서 영상 — 수업 템플릿에 넣은 실제 수업 장면(코치진만 · 서명 주소) */
function TemplateVideoBlock({ block, hooks }: { block: Extract<ManualBlock, { t: "tplvideo" }>; hooks?: ManualBlockHooks }) {
  const ready = hooks?.tplReady?.(block.template, block.step);
  const off = ready === false;
  return (
    <button
      type="button"
      disabled={ready !== true}
      onClick={() => hooks?.onPlayTemplate?.(block.template, block.step, block.title)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left active:scale-[0.99] disabled:active:scale-100"
    >
      <span
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl",
          off ? "bg-secondary text-muted-foreground" : "bg-foreground text-background",
        )}
      >
        {off ? <Clapperboard className="h-6 w-6" aria-hidden /> : <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-label font-bold text-muted-foreground">
          {off ? "순서 영상 · 준비 중" : ready === undefined ? "순서 영상 · 불러오는 중…" : "순서 영상 · 실제 수업"}
        </span>
        <span className="block text-body font-black leading-snug text-foreground">{block.title}</span>
        {block.caption && <span className="block text-label text-muted-foreground">{block.caption}</span>}
      </span>
    </button>
  );
}
