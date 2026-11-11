/**
 * 🥊 153 수업 템플릿 카드 — 전략 회의 › 오늘 프로그램 (내용은 lib/classTemplates 한 곳, 2026-11-11 대표님)
 *   2026-11-12 대표님 「수업 탬플릿에 항상 글크기나 디자인은 늘 토스나 배달민족처럼 … 잘 보일 수 있게 · 각 순서마다 참고할 수 있는 영상」
 *   → 글씨 6단계(제목 24 · 순서 이름 19 · 설명 16) · 순서는 번호 줄(타임라인) · 순서마다 「참고 영상」 · 맨 위 「수업 요약 영상」
 *   코치님: 펼쳐서 흐름 · 영상 · 대상 · 지도 원칙을 보기
 *   대표님 · 지점장님: 「이 템플릿으로 오늘 프로그램 만들기」 → 오늘 프로그램 시트가 템플릿으로 채워져 열린다
 *   대표님: 순서마다 「참고 영상 넣기 · 바꾸기 · 빼기」(영상은 모든 지점 공통 — class_template_videos)
 */
import { Fragment, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Play, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOCK_LABEL } from "@/services/strategyService";
import type { ClassTemplateVideo } from "@/services/classTemplateVideoService";
import {
  CLASS_TEMPLATES,
  TEMPLATE_OVERVIEW_STEP,
  classTemplateMinutes,
  formatClipLength,
  templateVideoKey,
  type ClassTemplate,
} from "@/lib/classTemplates";

const CIRCLED: Record<string, string> = { "①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5" };

/** 동작 흐름 글 — 화살표는 민트, ① ② 는 동그라미 숫자 */
export const FlowText = ({ text }: { text: string }) => (
  <>
    {text.split(/(→|①|②|③|④|⑤)/).map((p, i) =>
      p === "→" ? (
        <span key={i} className="mx-0.5 text-primary" aria-hidden>
          →
        </span>
      ) : CIRCLED[p] ? (
        <span
          key={i}
          className="mx-0.5 inline-flex h-[1.15em] w-[1.15em] -translate-y-[0.08em] items-center justify-center rounded-full bg-foreground align-middle text-[0.68em] font-black leading-none text-background"
        >
          {CIRCLED[p]}
        </span>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      ),
    )}
  </>
);

interface Props {
  canDirect: boolean;
  isHq?: boolean;
  videos?: ClassTemplateVideo[];
  /** 올리는 중 · 빼는 중인 자리 (templateVideoKey) */
  busy?: string | null;
  onUse: (t: ClassTemplate) => void;
  onPlay?: (t: ClassTemplate, step: number, v: ClassTemplateVideo) => void;
  onAttach?: (t: ClassTemplate, step: number, file: File) => void;
  onClear?: (t: ClassTemplate, step: number) => void;
  /** 처음부터 펼쳐 둘 템플릿 (미리보기 · 알림 링크) */
  initialOpenId?: string | null;
}

export default function ClassTemplateList({ canDirect, isHq = false, videos = [], busy = null, onUse, onPlay, onAttach, onClear, initialOpenId = null }: Props) {
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ t: ClassTemplate; step: number } | null>(null);
  const byKey = useMemo(() => new Map(videos.map((v) => [templateVideoKey(v.template_id, v.step), v])), [videos]);

  const pick = (t: ClassTemplate, step: number) => {
    pending.current = { t, step };
    fileRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const p = pending.current;
          e.target.value = "";
          if (f && p && onAttach) onAttach(p.t, p.step, f);
        }}
      />
      {CLASS_TEMPLATES.map((t) => {
        const open = openId === t.id;
        const nVideos = [TEMPLATE_OVERVIEW_STEP, ...t.blocks.map((_, i) => i + 1)].filter((s) => byKey.has(templateVideoKey(t.id, s))).length;
        return (
          <section key={t.id} className="overflow-hidden rounded-3xl bg-card shadow-elev-1">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : t.id)}
              aria-expanded={open}
              className="flex w-full items-start gap-3 px-5 pb-4 pt-5 text-left active:bg-secondary/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-label font-black text-primary">153 수업 템플릿</span>
                <span className="mt-1 block text-title font-black leading-tight text-foreground">{t.title}</span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  <MetaChip>{classTemplateMinutes(t)}분</MetaChip>
                  <MetaChip>{t.blocks.length}단계</MetaChip>
                  {nVideos > 0 && (
                    <MetaChip tone="mint">
                      <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> 영상 {nVideos}
                    </MetaChip>
                  )}
                </span>
              </span>
              <ChevronDown className={cn("mt-1 h-6 w-6 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
            </button>

            {open ? (
              <div className="px-5 pb-5">
                <p className="text-body leading-relaxed text-muted-foreground">
                  <FlowText text={t.summary} />
                </p>

                {/* 수업 요약 영상 (step 0) */}
                <OverviewTile
                  t={t}
                  video={byKey.get(templateVideoKey(t.id, TEMPLATE_OVERVIEW_STEP)) ?? null}
                  isHq={isHq}
                  busy={busy === templateVideoKey(t.id, TEMPLATE_OVERVIEW_STEP)}
                  onPlay={onPlay}
                  onPick={() => pick(t, TEMPLATE_OVERVIEW_STEP)}
                  onClear={onClear}
                />

                <div className="mt-6 flex items-baseline justify-between">
                  <h3 className="text-heading font-black text-foreground">수업 순서</h3>
                  <span className="text-label font-bold text-muted-foreground">{classTemplateMinutes(t)}분 수업</span>
                </div>
                <ol className="mt-4">
                  {t.blocks.map((b, i) => {
                    const step = i + 1;
                    const key = templateVideoKey(t.id, step);
                    const v = byKey.get(key) ?? null;
                    const last = i === t.blocks.length - 1;
                    return (
                      <li key={i} className="flex gap-3.5">
                        <div className="flex flex-col items-center">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-body font-black text-primary-foreground">
                            {step}
                          </span>
                          {!last && <span className="mt-1 w-0.5 flex-1 rounded-full bg-border" aria-hidden />}
                        </div>
                        <div className={cn("min-w-0 flex-1", last ? "pb-1" : "pb-6")}>
                          <p className="pt-1.5 text-label font-bold text-muted-foreground">
                            {BLOCK_LABEL[b.kind]} · {b.minutes}분
                          </p>
                          <p className="mt-0.5 text-heading font-black leading-snug text-foreground">
                            <FlowText text={b.title} />
                          </p>
                          {b.note && (
                            <p className="mt-1.5 text-body leading-relaxed text-foreground/80">
                              <FlowText text={b.note} />
                            </p>
                          )}
                          <StepVideo
                            video={v}
                            isHq={isHq}
                            busy={busy === key}
                            onPlay={onPlay ? (x) => onPlay(t, step, x) : undefined}
                            onPick={() => pick(t, step)}
                            onClear={onClear ? () => onClear(t, step) : undefined}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 rounded-2xl bg-primary/10 px-4 py-4">
                  <p className="text-label font-black text-primary">누가 하나요</p>
                  <p className="mt-1 text-body leading-relaxed text-foreground">
                    <FlowText text={t.who} />
                  </p>
                </div>

                <h3 className="mt-6 text-heading font-black text-foreground">지도 원칙</h3>
                <ol className="mt-3 space-y-3">
                  {t.points.map((p, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-label font-black text-secondary-foreground">
                        {i + 1}
                      </span>
                      <span className="min-w-0 text-body leading-relaxed text-foreground">{p}</span>
                    </li>
                  ))}
                </ol>

                <p className="mt-5 text-label leading-relaxed text-muted-foreground">
                  분은 50분 수업 기준 어림이에요 — 라운드 수(2~3라운드)가 기준이고, 지점 타이머에 맞춰 고쳐요.
                </p>

                {canDirect && (
                  <button
                    type="button"
                    onClick={() => onUse(t)}
                    className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.99]"
                  >
                    이 템플릿으로 오늘 프로그램 만들기
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenId(t.id)}
                className="flex h-14 w-full items-center justify-center gap-1 border-t border-border/70 text-body font-bold text-foreground active:bg-secondary/40"
              >
                순서 · 영상 자세히 보기 ›
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}

const MetaChip = ({ children, tone = "gray" }: { children: React.ReactNode; tone?: "gray" | "mint" }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-label font-bold",
      tone === "mint" ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground",
    )}
  >
    {children}
  </span>
);

/** 맨 위 — 이 템플릿으로 한 실제 수업 요약 영상 */
const OverviewTile = ({
  t,
  video,
  isHq,
  busy,
  onPlay,
  onPick,
  onClear,
}: {
  t: ClassTemplate;
  video: ClassTemplateVideo | null;
  isHq: boolean;
  busy: boolean;
  onPlay?: (t: ClassTemplate, step: number, v: ClassTemplateVideo) => void;
  onPick: () => void;
  onClear?: (t: ClassTemplate, step: number) => void;
}) => {
  if (!video && !isHq) return null;
  if (!video) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onPick}
        className="mt-4 flex h-16 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border text-body font-bold text-muted-foreground active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Plus className="h-5 w-5" aria-hidden />}
        {busy ? "영상 올리는 중…" : "수업 요약 영상 넣기"}
      </button>
    );
  }
  const len = formatClipLength(video.seconds);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => onPlay?.(t, TEMPLATE_OVERVIEW_STEP, video)}
        className="flex w-full items-center gap-4 rounded-2xl bg-foreground px-4 py-4 text-left text-background active:scale-[0.99]"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-heading font-black">수업 요약 영상{len ? ` · ${len}` : ""}</span>
          <span className="mt-0.5 block text-label font-semibold opacity-75">{video.title || "이 템플릿으로 한 실제 수업 — 순서를 한 번에"}</span>
        </span>
      </button>
      {isHq && <HqLinks busy={busy} onPick={onPick} onClear={onClear ? () => onClear(t, TEMPLATE_OVERVIEW_STEP) : undefined} />}
    </div>
  );
};

/** 순서마다 — 참고 영상 단추 (대표님은 넣기 · 바꾸기 · 빼기) */
const StepVideo = ({
  video,
  isHq,
  busy,
  onPlay,
  onPick,
  onClear,
}: {
  video: ClassTemplateVideo | null;
  isHq: boolean;
  busy: boolean;
  onPlay?: (v: ClassTemplateVideo) => void;
  onPick: () => void;
  onClear?: () => void;
}) => {
  if (!video) {
    if (!isHq) return null;
    return (
      <button
        type="button"
        disabled={busy}
        onClick={onPick}
        className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-full border-2 border-dashed border-border px-4 text-body font-bold text-muted-foreground active:scale-[0.98] disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
        {busy ? "올리는 중…" : "참고 영상 넣기"}
      </button>
    );
  }
  const len = formatClipLength(video.seconds);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => onPlay?.(video)}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-body font-black text-primary-foreground active:scale-[0.98]"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden />
        참고 영상{len ? ` · ${len}` : ""}
      </button>
      {isHq && <HqLinks busy={busy} onPick={onPick} onClear={onClear} />}
    </div>
  );
};

const HqLinks = ({ busy, onPick, onClear }: { busy: boolean; onPick: () => void; onClear?: () => void }) => (
  <span className="mt-2 flex items-center gap-3 text-label font-bold text-muted-foreground">
    {busy ? (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> 바꾸는 중…
      </span>
    ) : (
      <>
        <button type="button" onClick={onPick} className="underline underline-offset-2 active:opacity-60">
          영상 바꾸기
        </button>
        {onClear && (
          <button type="button" onClick={onClear} className="underline underline-offset-2 active:opacity-60">
            빼기
          </button>
        )}
      </>
    )}
  </span>
);
