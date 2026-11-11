/**
 * 🥊 153 수업 템플릿 카드 — 전략 회의 › 오늘 프로그램 (내용은 lib/classTemplates 한 곳, 2026-11-11 대표님)
 *   코치님: 펼쳐서 흐름 · 대상 · 지도 원칙을 언제든 보기
 *   대표님 · 지점장님: 「이 템플릿으로 오늘 프로그램 만들기」 → 오늘 프로그램 시트가 템플릿으로 채워져 열린다
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOCK_LABEL } from "@/services/strategyService";
import { CLASS_TEMPLATES, classTemplateMinutes, type ClassTemplate } from "@/lib/classTemplates";

export default function ClassTemplateList({ canDirect, onUse }: { canDirect: boolean; onUse: (t: ClassTemplate) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <div className="rounded-3xl bg-card px-4 py-3 shadow-elev-1">
      <p className="text-[12.5px] font-black text-primary">153 수업 템플릿</p>
      <ul className="divide-y divide-border/70">
        {CLASS_TEMPLATES.map((t) => {
          const open = openId === t.id;
          return (
            <li key={t.id} className="py-2.5">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : t.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-black text-foreground">{t.title}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted-foreground">
                    {t.summary} · {classTemplateMinutes(t)}분
                  </span>
                </span>
                <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="mt-3 space-y-3">
                  <ol className="space-y-2">
                    {t.blocks.map((b, i) => (
                      <li key={i} className="rounded-2xl bg-secondary/60 px-3 py-2.5">
                        <p className="text-[12px] font-bold text-muted-foreground">
                          {i + 1}. {BLOCK_LABEL[b.kind]} · {b.minutes}분
                        </p>
                        <p className="mt-0.5 text-[14px] font-black text-foreground">{b.title}</p>
                        {b.note && <p className="mt-1 text-[13px] leading-relaxed text-foreground/80">{b.note}</p>}
                      </li>
                    ))}
                  </ol>
                  <p className="rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-[13px] leading-relaxed text-foreground">
                    <span className="font-black">대상</span> · {t.who}
                  </p>
                  <ul className="space-y-1.5">
                    {t.points.map((p, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-foreground">
                        <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        <span className="min-w-0">{p}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[12px] text-muted-foreground">분은 50분 수업 기준 어림이에요 — 라운드 수(2~3라운드)가 기준이고, 지점 타이머에 맞춰 고쳐요.</p>
                  {canDirect && (
                    <button
                      type="button"
                      onClick={() => onUse(t)}
                      className="flex h-11 w-full items-center justify-center rounded-2xl bg-foreground text-[14px] font-black text-background active:scale-[0.99]"
                    >
                      이 템플릿으로 오늘 프로그램 만들기
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
