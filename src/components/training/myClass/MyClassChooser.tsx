/**
 * 🎬 「어느 수업에 담을까요?」 — 카드 + · 카드 시트 「내 수업에 담기」 · 길게 누르기 (2026-11-14 2단계)
 *   수업마다 한 줄(이미 담긴 수업은 「담겼어요」) · 맨 아래 「+ 새 수업에 담기」
 */
import { createPortal } from "react-dom";
import { Check, Plus } from "lucide-react";
import { DmSheet } from "@/components/dm/DmParts";
import { cn } from "@/lib/utils";
import { MAX_CLASSES, MAX_ITEMS, classSummary } from "@/lib/myClass";
import { ClassGrid } from "./MyClassParts";
import type { MyClassFlow, PosterOf } from "./useMyClassFlow";

const MyClassChooser = ({ flow, posterOf }: { flow: MyClassFlow; posterOf: PosterOf }) => {
  const c = flow.chooser;
  if (typeof document === "undefined") return null;
  return createPortal(
    <DmSheet open={!!c} onClose={flow.closeChooser} title="어느 수업에 담을까요?" subtitle={c?.name}>
      <ul className="space-y-2">
        {flow.classes.map((cls) => {
          const has = !!c && cls.items.some((x) => x.k === c.key);
          const full = cls.items.length >= MAX_ITEMS;
          const avail = (k: string) => !!flow.resolve(k);
          return (
            <li key={cls.id}>
              <button
                type="button"
                disabled={has || full || flow.busy}
                onClick={() => void flow.pick(cls.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-all active:scale-[0.99] disabled:active:scale-100",
                  has ? "border-primary/40 bg-primary/5" : "border-border bg-background",
                  full && !has && "opacity-50",
                )}
              >
                <ClassGrid items={cls.items.map((x) => flow.resolve(x.k)).filter(Boolean)} posterOf={posterOf} className="h-14 w-14" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body font-bold text-foreground">{cls.name}</span>
                  <span className="block truncate text-label text-muted-foreground">
                    {full && !has ? `${MAX_ITEMS}장이 다 찼어요` : cls.items.length ? classSummary(cls.items, avail) : "아직 비어 있어요"}
                  </span>
                </span>
                {has ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-micro font-bold text-primary-foreground">
                    <Check className="h-3.5 w-3.5" aria-hidden /> 담겼어요
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-label font-bold text-background">담기</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {flow.classes.length < MAX_CLASSES && (
        <button
          type="button"
          disabled={flow.busy}
          onClick={() => void flow.pick(null)}
          className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border text-body font-bold text-foreground active:scale-[0.99] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> 새 수업에 담기
        </button>
      )}
    </DmSheet>,
    document.body,
  );
};

export default MyClassChooser;
