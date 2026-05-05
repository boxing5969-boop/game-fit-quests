/**
 * 153 스토리 RPG — 인벤토리 패널 (단계 46).
 *
 * mode="battle": 사용 가능한 카드만 활성, 클릭 시 onUseCard
 * mode="browse": 카드 설명 표시만
 */

import { useMemo } from "react";
import { X } from "lucide-react";
import { useMyInventory, useStoryCards } from "@/hooks/useStoryRpg";
import type { StoryCardRarity } from "@/types/storyRpg";

const RARITY_BORDER: Record<StoryCardRarity, string> = {
  common: "border-zinc-500/40 bg-zinc-500/10",
  rare: "border-sky-400/50 bg-sky-500/10",
  epic: "border-violet-400/50 bg-violet-500/15",
  ending: "border-amber-400/60 bg-amber-500/20",
};

const RARITY_LABEL: Record<StoryCardRarity, string> = {
  common: "일반",
  rare: "레어",
  epic: "에픽",
  ending: "엔딩",
};

export interface StoryInventoryPanelProps {
  mode: "battle" | "browse";
  onUseCard?: (cardCode: string) => void;
  onClose?: () => void;
}

const StoryInventoryPanel = ({
  mode,
  onUseCard,
  onClose,
}: StoryInventoryPanelProps) => {
  const { data: inventory = [] } = useMyInventory();
  const { data: cards = [] } = useStoryCards();

  const cardMap = useMemo(() => {
    const m = new Map<string, (typeof cards)[number]>();
    cards.forEach((c) => m.set(c.code, c));
    return m;
  }, [cards]);

  const items = useMemo(
    () =>
      inventory
        .map((it) => ({ inv: it, card: cardMap.get(it.card_code) }))
        .filter((x): x is { inv: typeof inventory[0]; card: typeof cards[0] } => !!x.card)
        .sort((a, b) => {
          const order: StoryCardRarity[] = ["ending", "epic", "rare", "common"];
          return order.indexOf(a.card.rarity) - order.indexOf(b.card.rarity);
        }),
    [inventory, cardMap],
  );

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-gray-950/90 p-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
          내 카드 ({inventory.length})
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-gray-900/60 text-gray-300 hover:text-white"
            aria-label="닫기"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          아직 카드가 없습니다.
        </p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map(({ inv, card }) => {
            const usable =
              mode === "battle" && card.is_consumable && inv.count > 0;
            return (
              <li
                key={card.code}
                className={`relative rounded-xl border p-2 ${RARITY_BORDER[card.rarity]}`}
              >
                <span className="absolute right-1.5 top-1.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-mono text-amber-100">
                  ×{inv.count}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-wider text-amber-200/80">
                  {RARITY_LABEL[card.rarity]}
                </span>
                <p className="mt-0.5 text-[12px] font-black text-foreground">
                  {card.name}
                </p>
                <p className="mt-1 line-clamp-3 text-[10px] leading-snug text-muted-foreground">
                  {card.description}
                </p>
                {mode === "battle" && (
                  <button
                    type="button"
                    onClick={() => usable && onUseCard?.(card.code)}
                    disabled={!usable}
                    className="mt-2 w-full rounded-lg border border-amber-500/40 bg-amber-500/10 py-1 text-[10px] font-bold text-amber-100 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {card.is_consumable ? "사용" : "장식"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default StoryInventoryPanel;
