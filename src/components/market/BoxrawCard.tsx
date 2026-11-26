/**
 * 🥊 153 마켓 상품 목록 위 「BOXRAW 공식 앰버서더」 칸 (2026-11-26 대표님 「마이복서 153마켓에 복스로우 제품도 링크와 함께 넣어놓자」)
 *
 *   로고 + 「공식 앰버서더 체육관」 → 「복싱계의 명품 브랜드 BOXRAW」 한 줄 → 프로모션 코드(복사 단추) → 제품 가로 넘기기(누르면 공식몰 그 제품)
 *   → 분류 바로 가기 → 검은 단추 「BOXRAW 공식몰 바로 가기」(대표님이 준 전용 링크 그대로) → 샌드백 · 가격 안내 한 줄.
 *   공식몰로 가는 주소는 모두 전용 링크의 추적 값을 단다(data/boxraw.ts). 주문 · 결제는 공식몰에서 — 153 마켓 주문 흐름과 섞지 않는다.
 *   앰버서더 지점만(isBoxrawBranch) — MarketPage 가 고른다.
 */
import { useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { toast } from "sonner";

import {
  BOXRAW_CATEGORIES,
  BOXRAW_CODE,
  BOXRAW_COPY,
  BOXRAW_LINK,
  BOXRAW_PRODUCTS,
  boxrawUrl,
} from "@/data/boxraw";
import { cn } from "@/lib/utils";

const BoxrawCard = ({ className }: { className?: string }) => {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(BOXRAW_CODE);
      setCopied(true);
      setFallback(false);
      toast.success("프로모션 코드를 복사했어요");
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // 복사가 막힌 기기 — 코드를 길게 눌러 고를 수 있게 글자를 골라 두기만
      setFallback(true);
    }
  };

  return (
    <section aria-label="BOXRAW 공식 앰버서더" className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1", className)}>
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <img src="/market/boxraw/logo.svg" alt="BOXRAW" width={120} height={15} className="h-[15px] w-[120px] shrink-0" />
          <span className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-micro font-black leading-none text-background">
            {BOXRAW_COPY.badge}
          </span>
        </div>
        <p className="mt-3 text-body font-black leading-snug text-foreground">{BOXRAW_COPY.title}</p>
        <p className="mt-0.5 text-label leading-snug text-muted-foreground [text-wrap-style:balance]">{BOXRAW_COPY.line}</p>

        {/* 프로모션 코드 */}
        <div className="mt-3 rounded-xl border border-dashed border-foreground/25 bg-secondary/60 px-3.5 py-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-micro font-bold text-muted-foreground">{BOXRAW_COPY.codeLabel}</p>
              <p className={cn("mt-0.5 font-mono text-body font-black tracking-wide text-foreground", fallback && "select-all")}>{BOXRAW_CODE}</p>
            </div>
            <button
              type="button"
              onClick={copy}
              aria-label={`프로모션 코드 ${BOXRAW_CODE} 복사`}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-label font-bold text-background active:scale-95"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "복사됐어요" : "복사"}
            </button>
          </div>
          <p className="mt-1.5 text-micro leading-snug text-muted-foreground">
            {fallback ? "복사가 안 되는 기기예요. 코드를 길게 눌러 복사해 주세요" : BOXRAW_COPY.codeHow}
          </p>
        </div>
      </div>

      {/* 제품 가로 넘기기 — 누르면 공식몰 그 제품(새 창) */}
      <ul className="mt-3 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="BOXRAW 제품">
        {BOXRAW_PRODUCTS.map((p) => (
          <li key={p.id} className="w-[124px] shrink-0">
            <a
              href={boxrawUrl(p.path)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${p.name} — BOXRAW 공식몰에서 보기(새 창)`}
              className="block active:scale-[0.98]"
            >
              <span className="block aspect-[2/3] overflow-hidden rounded-xl bg-secondary">
                <img src={p.image} alt="" width={124} height={186} className="h-full w-full object-cover" loading="lazy" decoding="async" />
              </span>
              <span className="mt-1.5 block text-micro font-bold text-muted-foreground">{p.kind}</span>
              <span className="mt-0.5 line-clamp-2 block text-label font-bold leading-snug text-foreground">{p.name}</span>
            </a>
          </li>
        ))}
      </ul>

      {/* 분류 바로 가기 */}
      <div className="mt-2 flex flex-wrap gap-1.5 px-4" aria-label="BOXRAW 분류">
        {BOXRAW_CATEGORIES.map((c) => (
          <a
            key={c.path}
            href={boxrawUrl(c.path)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-full bg-secondary px-3.5 text-label font-bold text-secondary-foreground active:scale-95"
          >
            {c.label}
          </a>
        ))}
      </div>

      <div className="px-4 pb-4 pt-3">
        <a
          href={BOXRAW_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-foreground text-body font-bold text-background active:scale-[0.99]"
        >
          {BOXRAW_COPY.shop}
          <ArrowUpRight className="h-4 w-4" aria-hidden />
        </a>
        <p className="mt-2 text-center text-micro leading-snug text-muted-foreground [text-wrap-style:balance]">{BOXRAW_COPY.note}</p>
      </div>
    </section>
  );
};

export default BoxrawCard;
