import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gem, Lock, Check, ChevronRight, ShoppingBag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWallet, usePurchaseItem } from "@/hooks/useWallet";
import { useAvatarCategories, useAvatarItems, useOwnedItems, useEquippedItems, useEquipItem, useUnequipItem } from "@/hooks/useAvatarItems";
import { PREBUILT_CHARACTERS } from "@/data/characterPresets";
import { toast } from "sonner";

const LEAGUE_SECTIONS = [
  { key: "white",  label: "화이트", icon: "🤍", bg: "from-white to-gray-100",            border: "border-gray-200",      text: "text-gray-700",   sub: "text-gray-400" },
  { key: "blue",   label: "블루",   icon: "💙", bg: "from-blue-50 to-blue-100",          border: "border-blue-200",      text: "text-blue-700",   sub: "text-blue-400" },
  { key: "red",    label: "레드",   icon: "❤️", bg: "from-red-50 to-red-100",            border: "border-red-200",       text: "text-red-700",    sub: "text-red-400" },
  { key: "black",  label: "블랙",   icon: "🖤", bg: "from-gray-800 to-gray-900",         border: "border-amber-400/40",  text: "text-amber-400",  sub: "text-amber-200/60" },
  { key: "legend", label: "전설",   icon: "👑", bg: "from-yellow-900/60 to-amber-800/40", border: "border-amber-400",    text: "text-amber-300",  sub: "text-amber-200/60" },
].map(s => ({
  ...s,
  count: s.key === "legend"
    ? PREBUILT_CHARACTERS.filter(c => c.requirement === "hall_of_fame").length
    : PREBUILT_CHARACTERS.filter(c => c.league === s.key && !c.requirement).length,
}));

const RARITY_BORDER: Record<string, string> = {
  common: "border-border", uncommon: "border-blue-400", rare: "border-primary", legendary: "border-accent",
};
const RARITY_BG: Record<string, string> = {
  common: "bg-muted/50", uncommon: "bg-blue-400/10", rare: "bg-primary/10", legendary: "bg-accent/10",
};
const RARITY_LABELS: Record<string, string> = {
  common: "일반", uncommon: "고급", rare: "희귀", legendary: "전설",
};
const RANK_ORDER: Record<string, number> = { white: 1, blue: 2, red: 3, black: 4 };
const CAT_ICONS: Record<string, string> = {
  gloves: "🥊", hair: "💇", top: "👕", bottom: "👖", shoes: "👟", accessory: "✨",
};

const AvatarPage = () => {
  const navigate = useNavigate();
  const { progress, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const { data: wallet } = useWallet();
  const { data: categories } = useAvatarCategories();
  const [activeCategory, setActiveCategory] = useState("gloves");
  const { data: items } = useAvatarItems(activeCategory);
  const { data: ownedItems } = useOwnedItems();
  const { data: equippedItems } = useEquippedItems();
  const purchaseItem = usePurchaseItem();
  const equipItem = useEquipItem();
  const unequipItem = useUnequipItem();
  const [purchaseConfirm, setPurchaseConfirm] = useState<{ id: string; name: string; price: number } | null>(null);

  const ownedIds = new Set((ownedItems || []).map(o => o.item_id));
  const equippedMap = new Map((equippedItems || []).map(e => [e.category_code, e.item_id]));
  const currentRankOrder = progress ? RANK_ORDER[progress.current_rank] || 1 : 1;
  const gemBalance = wallet?.gems_balance || 0;

  const handlePurchase = async (itemId: string, itemName: string) => {
    try {
      await purchaseItem.mutateAsync(itemId);
      toast.success(`${itemName} 획득! 💎`);
      setPurchaseConfirm(null);
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

  return (
    <>
      <div className="mx-auto max-w-lg pb-28">
        {/* Header */}
        <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md px-4 py-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95 transition-transform">
              <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
            <h1 className="text-lg font-bold text-foreground">아이템 상점</h1>
          </div>
        </div>

        {/* ─── Gem Balance Card ─────────────────────────────────── */}
        <div className="px-4 pt-4 pb-1">
          <div className="rounded-3xl bg-gradient-to-br from-accent/25 via-primary/15 to-accent/20 border border-accent/30 p-5 shadow-lg">
            <p className="text-xs font-medium text-muted-foreground mb-2">내 젬 잔액</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-accent/20 p-2.5">
                  <Gem className="h-6 w-6 text-accent" />
                </div>
                <span className="text-3xl font-black text-foreground tabular-nums">
                  {isAdmin ? "∞" : gemBalance.toLocaleString()}
                </span>
              </div>
              {!isAdmin && gemBalance < 200 && (
                <p className="text-[10px] text-muted-foreground text-right max-w-[120px] leading-tight">
                  퀘스트를 클리어해서<br />젬을 모아보세요!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── 캐릭터 Section ────────────────────────────────────── */}
        <div className="mt-6">
          <div className="flex items-center justify-between px-4 mb-3">
            <h2 className="text-sm font-black text-foreground">🎭 캐릭터</h2>
            <button
              onClick={() => navigate("/character-studio")}
              className="flex items-center gap-0.5 text-xs font-bold text-primary active:opacity-70 transition-opacity"
            >
              스튜디오 <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {LEAGUE_SECTIONS.map(section => (
              <button
                key={section.key}
                onClick={() => navigate("/character-studio")}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 rounded-2xl border-2 bg-gradient-to-b ${section.bg} ${section.border} p-4 w-[84px] active:scale-95 transition-all`}
              >
                <span className="text-2xl">{section.icon}</span>
                <span className={`text-xs font-black ${section.text}`}>{section.label}</span>
                <span className={`text-[10px] font-medium ${section.sub}`}>{section.count}종</span>
              </button>
            ))}
          </div>
        </div>

        {/* ─── 장착 중인 아이템 ──────────────────────────────────── */}
        {equippedItems && equippedItems.length > 0 && (
          <div className="mx-4 mt-5 rounded-2xl border border-border bg-card p-3 shadow-sm">
            <p className="text-xs font-bold text-foreground mb-2">현재 장착 중</p>
            <div className="flex flex-wrap gap-1.5">
              {equippedItems.map(eq => (
                <span key={eq.id} className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
                  {(eq as any).avatar_items?.name || "장착"}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ─── 꾸미기 아이템 Section ─────────────────────────────── */}
        <div className="mt-6">
          <div className="px-4 mb-3">
            <h2 className="text-sm font-black text-foreground">✨ 꾸미기 아이템</h2>
          </div>

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
            {(categories || []).map(cat => (
              <button
                key={cat.code}
                onClick={() => setActiveCategory(cat.code)}
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                  activeCategory === cat.code
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <span>{CAT_ICONS[cat.code] || "📦"}</span>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Items grid */}
          <div className="grid grid-cols-2 gap-3 px-4 mt-3">
            {(items || []).map(item => {
              const owned = ownedIds.has(item.id);
              const equipped = equippedMap.get(item.category_code) === item.id;
              const leagueReq = item.league_requirement ? RANK_ORDER[item.league_requirement] || 0 : 0;
              const locked = !isAdmin && leagueReq > currentRankOrder;

              return (
                <div
                  key={item.id}
                  className={`relative rounded-2xl border-2 overflow-hidden transition-all ${
                    equipped
                      ? "border-primary bg-primary/5 shadow-md"
                      : `${RARITY_BORDER[item.rarity]} ${RARITY_BG[item.rarity]}`
                  }`}
                >
                  <div className="flex items-center justify-between p-3 pb-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      item.rarity === "legendary" ? "bg-accent/20 text-accent-foreground" :
                      item.rarity === "rare"      ? "bg-primary/20 text-primary" :
                      item.rarity === "uncommon"  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {RARITY_LABELS[item.rarity] || item.rarity}
                    </span>
                    {equipped && <Check className="h-4 w-4 text-primary" />}
                  </div>

                  <div className="flex h-20 items-center justify-center">
                    {item.thumb_url ? (
                      <img src={item.thumb_url} alt={item.name} className="h-16 w-16 object-contain" loading="lazy" />
                    ) : (
                      <span className="text-4xl">{CAT_ICONS[item.category_code] || "📦"}</span>
                    )}
                  </div>

                  <div className="p-3 pt-1">
                    <h3 className="text-sm font-bold text-foreground truncate mb-2">{item.name}</h3>

                    {locked ? (
                      <div className="flex items-center justify-center gap-1 rounded-xl bg-muted py-2 text-xs text-muted-foreground font-bold">
                        <Lock className="h-3 w-3" />
                        {item.league_requirement === "blue" ? "블루" : item.league_requirement === "red" ? "레드" : "블랙"} 리그 필요
                      </div>
                    ) : owned ? (
                      <button
                        onClick={() => handleEquip(item.id, item.category_code)}
                        className={`w-full rounded-xl py-2 text-xs font-bold transition-all active:scale-95 ${
                          equipped ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                        }`}
                      >
                        {equipped ? "장착 해제" : "⚡ 장착하기"}
                      </button>
                    ) : item.price_gems === 0 ? (
                      <button
                        onClick={() => handlePurchase(item.id, item.name)}
                        disabled={purchaseItem.isPending}
                        className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-2 text-xs font-bold text-white active:scale-95 transition-all disabled:opacity-50"
                      >
                        🎁 무료 획득
                      </button>
                    ) : (
                      <button
                        onClick={() => setPurchaseConfirm({ id: item.id, name: item.name, price: item.price_gems })}
                        disabled={!isAdmin && gemBalance < item.price_gems}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-accent/80 to-primary/80 py-2 text-xs font-bold text-primary-foreground active:scale-95 transition-all disabled:opacity-40"
                      >
                        <Gem className="h-3 w-3" />
                        {item.price_gems.toLocaleString()}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {(!items || items.length === 0) && (
            <div className="mx-4 mt-3 rounded-2xl border border-dashed border-border p-8 text-center">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">준비 중인 아이템입니다</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── Purchase Confirm Modal ────────────────────────────── */}
      {purchaseConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => setPurchaseConfirm(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div
            className="relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-card p-6 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-foreground text-center mb-4">{purchaseConfirm.name}</h3>

            <div className="rounded-2xl bg-muted/50 p-4 mb-5 space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">가격</span>
                <span className="font-black">💎 {purchaseConfirm.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">현재 잔액</span>
                <span className="font-bold">{isAdmin ? "∞" : gemBalance.toLocaleString()}</span>
              </div>
              {!isAdmin && (
                <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                  <span className="text-muted-foreground">구매 후 잔액</span>
                  <span className={`font-bold ${gemBalance - purchaseConfirm.price < 0 ? "text-destructive" : "text-foreground"}`}>
                    {(gemBalance - purchaseConfirm.price).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setPurchaseConfirm(null)}
                disabled={purchaseItem.isPending}
                className="flex-1 rounded-2xl border border-border bg-secondary py-3.5 text-sm font-bold active:scale-95 transition-all disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={() => handlePurchase(purchaseConfirm.id, purchaseConfirm.name)}
                disabled={purchaseItem.isPending || (!isAdmin && gemBalance < purchaseConfirm.price)}
                className="flex-[2] rounded-2xl bg-gradient-to-r from-accent to-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-95 transition-all disabled:opacity-50"
              >
                {purchaseItem.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    구매 중...
                  </span>
                ) : (!isAdmin && gemBalance < purchaseConfirm.price) ? (
                  "젬 부족"
                ) : (
                  "💎 구매하기"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AvatarPage;
