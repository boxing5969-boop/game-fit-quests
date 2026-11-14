/**
 * 🎬 「카드 더 담기」 — 내 수업 편집 창에서 여는 고르기 (2026-11-14 2단계)
 *   칸 칩(대표님 정리 순서 그대로) · 찾기 · 줄마다 첫 장면 · 이름 · 칸 · 분 → 누르면 그 수업에 담긴다(창은 그대로 — 여러 장 연달아)
 *   회원: 회원에게 보이는 카드 + 레벨 미션 워밍업 영상(다음 리그 동작 포함) · 코치진: 숨긴 카드까지(흐리게)
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Search, X } from "lucide-react";
import { DmSheet } from "@/components/dm/DmParts";
import { cn } from "@/lib/utils";
import { cardMinutes, type Shelf } from "@/lib/trainingCards";
import { flattenLeaves, leafName, type ArrangedShelf, type ShelfLeaf, type TileKey } from "@/lib/shelfLayout";
import { MAX_ITEMS, MISSION_MINUTES } from "@/lib/myClass";
import { ItemThumb } from "./MyClassParts";
import type { MyClassFlow, PosterOf } from "./useMyClassFlow";

const norm = (s: string) => s.toLowerCase().replace(/[\s·\-_/()[\]]+/g, "");

const MyClassCardPicker = ({
  open,
  onClose,
  flow,
  sections,
  picked,
  count,
  posterOf,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  flow: MyClassFlow;
  sections: readonly ArrangedShelf[];
  picked: ReadonlySet<TileKey>;
  count: number;
  posterOf: PosterOf;
  onPick: (leaf: ShelfLeaf) => void;
}) => {
  const [tab, setTab] = useState<Shelf | null>(null);
  const [query, setQuery] = useState("");
  const current = sections.find((s) => s.id === tab) ?? sections[0] ?? null;
  const q = norm(query.trim());
  const leaves = useMemo(() => {
    if (q) {
      const seen = new Set<string>();
      const out: ShelfLeaf[] = [];
      for (const s of sections)
        for (const x of flattenLeaves([...s.tiles, ...s.upper])) {
          if (seen.has(x.key) || !norm(leafName(x)).includes(q)) continue;
          seen.add(x.key);
          out.push(x);
        }
      return out;
    }
    return current ? flattenLeaves([...current.tiles, ...current.upper]) : [];
  }, [q, sections, current]);
  const full = count >= MAX_ITEMS;
  if (typeof document === "undefined") return null;

  return createPortal(
    <DmSheet open={open} onClose={onClose} tall title="카드 더 담기" subtitle={full ? `${MAX_ITEMS}장이 다 찼어요` : `${count}/${MAX_ITEMS}장 — 누르면 담겨요`}>
      <label className="sticky top-0 z-10 flex h-11 items-center gap-2 rounded-2xl border border-border bg-background px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="동작 이름으로 찾기"
          aria-label="카드 찾기"
          className="min-w-0 flex-1 bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="찾기 지우기" className="text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      {!q && sections.length > 1 && (
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => {
            const on = s.id === current?.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setTab(s.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-label font-bold active:scale-95",
                  on ? "border-transparent text-white" : "border-border bg-background text-foreground",
                )}
                style={on ? { backgroundColor: s.color } : undefined}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      {leaves.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-secondary px-4 py-8 text-center text-body text-muted-foreground">{q ? "찾는 카드가 없어요" : "아직 카드가 없어요"}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {leaves.map((x) => {
            const has = picked.has(x.key);
            const r = flow.resolve(x.key);
            const muted = x.hidden || !!x.mergedInto;
            const minutes = x.kind === "card" ? cardMinutes(x.card) : MISSION_MINUTES;
            const label = x.kind === "card" ? r?.label ?? "" : "워밍업 영상";
            return (
              <li key={x.key} className={muted ? "opacity-60" : undefined}>
                <button
                  type="button"
                  disabled={has || full}
                  onClick={() => onPick(x)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl border p-2 text-left active:scale-[0.99] disabled:active:scale-100",
                    has ? "border-primary/40 bg-primary/5" : "border-border bg-background",
                    full && !has && "opacity-50",
                  )}
                >
                  <ItemThumb item={r} posterOf={posterOf} className="h-14 w-14" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-bold text-foreground">{leafName(x)}</span>
                    <span className="block truncate text-label text-muted-foreground">
                      {muted ? (x.mergedInto ? "합친 카드 · " : "회원에게 숨김 · ") : ""}
                      {label} · {minutes}분
                    </span>
                  </span>
                  {has ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-micro font-bold text-primary-foreground">
                      <Check className="h-3.5 w-3.5" aria-hidden /> 담김
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-border px-3 py-1.5 text-label font-bold text-foreground">담기</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </DmSheet>,
    document.body,
  );
};

export default MyClassCardPicker;
