import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gem, Lock, Check, ShoppingBag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, usePurchaseItem } from "@/hooks/useWallet";
import { useAvatarCategories, useAvatarItems, useOwnedItems, useEquippedItems, useEquipItem, useUnequipItem } from "@/hooks/useAvatarItems";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const RARITY_COLORS: Record<string, string> = {
  common: "border-border",
  uncommon: "border-blue-400",
  rare: "border-primary",
  legendary: "border-accent",
};

const RARITY_LABELS: Record<string, string> = {
  common: "일반",
  uncommon: "고급",
  rare: "희귀",
  legendary: "전설",
};

const RARITY_BG: Record<string, string> = {
  common: "bg-muted/50",
  uncommon: "bg-blue-400/10",
  rare: "bg-primary/10",
  legendary: "bg-accent/10",
};

const RANK_ORDER_MAP: Record<string, number> = { white: 1, blue: 2, red: 3, black: 4 };

const AvatarPage = () => {
  const navigate = useNavigate();
  const { progress } = useAuth();
  const { data: wallet } = useWallet();
  const { data: categories } = useAvatarCategories();
  const [activeCategory, setActiveCategory] = useState("gloves");
  const { data: items } = useAvatarItems(activeCategory);
  const { data: ownedItems } = useOwnedItems();
  const { data: equippedItems } = useEquippedItems();
  const purchaseItem = usePurchaseItem();
  const equipItem = useEquipItem();
  const unequipItem = useUnequipItem();

  const ownedIds = new Set((ownedItems || []).map(o => o.item_id));
  const equippedMap = new Map((equippedItems || []).map(e => [e.category_code, e.item_id]));
  const currentRankOrder = progress ? RANK_ORDER_MAP[progress.current_rank] || 1 : 1;

  const handlePurchase = async (itemId: string, itemName: string) => {
    try {
      await purchaseItem.mutateAsync(itemId);
      toast.success(`${itemName} 구매 완료! 💎`);
    } catch (e: any) {
      toast.error(e.message || "구매 실패");
    }
  };

  const handleEquip = async (itemId: string, categoryCode: string) => {
    const isEquipped = equippedMap.get(categoryCode) === itemId;
    try {
      if (isEquipped) {
        await unequipItem.mutateAsync(categoryCode);
        toast.success("장착 해제!");
      } else {
        await equipItem.mutateAsync(itemId);
        toast.success("장착 완료! 🥊");
      }
    } catch (e: any) {
      toast.error(e.message || "장착 실패");
    }
  };

  const CATEGORY_ICONS: Record<string, string> = {
    gloves: "🥊",
    hair: "💇",
    top: "👕",
    bottom: "👖",
    shoes: "👟",
    accessory: "✨",
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
            <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
          </button>
          <h1 className="text-xl text-foreground">아이템 상점</h1>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1.5">
          <Gem className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold text-accent-foreground">{wallet?.gems_balance?.toLocaleString() || 0}</span>
        </div>
      </div>

      {/* Quick link to Character Studio */}
      <button
        onClick={() => navigate("/character-studio")}
        className="mb-4 w-full flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 active:scale-[0.98] transition-all"
      >
        <span className="text-lg">🎨</span>
        <div className="flex-1 text-left">
          <p className="text-sm font-bold text-foreground">캐릭터 스튜디오</p>
          <p className="text-[10px] text-muted-foreground">캐릭터 만들기 · 꾸미기 · 성장</p>
        </div>
        <span className="text-xs text-primary font-bold">이동 →</span>
      </button>

      {/* Equipped summary */}
      {equippedItems && equippedItems.length > 0 && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-xs font-bold text-foreground mb-2">현재 장착 아이템</p>
          <div className="flex flex-wrap gap-1.5">
            {equippedItems.map(eq => (
              <span key={eq.id} className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                {(eq as any).avatar_items?.name || "장착"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {(categories || []).map(cat => (
          <button
            key={cat.code}
            onClick={() => setActiveCategory(cat.code)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition-all active:scale-95 ${
              activeCategory === cat.code
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span>{CATEGORY_ICONS[cat.code] || "📦"}</span>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-2 gap-3">
        {(items || []).map(item => {
          const owned = ownedIds.has(item.id);
          const equipped = equippedMap.get(item.category_code) === item.id;
          const leagueReq = item.league_requirement ? RANK_ORDER_MAP[item.league_requirement] || 0 : 0;
          const locked = leagueReq > currentRankOrder;

          return (
            <div
              key={item.id}
              className={`relative rounded-2xl border-2 p-3 transition-all ${
                equipped ? "border-primary bg-primary/5 shadow-md" : RARITY_COLORS[item.rarity] + " " + RARITY_BG[item.rarity]
              }`}
            >
              {/* Rarity badge */}
              <div className="mb-2 flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  item.rarity === "legendary" ? "bg-accent/20 text-accent-foreground" :
                  item.rarity === "rare" ? "bg-primary/20 text-primary" :
                  item.rarity === "uncommon" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {RARITY_LABELS[item.rarity] || item.rarity}
                </span>
                {equipped && <Check className="h-4 w-4 text-primary" />}
              </div>

              {/* Item visual */}
              <div className="mb-2 flex h-16 items-center justify-center rounded-xl bg-background/50">
                {item.thumb_url ? (
                  <img src={item.thumb_url} alt={item.name} className="h-14 w-14 object-contain" />
                ) : (
                  <span className="text-3xl">{CATEGORY_ICONS[item.category_code] || "📦"}</span>
                )}
              </div>

              <h3 className="text-sm font-bold text-foreground truncate">{item.name}</h3>
              {item.description && (
                <p className="text-[10px] text-muted-foreground truncate">{item.description}</p>
              )}

              {/* Action */}
              <div className="mt-2">
                {locked ? (
                  <div className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    {item.league_requirement === "blue" ? "블루" : item.league_requirement === "red" ? "레드" : "블랙"} 리그 필요
                  </div>
                ) : owned ? (
                  <button
                    onClick={() => handleEquip(item.id, item.category_code)}
                    className={`w-full rounded-lg py-1.5 text-xs font-bold transition-all active:scale-95 ${
                      equipped
                        ? "bg-primary/20 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {equipped ? "장착 해제" : "장착하기"}
                  </button>
                ) : item.price_gems === 0 ? (
                  <button
                    onClick={() => handlePurchase(item.id, item.name)}
                    disabled={purchaseItem.isPending}
                    className="w-full rounded-lg bg-status-complete/20 py-1.5 text-xs font-bold text-status-complete transition-all active:scale-95"
                  >
                    무료 획득
                  </button>
                ) : (
                  <button
                    onClick={() => handlePurchase(item.id, item.name)}
                    disabled={purchaseItem.isPending || (wallet?.gems_balance || 0) < item.price_gems}
                    className="flex w-full items-center justify-center gap-1 rounded-lg bg-accent/20 py-1.5 text-xs font-bold text-accent-foreground transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Gem className="h-3 w-3" />
                    {item.price_gems}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(!items || items.length === 0) && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">이 카테고리에 아이템이 아직 없습니다</p>
          <p className="text-xs text-muted-foreground">관리자가 아이템을 추가할 예정입니다</p>
        </div>
      )}
    </div>
  );
};

export default AvatarPage;
