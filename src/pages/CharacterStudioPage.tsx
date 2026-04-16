import { useState, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shuffle, Save, Check, Sparkles, Lock, ChevronRight, Crown, Gem, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PREBUILT_CHARACTERS, getRandomCharacter } from "@/data/characterPresets";
import { getCurrentMilestone, UNLOCK_MILESTONES } from "@/data/characterUnlockData";
import { useTemplatePresets, useAssignCharacter, useMemberCharacterAssignment, useSaveCustomization } from "@/hooks/useCharacterData";
import { useIsInHallOfFame } from "@/hooks/useRankingData";
import { useWallet, useSpendGems } from "@/hooks/useWallet";
import CharacterSprite from "@/components/CharacterSprite";
import RankBadge from "@/components/RankBadge";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import useEmblaCarousel from "embla-carousel-react";
import confetti from "canvas-confetti";
import { useOwnedSet, usePurchaseCustomization } from "@/hooks/useCustomizationPurchase";
import {
  CUSTOMIZATION_CATEGORIES,
  CUSTOMIZATION_LEAGUE_ORDER,
  EFFECT_EMOJIS,
  TITLE_LABELS,
  AURA_PREVIEW_GRADIENTS,
  type CharacterCustomization,
  type CustomizationOption,
} from "@/data/characterCustomizationData";

const TABS = [
  { key: "my", label: "내 캐릭터", icon: "🥊" },
  { key: "preset", label: "프리셋 선택", icon: "🎭" },
  { key: "customize", label: "꾸미기", icon: "🎨" },
  { key: "gym", label: "나의 짐", icon: "🏠" },
  { key: "growth", label: "성장", icon: "📈" },
  { key: "effects", label: "효과", icon: "✨" },
] as const;

const FILTER_TABS = [
  { key: "white",  label: "화이트", icon: "🤍" },
  { key: "blue",   label: "블루",   icon: "💙" },
  { key: "red",    label: "레드",   icon: "❤️" },
  { key: "black",  label: "블랙",   icon: "🖤" },
  { key: "legend", label: "전설",   icon: "👑" },
] as const;

const LEAGUE_ORDER: Record<string, number> = { white: 0, blue: 1, red: 2, black: 3 };

const LEAGUE_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const LEAGUE_COLORS: Record<string, string> = {
  white: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-700",
  black: "bg-gray-900 text-amber-400",
};

const CharacterStudioPage = () => {
  const navigate = useNavigate();
  const { user, progress, role } = useAuth();
  const { data: assignment } = useMemberCharacterAssignment();
  const { data: templatePresets } = useTemplatePresets();
  const { data: walletData } = useWallet();
  const assignCharacter = useAssignCharacter();
  const saveCustomization = useSaveCustomization();
  const { data: isInHallOfFame = false } = useIsInHallOfFame();
  const isAdmin = role === "admin" || role === "super_admin";
  const ownedSet = useOwnedSet();
  const purchaseCustomization = usePurchaseCustomization();

  const currentPartsJson = (assignment?.character_presets as any)?.parts_json;
  const currentStyle = currentPartsJson?.style;
  const currentCustomization: CharacterCustomization = currentPartsJson?.customization || {};
  const currentLeague = (progress?.current_rank || "white") as string;
  const currentLevel = progress?.current_level || 1;

  const { current: currentMilestone, next: nextMilestone } = useMemo(
    () => getCurrentMilestone(currentLeague, currentLevel),
    [currentLeague, currentLevel]
  );

  const [activeTab, setActiveTab] = useState<string>("my");
  const [selectedStyle, setSelectedStyle] = useState<string>(currentStyle || "male_01");
  const [activeFilter, setActiveFilter] = useState<string>("white");
  const [pendingCustomization, setPendingCustomization] = useState<CharacterCustomization>(currentCustomization);

  // Sync pendingCustomization when DB data loads (assignment is async)
  useEffect(() => {
    if (currentPartsJson?.customization) {
      setPendingCustomization(currentPartsJson.customization);
    }
  }, [currentPartsJson?.customization]);

  // Sync selectedStyle when DB data loads
  useEffect(() => {
    if (currentStyle) setSelectedStyle(currentStyle);
  }, [currentStyle]);

  const currentGymLayout: GymLayout = currentPartsJson?.gymLayout || {};
  const [pendingGymLayout, setPendingGymLayout] = useState<GymLayout>(currentGymLayout);

  useEffect(() => {
    if (currentPartsJson?.gymLayout) {
      setPendingGymLayout(currentPartsJson.gymLayout);
    }
  }, [currentPartsJson?.gymLayout]);

  const spendGems = useSpendGems();
  const [purchaseModal, setPurchaseModal] = useState<typeof PREBUILT_CHARACTERS[0] | null>(null);
  const [isProcessingPurchase, setIsProcessingPurchase] = useState(false);

  const [ownedStyles, setOwnedStyles] = useState<Set<string>>(() => {
    const freeStyles = PREBUILT_CHARACTERS.filter(c => c.price === 0).map(c => c.style);
    try {
      const stored = JSON.parse(localStorage.getItem(`owned_chars_${user?.id || "guest"}`) || "[]") as string[];
      return new Set([...freeStyles, ...stored, ...(currentStyle ? [currentStyle] : [])]);
    } catch {
      return new Set(freeStyles);
    }
  });

  const markOwned = useCallback((style: string) => {
    setOwnedStyles(prev => {
      const next = new Set(prev);
      next.add(style);
      try {
        localStorage.setItem(`owned_chars_${user?.id || "guest"}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, [user?.id]);

  const handleApplyStyle = useCallback(async (style: string) => {
    if (!user?.id) return;
    setSelectedStyle(style);
    try {
      const matchingTemplate = (templatePresets || []).find(p => (p.parts_json as any)?.style === style);
      if (matchingTemplate) {
        await assignCharacter.mutateAsync({ userId: user.id, presetId: matchingTemplate.id });
      } else {
        const partsJson = { style } as any;
        const { data: existing } = await supabase.from("character_presets").select("id").eq("created_by", user.id).eq("is_template", false).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        let presetId: string;
        if (existing) {
          const { error } = await supabase.from("character_presets").update({ parts_json: partsJson, updated_at: new Date().toISOString() }).eq("id", existing.id);
          if (error) throw error;
          presetId = existing.id;
        } else {
          const { data: newPreset, error } = await supabase.from("character_presets").insert({ name: `${user.id}_preset`, parts_json: partsJson, created_by: user.id, is_template: false }).select().single();
          if (error) throw error;
          presetId = newPreset.id;
        }
        await assignCharacter.mutateAsync({ userId: user.id, presetId });
      }
    } catch (e: any) {
      toast.error(e.message || "저장 실패");
    }
  }, [user?.id, templatePresets, assignCharacter]);

  const handleConfirmPurchase = async () => {
    if (!purchaseModal || !user?.id) return;
    const char = purchaseModal;
    setIsProcessingPurchase(true);
    try {
      if (!isAdmin && char.price > 0) {
        await spendGems.mutateAsync(char.price);
      }
      markOwned(char.style);
      setPurchaseModal(null);
      await handleApplyStyle(char.style);
      toast.success(`${char.label} 획득! 🎉`);
    } catch (e: any) {
      toast.error(e.message || "구매 실패");
    } finally {
      setIsProcessingPurchase(false);
    }
  };

  const filteredCharacters = (() => {
    switch (activeFilter) {
      case "legend": return PREBUILT_CHARACTERS.filter(c => c.requirement === "hall_of_fame");
      case "black":  return PREBUILT_CHARACTERS.filter(c => c.league === "black" && !c.requirement);
      case "white": case "blue": case "red":
        return PREBUILT_CHARACTERS.filter(c => c.league === activeFilter);
      default: return PREBUILT_CHARACTERS;
    }
  })();

  const selectedChar = PREBUILT_CHARACTERS.find(c => c.style === selectedStyle) || PREBUILT_CHARACTERS[0];

  const handleSelectPreset = useCallback((style: string) => {
    setSelectedStyle(style);
  }, []);

  const handleRandomize = useCallback(() => {
    const random = getRandomCharacter();
    setSelectedStyle(random.style);
  }, []);

  const handleRevert = useCallback(() => {
    if (currentStyle) setSelectedStyle(currentStyle);
  }, [currentStyle]);

  const handleSavePreset = async () => {
    if (!user?.id) return;

    try {
      // DB 템플릿에서 먼저 찾기
      const matchingTemplate = (templatePresets || []).find(p => {
        const pj = p.parts_json as any;
        return pj?.style === selectedStyle;
      });

      if (matchingTemplate) {
        // 템플릿이 있으면 바로 배정
        await assignCharacter.mutateAsync({ userId: user.id, presetId: matchingTemplate.id });
      } else {
        // 템플릿이 없으면 (새 AI 캐릭터 등) 개인 프리셋으로 생성 후 배정
        const partsJson = { style: selectedStyle } as any;

        const { data: existing } = await supabase
          .from("character_presets")
          .select("id")
          .eq("created_by", user.id)
          .eq("is_template", false)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let presetId: string;

        if (existing) {
          const { error } = await supabase
            .from("character_presets")
            .update({ parts_json: partsJson, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (error) throw error;
          presetId = existing.id;
        } else {
          const { data: newPreset, error } = await supabase
            .from("character_presets")
            .insert({ name: `${user.id}_preset`, parts_json: partsJson, created_by: user.id, is_template: false })
            .select()
            .single();
          if (error) throw error;
          presetId = newPreset.id;
        }

        await assignCharacter.mutateAsync({ userId: user.id, presetId });
      }

      toast.success("내 캐릭터가 저장되었습니다! 🥊");
    } catch (e: any) {
      toast.error(e.message || "저장 실패");
    }
  };

  const handleSaveCustomization = async () => {
    if (!user?.id) return;
    try {
      await saveCustomization.mutateAsync({
        style: selectedStyle,
        customization: pendingCustomization,
        gymLayout: pendingGymLayout,
      });
      toast.success("꾸미기가 저장되었습니다! 🎨");
    } catch (e: any) {
      toast.error(e.message || "저장 실패");
    }
  };

  const handleSaveGymLayout = async () => {
    if (!user?.id) return;
    try {
      await saveCustomization.mutateAsync({
        style: selectedStyle,
        customization: pendingCustomization,
        gymLayout: pendingGymLayout,
      });
      toast.success("나의 짐이 저장되었습니다! 🏠");
    } catch (e: any) {
      toast.error(e.message || "저장 실패");
    }
  };

  const isSaving = assignCharacter.isPending || saveCustomization.isPending;
  const isCurrentPreset = currentStyle === selectedStyle;

  const previewCustomization = activeTab === "customize" ? pendingCustomization : currentCustomization;

  return (
    <>
    <div className="mx-auto max-w-lg pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95 transition-transform">
              <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
            <h1 className="text-lg font-bold text-foreground">캐릭터 스튜디오</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full bg-accent/20 px-2.5 py-1">
              <Gem className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-bold text-accent-foreground">{isAdmin ? "∞" : walletData?.gems_balance?.toLocaleString() || 0}</span>
            </div>
            {activeTab === "preset" && (
              <>
                {currentStyle && selectedStyle !== currentStyle && (
                  <button onClick={handleRevert} className="rounded-full bg-secondary p-2 active:scale-95 transition-transform">
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                <button onClick={handleRandomize} className="rounded-full bg-secondary p-2 active:scale-95 transition-transform">
                  <Shuffle className="h-4 w-4 text-muted-foreground" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="px-4 pt-4">
        <div className="relative rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-5 shadow-sm">
          <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            <CharacterSprite
              style={selectedStyle}
              userId={user?.id}
              size="lg"
              animate={activeTab !== "customize"}
              league={currentLeague as any}
              level={currentLevel}
              customization={previewCustomization}
              className="relative z-10 !w-40 !h-40"
            />
          </div>
          <div className="mt-2 text-center">
            <p className="text-base font-bold text-foreground">{selectedChar.label}</p>
            <div className="mt-1.5 flex items-center justify-center gap-2">
              <RankBadge rank={currentLeague as Enums<"rank_name">} level={currentLevel} size="sm" />
              {currentMilestone && (
                <span className="text-[10px] text-muted-foreground">
                  {currentMilestone.icon} {currentMilestone.label}
                </span>
              )}
            </div>
          </div>
          {activeTab === "preset" && (
            <button
              onClick={handleSavePreset}
              disabled={isSaving || isCurrentPreset}
              className={`absolute top-3 right-3 rounded-full px-3 py-1.5 text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 ${
                isCurrentPreset
                  ? "bg-status-complete/20 text-status-complete"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              {isSaving ? "..." : isCurrentPreset ? (
                <span className="flex items-center gap-1"><Check className="h-3 w-3" /> 적용됨</span>
              ) : (
                <span className="flex items-center gap-1"><Save className="h-3 w-3" /> 저장</span>
              )}
            </button>
          )}
          {(activeTab === "customize" || activeTab === "gym") && (
            <button
              onClick={activeTab === "gym" ? handleSaveGymLayout : handleSaveCustomization}
              disabled={isSaving}
              className="absolute top-3 right-3 rounded-full px-3 py-1.5 text-xs font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 bg-primary text-primary-foreground"
            >
              {isSaving ? "..." : (
                <span className="flex items-center gap-1"><Save className="h-3 w-3" /> 저장</span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mt-4">
        <div className="flex rounded-2xl border border-border bg-secondary/50 p-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] font-bold transition-all whitespace-nowrap min-w-0 ${
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <span className="text-[10px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 mt-4">
        {activeTab === "my" && (
          <MyCharacterTab
            currentStyle={currentStyle}
            league={currentLeague}
            level={currentLevel}
            navigate={navigate}
            currentMilestone={currentMilestone}
            nextMilestone={nextMilestone}
            currentCustomization={currentCustomization}
          />
        )}
        {activeTab === "preset" && (
          <PresetTab
            filteredCharacters={filteredCharacters}
            selectedStyle={selectedStyle}
            currentStyle={currentStyle}
            activeFilter={activeFilter}
            setActiveFilter={setActiveFilter}
            currentLeague={currentLeague}
            isInHallOfFame={isInHallOfFame}
            isAdmin={isAdmin}
            ownedStyles={ownedStyles}
            walletBalance={walletData?.gems_balance || 0}
            onSelect={handleSelectPreset}
            onApply={async (char) => { markOwned(char.style); await handleApplyStyle(char.style); toast.success(`${char.label} 적용! 🥊`); }}
            onPurchaseClick={(char) => setPurchaseModal(char)}
          />
        )}
        {activeTab === "customize" && (
          <CustomizeTab
            customization={pendingCustomization}
            onChange={setPendingCustomization}
            league={currentLeague}
            isAdmin={isAdmin}
            isInHallOfFame={isInHallOfFame}
            ownedSet={ownedSet}
            walletBalance={walletData?.gems_balance || 0}
            purchaseCustomization={purchaseCustomization}
          />
        )}
        {activeTab === "gym" && (
          <GymTab
            currentStyle={selectedStyle}
            userId={user?.id}
            league={currentLeague}
            isAdmin={isAdmin}
            isInHallOfFame={isInHallOfFame}
            ownedSet={ownedSet}
            walletBalance={walletData?.gems_balance || 0}
            purchaseCustomization={purchaseCustomization}
            gymLayout={pendingGymLayout}
            onLayoutChange={setPendingGymLayout}
          />
        )}
        {activeTab === "growth" && <GrowthTab league={currentLeague} level={currentLevel} />}
        {activeTab === "effects" && <EffectsTab league={currentLeague} level={currentLevel} />}
      </div>
    </div>
    {purchaseModal && (
      <PurchaseConfirmModal
        char={purchaseModal}
        walletBalance={walletData?.gems_balance || 0}
        isAdmin={isAdmin}
        isPurchasing={isProcessingPurchase}
        onConfirm={handleConfirmPurchase}
        onCancel={() => setPurchaseModal(null)}
      />
    )}
    </>
  );
};

// ========== MY CHARACTER TAB ==========
function MyCharacterTab({ currentStyle, league, level, navigate, currentMilestone, nextMilestone, currentCustomization }: {
  currentStyle?: string;
  league: string;
  level: number;
  navigate: (path: string) => void;
  currentMilestone: any;
  nextMilestone: any;
  currentCustomization: CharacterCustomization;
}) {
  const hasCharacter = !!currentStyle;
  const customCount = Object.values(currentCustomization).filter(Boolean).length;

  return (
    <div className="space-y-4 animate-slide-up">
      {!hasCharacter && (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
          <span className="text-4xl">🥊</span>
          <p className="mt-2 text-sm font-bold text-foreground">아직 캐릭터를 선택하지 않았어요</p>
          <p className="text-xs text-muted-foreground mt-1">"프리셋 선택" 탭에서 마음에 드는 복서를 골라보세요!</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-3">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${LEAGUE_COLORS[league]}`}>
            {LEAGUE_LABELS[league]}
          </span>
          <span className="mt-1 text-lg font-bold text-foreground">Lv.{level}</span>
          <span className="text-[10px] text-muted-foreground">현재 리그</span>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-3">
          <span className="text-lg">🎨</span>
          <span className="mt-1 text-lg font-bold text-foreground">{customCount}</span>
          <span className="text-[10px] text-muted-foreground">꾸미기</span>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-3">
          <span className="text-lg">{currentMilestone?.icon || "🥊"}</span>
          <span className="mt-1 text-xs font-bold text-foreground truncate w-full text-center">{currentMilestone?.label || "입문"}</span>
          <span className="text-[10px] text-muted-foreground">현재 등급</span>
        </div>
      </div>

      {nextMilestone && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{nextMilestone.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">다음 해금: {nextMilestone.label}</p>
              <p className="text-xs text-muted-foreground">{nextMilestone.description}</p>
              <p className="text-[10px] text-primary mt-0.5">
                {LEAGUE_LABELS[nextMilestone.league]} 리그 Lv.{nextMilestone.levelRange[0]} 도달 시
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <button onClick={() => navigate("/avatar")} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 active:scale-[0.98] transition-all">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20">
            <Gem className="h-5 w-5 text-accent" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-foreground">아이템 상점</p>
            <p className="text-[10px] text-muted-foreground">젬으로 특별 아이템 구매</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <button onClick={() => navigate("/halloffame")} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 active:scale-[0.98] transition-all">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20">
            <Crown className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-foreground">명예의 전당</p>
            <p className="text-[10px] text-muted-foreground">내 캐릭터가 전시됩니다</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

// ========== CUSTOMIZE TAB ==========
function CustomizeTab({ customization, onChange, league, isAdmin, isInHallOfFame, ownedSet, walletBalance, purchaseCustomization }: {
  customization: CharacterCustomization;
  onChange: (c: CharacterCustomization) => void;
  league: string;
  isAdmin: boolean;
  isInHallOfFame: boolean;
  ownedSet: Set<string>;
  walletBalance: number;
  purchaseCustomization: ReturnType<typeof usePurchaseCustomization>;
}) {
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, dragFree: false });
  const [purchaseModal, setPurchaseModal] = useState<{ cat: string; opt: CustomizationOption } | null>(null);
  const userLeagueOrder = CUSTOMIZATION_LEAGUE_ORDER[league] ?? 0;

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveCatIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const scrollTo = (idx: number) => {
    setActiveCatIdx(idx);
    emblaApi?.scrollTo(idx);
  };

  const isOptLocked = (opt: CustomizationOption) => {
    if (isAdmin) return false;
    if (opt.requirement === "hall_of_fame") return !isInHallOfFame;
    return (CUSTOMIZATION_LEAGUE_ORDER[opt.league] ?? 0) > userLeagueOrder;
  };

  const isOptOwned = (catCode: string, opt: CustomizationOption) => {
    if (isAdmin) return true;
    if (opt.price === 0) return true;
    return ownedSet.has(`${catCode}:${opt.key}`);
  };

  const applyItem = (catCode: string, optKey: string) => {
    const current = (customization as any)[catCode];
    onChange({ ...customization, [catCode]: current === optKey ? undefined : optKey });
  };

  const handleItemClick = (catCode: string, opt: CustomizationOption) => {
    if (isOptLocked(opt)) {
      if (opt.requirement === "hall_of_fame") {
        toast("👑 명예의 전당 헌액자만 해금됩니다");
      } else {
        toast(`${opt.league === "black" ? "블랙" : opt.league === "red" ? "레드" : "블루"} 리그 달성 후 해금됩니다 🔒`);
      }
      return;
    }
    if (isOptOwned(catCode, opt)) {
      applyItem(catCode, opt.key);
      return;
    }
    setPurchaseModal({ cat: catCode, opt });
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseModal) return;
    const { cat, opt } = purchaseModal;
    try {
      await purchaseCustomization.mutateAsync({ category: cat, itemKey: opt.key, price: opt.price });
      setPurchaseModal(null);
      applyItem(cat, opt.key);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      toast.success(`🎉 ${opt.label} 획득!`);
    } catch (e: any) {
      toast.error(e.message || "구매 실패");
    }
  };

  const activeCount = Object.values(customization).filter(Boolean).length;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Category tab pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CUSTOMIZATION_CATEGORIES.map((cat, idx) => {
          const hasSelection = !!(customization as any)[cat.code];
          const isActive = activeCatIdx === idx;
          return (
            <button
              key={cat.code}
              onClick={() => scrollTo(idx)}
              className={`relative flex-shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : hasSelection
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <span>{cat.icon}</span>
              {cat.label}
              {hasSelection && !isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Embla carousel */}
      <div ref={emblaRef} className="overflow-hidden rounded-2xl border border-border bg-card/50">
        <div className="flex">
          {CUSTOMIZATION_CATEGORIES.map((cat) => (
            <div key={cat.code} className="flex-[0_0_100%] min-w-0 p-3">
              <div className="grid grid-cols-3 gap-2">
                {cat.options.map(opt => {
                  const isSelected = (customization as any)[cat.code] === opt.key;
                  const locked = isOptLocked(opt);
                  const owned = isOptOwned(cat.code, opt);

                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleItemClick(cat.code, opt)}
                      className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 transition-all active:scale-95 min-h-[100px] justify-between ${
                        locked ? "border-border bg-muted/30 opacity-60"
                        : isSelected ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                        : owned ? "border-border bg-background"
                        : "border-dashed border-muted-foreground/30 bg-background"
                      }`}
                    >
                      {/* Top-right badge */}
                      {isSelected && !locked && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary z-10">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </span>
                      )}
                      {locked && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/70 z-10">
                          <Lock className="h-2.5 w-2.5 text-white" />
                        </span>
                      )}
                      {!locked && owned && !isSelected && (
                        <span className="absolute -top-1 -left-1 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[8px] font-bold text-green-600 z-10">
                          보유
                        </span>
                      )}

                      {/* Preview */}
                      <div className="flex-1 flex items-center justify-center">
                        <OptionPreview category={cat.code} optionKey={opt.key} />
                      </div>

                      {/* Label */}
                      <span className="text-[10px] font-bold text-foreground/80 truncate w-full text-center">{opt.label}</span>

                      {/* Price / status */}
                      {locked ? (
                        <span className="text-[9px] text-muted-foreground">
                          {opt.requirement === "hall_of_fame" ? "👑 전당" : "🔒 " + (opt.league === "black" ? "블랙" : opt.league === "red" ? "레드" : "블루")}
                        </span>
                      ) : !owned ? (
                        <span className={`text-[9px] font-bold ${
                          walletBalance >= opt.price || isAdmin ? "text-accent-foreground" : "text-muted-foreground"
                        }`}>
                          💎 {opt.price.toLocaleString()}
                        </span>
                      ) : opt.price === 0 ? (
                        <span className="text-[9px] text-green-500 font-bold">무료</span>
                      ) : (
                        <span className="text-[9px] text-muted-foreground">✅</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-1.5">
        {CUSTOMIZATION_CATEGORIES.map((_, idx) => (
          <button
            key={idx}
            onClick={() => scrollTo(idx)}
            className={`rounded-full transition-all ${
              activeCatIdx === idx ? "w-5 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      {activeCount > 0 && (
        <button
          onClick={() => onChange({})}
          className="w-full rounded-xl border border-border bg-secondary/50 py-2.5 text-xs font-medium text-muted-foreground active:scale-[0.98] transition-all"
        >
          전체 초기화 ({activeCount}개 적용 중)
        </button>
      )}

      {/* Purchase confirmation modal */}
      {purchaseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setPurchaseModal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-card p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            {/* Item preview */}
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-muted/50 border border-border">
              <OptionPreview category={purchaseModal.cat} optionKey={purchaseModal.opt.key} />
            </div>

            <div className="text-center mb-4">
              <h2 className="text-lg font-black text-foreground">{purchaseModal.opt.label}</h2>
              {purchaseModal.opt.description && (
                <p className="text-xs text-muted-foreground mt-1">{purchaseModal.opt.description}</p>
              )}
            </div>

            {/* Price breakdown */}
            <div className="rounded-2xl bg-muted/50 p-3.5 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">가격</span>
                <span className="font-black text-foreground">💎 {purchaseModal.opt.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">현재 잔액</span>
                <span className="font-bold">{isAdmin ? "∞" : walletBalance.toLocaleString()}</span>
              </div>
              {!isAdmin && (
                <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                  <span className="text-muted-foreground">구매 후 잔액</span>
                  <span className={`font-bold ${walletBalance - purchaseModal.opt.price < 0 ? "text-destructive" : "text-foreground"}`}>
                    {(walletBalance - purchaseModal.opt.price).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setPurchaseModal(null)}
                disabled={purchaseCustomization.isPending}
                className="flex-1 rounded-2xl border border-border bg-secondary py-3.5 text-sm font-bold text-secondary-foreground active:scale-95 transition-all disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleConfirmPurchase}
                disabled={purchaseCustomization.isPending || (!isAdmin && walletBalance < purchaseModal.opt.price)}
                className="flex-[2] rounded-2xl bg-gradient-to-r from-accent to-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-95 transition-all disabled:opacity-50"
              >
                {purchaseCustomization.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    구매 중...
                  </span>
                ) : (!isAdmin && walletBalance < purchaseModal.opt.price) ? (
                  "젬 부족"
                ) : (
                  "💎 구매하기"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Visual preview for static option types
function OptionPreview({ category, optionKey }: { category: string; optionKey: string }) {
  if (category === "effect") {
    const emoji = EFFECT_EMOJIS[optionKey] || "✨";
    return <span className="text-2xl">{emoji}</span>;
  }
  if (category === "frame") {
    const colors: Record<string, string> = {
      fire:          "border-orange-500 shadow-orange-500/30",
      ice:           "border-cyan-400 shadow-cyan-400/30",
      gold:          "border-amber-400 shadow-amber-400/30",
      shadow:        "border-gray-600 shadow-gray-600/30",
      lightning:     "border-yellow-400 shadow-yellow-400/30",
      rainbow:       "border-pink-400 shadow-pink-400/30",
      cherry:        "border-pink-300 shadow-pink-300/30",
      diamond:       "border-cyan-300 shadow-cyan-300/30",
      purple:        "border-purple-500 shadow-purple-500/30",
      moon:          "border-blue-200 shadow-blue-200/30",
      dark_red:      "border-red-900 shadow-red-900/30",
      crystal:       "border-white shadow-white/30",
      rainbow_frame: "border-violet-500 shadow-violet-500/30",
      sakura:        "border-rose-300 shadow-rose-300/30",
      blood:         "border-red-700 shadow-red-700/30",
      galaxy:        "border-indigo-500 shadow-indigo-500/30",
      neon_green:    "border-green-400 shadow-green-400/30",
      holy:          "border-yellow-200 shadow-yellow-200/30",
    };
    return (
      <div className={`h-8 w-8 rounded-full border-2 shadow-md ${colors[optionKey] || "border-border"}`} />
    );
  }
  if (category === "title") {
    const info = TITLE_LABELS[optionKey];
    return <span className={`text-sm font-bold ${info?.color || "text-foreground"}`}>{info?.text || optionKey}</span>;
  }
  if (category === "aura") {
    const gradient = AURA_PREVIEW_GRADIENTS[optionKey] || "bg-gradient-to-t from-gray-400 to-gray-200";
    return <div className={`h-9 w-9 rounded-full ${gradient} shadow-md`} />;
  }
  return <span className="text-lg">❓</span>;
}

// ========== PRESET TAB ==========
function PresetTab({ filteredCharacters, selectedStyle, currentStyle, activeFilter, setActiveFilter, currentLeague, isInHallOfFame, isAdmin, ownedStyles, walletBalance, onSelect, onApply, onPurchaseClick }: {
  filteredCharacters: typeof PREBUILT_CHARACTERS;
  selectedStyle: string;
  currentStyle?: string;
  activeFilter: string;
  setActiveFilter: (f: string) => void;
  currentLeague: string;
  isInHallOfFame: boolean;
  isAdmin: boolean;
  ownedStyles: Set<string>;
  walletBalance: number;
  onSelect: (style: string) => void;
  onApply: (char: typeof PREBUILT_CHARACTERS[0]) => Promise<void>;
  onPurchaseClick: (char: typeof PREBUILT_CHARACTERS[0]) => void;
}) {
  const userRank = LEAGUE_ORDER[currentLeague] ?? 0;

  const isCharLocked = (char: (typeof PREBUILT_CHARACTERS)[number]) => {
    if (isAdmin) return false;
    if (char.requirement === "hall_of_fame") return !isInHallOfFame;
    return (LEAGUE_ORDER[char.league] ?? 0) > userRank;
  };

  const handleLockedToast = (char: (typeof PREBUILT_CHARACTERS)[number]) => {
    if (char.requirement === "hall_of_fame") {
      toast("👑 명예의 전당 헌액자만 해금됩니다.\n마스터 미션을 달성하고 전당에 오르세요!");
    } else {
      toast(`${LEAGUE_LABELS[char.league]} 리그 달성 후 선택 가능합니다 🔒`);
    }
  };

  const leagueNormal: Record<string, string> = {
    white: "bg-white border-2 border-gray-200",
    blue:  "bg-gradient-to-b from-blue-50 to-blue-100 border-2 border-blue-200",
    red:   "bg-gradient-to-b from-red-50 to-red-100 border-2 border-red-200",
    black: "bg-gradient-to-b from-gray-800 to-gray-900 border-2 border-amber-500/40 shadow-[0_0_10px_2px_rgba(251,191,36,0.2)]",
  };
  const leagueSelected: Record<string, string> = {
    white: "bg-white border-2 border-primary shadow-md",
    blue:  "bg-gradient-to-b from-blue-100 to-blue-200 border-2 border-blue-500 shadow-blue-300/50 shadow-md",
    red:   "bg-gradient-to-b from-red-100 to-red-200 border-2 border-red-500 shadow-red-300/50 shadow-md",
    black: "bg-gradient-to-b from-gray-800 to-gray-900 border-2 border-amber-400 shadow-[0_0_15px_5px_rgba(251,191,36,0.5)]",
  };
  const leagueBtnGradient: Record<string, string> = {
    white: "bg-gradient-to-r from-gray-400 to-gray-500 text-white",
    blue:  "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
    red:   "bg-gradient-to-r from-red-500 to-rose-600 text-white",
    black: "bg-gradient-to-r from-amber-600 to-amber-700 text-white",
  };

  return (
    <div className="space-y-3 animate-slide-up">
      {/* Filter tabs */}
      <div className="flex rounded-xl border border-border bg-secondary/50 p-0.5 overflow-x-auto gap-0.5 scrollbar-hide">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap ${
              activeFilter === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Character grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredCharacters.map(char => {
          const isSelected = selectedStyle === char.style;
          const isCurrent = currentStyle === char.style;
          const isLocked = isCharLocked(char);
          const isHof = char.requirement === "hall_of_fame";
          const isBlackNonHof = char.league === "black" && !char.requirement;
          const isOwned = isAdmin || ownedStyles.has(char.style) || char.price === 0;
          const isApplied = currentStyle === char.style;

          const cardClass = isLocked
            ? "border-2 border-border bg-muted/30"
            : isHof
              ? isSelected
                ? "bg-gradient-to-b from-yellow-900/40 via-amber-800/30 to-yellow-900/40 border-[2px] border-amber-400 shadow-[0_0_30px_10px_rgba(253,224,71,0.8),0_0_60px_20px_rgba(251,191,36,0.5)] animate-[breathe_2s_ease-in-out_infinite]"
                : "bg-gradient-to-b from-yellow-900/40 via-amber-800/30 to-yellow-900/40 border-[2px] border-amber-400 shadow-[0_0_20px_8px_rgba(251,191,36,0.6),0_0_40px_15px_rgba(234,179,8,0.3)] animate-[breathe_2s_ease-in-out_infinite]"
              : isSelected
                ? (leagueSelected[char.league] ?? "border-2 border-primary bg-primary/5 shadow-md")
                : (leagueNormal[char.league] ?? "border-2 border-border bg-card");

          const labelColor = (isHof || isBlackNonHof) && !isLocked ? "text-white/90" : "text-foreground/90";

          let actionEl: React.ReactNode;
          if (isLocked) {
            actionEl = char.requirement === "hall_of_fame"
              ? <div className="w-full text-center py-2 rounded-xl bg-yellow-500/10 text-yellow-500 text-xs font-bold">👑 헌액자 전용</div>
              : <div className="w-full text-center py-2 rounded-xl bg-muted text-muted-foreground text-xs font-bold">🔒 리그 미달성</div>;
          } else if (isApplied) {
            actionEl = <div className="w-full text-center py-2 rounded-xl bg-primary/20 text-primary text-xs font-bold">✅ 적용됨</div>;
          } else if (isOwned) {
            actionEl = (
              <button
                onClick={(e) => { e.stopPropagation(); onApply(char); }}
                className="w-full rounded-xl bg-secondary border border-primary/20 text-foreground py-2 text-xs font-bold active:scale-95 transition-all hover:bg-primary/10"
              >
                ⚡ 적용하기
              </button>
            );
          } else if (char.price === 0) {
            actionEl = (
              <button
                onClick={(e) => { e.stopPropagation(); onApply(char); }}
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white py-2 text-xs font-bold active:scale-95 transition-all"
              >
                🎁 무료 획득
              </button>
            );
          } else {
            const canAfford = isAdmin || walletBalance >= char.price;
            actionEl = (
              <button
                onClick={(e) => { e.stopPropagation(); onPurchaseClick(char); }}
                disabled={!canAfford && !isAdmin}
                className={`w-full rounded-xl py-2 text-xs font-bold active:scale-95 transition-all disabled:opacity-40 ${
                  isHof
                    ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-black"
                    : (leagueBtnGradient[char.league] ?? "bg-gradient-to-r from-gray-400 to-gray-500 text-white")
                }`}
              >
                💎 {char.price.toLocaleString()}
              </button>
            );
          }

          return (
            <div
              key={char.style}
              onClick={() => isLocked ? handleLockedToast(char) : onSelect(char.style)}
              className={`relative flex flex-col rounded-2xl overflow-visible cursor-pointer transition-all active:scale-[0.97] ${cardClass}`}
              style={{ minHeight: '190px' }}
            >
              {/* HOF glow ring */}
              {isHof && !isLocked && (
                <div className="absolute inset-[-3px] rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-400 opacity-30 animate-[galaxy-spin_3s_linear_infinite] -z-10 pointer-events-none" />
              )}

              {/* Top row: league badge + status icon */}
              <div className="flex items-start justify-between p-2.5 pb-0 z-10">
                {isHof ? (
                  <span className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm leading-none whitespace-nowrap">
                    👑 ETERNAL
                  </span>
                ) : (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none ${
                    char.league === "black" ? "bg-gray-900/80 text-amber-400" :
                    char.league === "red"   ? "bg-red-100 text-red-600" :
                    char.league === "blue"  ? "bg-blue-100 text-blue-600" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {LEAGUE_LABELS[char.league]}
                  </span>
                )}
                <div className="flex items-center gap-1">
                  {isCurrent && !isSelected && !isLocked && (
                    <Sparkles className="h-3.5 w-3.5 text-accent" />
                  )}
                  {isSelected && !isLocked && (
                    <div className="rounded-full bg-primary p-0.5">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  {isLocked && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/80">
                      <Lock className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* HOF particles */}
              {isHof && !isLocked && (
                <>
                  <span className="absolute top-8 left-2 text-xs animate-bounce pointer-events-none z-10" style={{ animationDelay: "0ms" }}>✨</span>
                  <span className="absolute top-8 right-2 text-xs animate-bounce pointer-events-none z-10" style={{ animationDelay: "200ms" }}>⭐</span>
                </>
              )}
              {isBlackNonHof && !isLocked && (
                <span className="absolute top-8 right-2 text-xs animate-bounce pointer-events-none z-10" style={{ animationDelay: "0ms", animationDuration: "1.4s" }}>✨</span>
              )}

              {/* Character image */}
              <div className="flex-1 flex items-center justify-center px-2 py-1 min-h-[100px]">
                <CharacterSprite style={char.style} size="lg" />
              </div>

              {/* Name + action button */}
              <div className="p-2.5 pt-1 space-y-2">
                <p className={`text-sm font-bold text-center leading-tight line-clamp-2 ${labelColor}`}>
                  {char.label}
                </p>
                {actionEl}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-center text-muted-foreground pb-2">
        카드를 눌러 미리보기 · 버튼으로 적용/구매
      </p>
    </div>
  );
}

// ========== PURCHASE CONFIRM MODAL ==========
function PurchaseConfirmModal({ char, walletBalance, isAdmin, isPurchasing, onConfirm, onCancel }: {
  char: typeof PREBUILT_CHARACTERS[0];
  walletBalance: number;
  isAdmin: boolean;
  isPurchasing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const afterBalance = walletBalance - char.price;
  const canAfford = isAdmin || walletBalance >= char.price;
  const isHof = char.requirement === "hall_of_fame";

  const confirmBtnClass = isHof
    ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-black"
    : char.league === "black"
    ? "bg-gradient-to-r from-amber-600 to-amber-700 text-white"
    : char.league === "red"
    ? "bg-gradient-to-r from-red-500 to-rose-600 text-white"
    : char.league === "blue"
    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
    : "bg-gradient-to-r from-gray-500 to-gray-600 text-white";

  const cardBg: Record<string, string> = {
    white: "bg-gradient-to-b from-gray-50 to-gray-100",
    blue:  "bg-gradient-to-b from-blue-50 to-blue-100",
    red:   "bg-gradient-to-b from-red-50 to-red-100",
    black: "bg-gradient-to-b from-gray-800 to-gray-900",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div
        className="relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-card p-6 shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Character preview */}
        <div className={`mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-2xl ${cardBg[char.league] ?? cardBg.white}`}>
          <CharacterSprite style={char.style} size="lg" />
        </div>

        {/* Name + league */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-black text-foreground">{char.label}</h2>
          <span className={`inline-block mt-1.5 rounded-full px-3 py-0.5 text-xs font-bold ${LEAGUE_COLORS[char.league]}`}>
            {isHof ? "👑 명예의 전당" : LEAGUE_LABELS[char.league] + " 리그"}
          </span>
        </div>

        {/* Price breakdown */}
        <div className="rounded-2xl bg-muted/50 p-3.5 mb-5 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">가격</span>
            <span className="font-black text-foreground">💎 {char.price.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">현재 잔액</span>
            <span className="font-bold">{isAdmin ? "∞" : walletBalance.toLocaleString()}</span>
          </div>
          {!isAdmin && (
            <>
              <div className="border-t border-border/50 pt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">구매 후 잔액</span>
                <span className={`font-bold ${afterBalance < 0 ? "text-destructive" : "text-foreground"}`}>
                  {afterBalance.toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPurchasing}
            className="flex-1 rounded-2xl border border-border bg-secondary py-3.5 text-sm font-bold text-secondary-foreground active:scale-95 transition-all disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isPurchasing || (!isAdmin && !canAfford)}
            className={`flex-[2] rounded-2xl py-3.5 text-sm font-bold active:scale-95 transition-all disabled:opacity-50 ${confirmBtnClass}`}
          >
            {isPurchasing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                구매 중...
              </span>
            ) : !canAfford && !isAdmin ? (
              "젬 부족"
            ) : (
              "💎 구매하기"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== GROWTH TAB ==========
function GrowthTab({ league, level }: { league: string; level: number }) {
  const leagueIdx = { white: 0, blue: 1, red: 2, black: 3 }[league] ?? 0;

  return (
    <div className="space-y-3 animate-slide-up">
      <p className="text-xs text-muted-foreground">레벨을 올리고 새로운 캐릭터 보상을 해금하세요!</p>

      {UNLOCK_MILESTONES.map((m, idx) => {
        const mIdx = { white: 0, blue: 1, red: 2, black: 3 }[m.league] ?? 0;
        const isCompleted = mIdx < leagueIdx || (mIdx === leagueIdx && level >= m.levelRange[1]);
        const isCurrent = mIdx === leagueIdx && level >= m.levelRange[0] && level <= m.levelRange[1];
        const isFuture = !isCompleted && !isCurrent;

        return (
          <div
            key={idx}
            className={`rounded-2xl border p-3.5 transition-all ${
              isCurrent
                ? "border-primary bg-primary/5 shadow-sm"
                : isCompleted
                ? "border-status-complete/30 bg-status-complete/5"
                : "border-border bg-muted/20 opacity-60"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{m.icon}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{m.label}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${LEAGUE_COLORS[m.league]}`}>
                    {LEAGUE_LABELS[m.league]} Lv.{m.levelRange[0]}-{m.levelRange[1]}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{m.description}</p>
                {m.unlockedPartKeys.length > 0 && (
                  <p className="text-[10px] text-primary mt-0.5">
                    {isCompleted ? "✅" : isCurrent ? "🔓" : "🔒"} 보상 {m.unlockedPartKeys.length}개
                  </p>
                )}
              </div>
              {isCompleted && <Check className="h-4 w-4 text-status-complete" />}
              {isCurrent && <Sparkles className="h-4 w-4 text-primary animate-pulse" />}
              {isFuture && <Lock className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========== EFFECTS TAB ==========
function EffectsTab({ league, level }: { league: string; level: number }) {
  const isBlack = league === "black";
  const isMaster = isBlack && level >= 10;
  const leagueIdx = { white: 0, blue: 1, red: 2, black: 3 }[league] ?? 0;

  return (
    <div className="space-y-4 animate-slide-up">
      <div className={`rounded-2xl border p-4 ${
        isBlack
          ? "border-amber-400/40 bg-gradient-to-r from-gray-900/50 to-amber-900/20"
          : "border-border bg-muted/20"
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{isBlack ? "🌈" : "💫"}</span>
          <div>
            <p className="text-sm font-bold text-foreground">
              {isMaster ? "마스터 레인보우 후광" : isBlack ? "블랙 리그 후광" : "오라 미해금"}
            </p>
            <p className="text-xs text-muted-foreground">
              {isBlack
                ? isMaster ? "최고 등급 프레스티지 효과가 적용됩니다" : "블랙 리그 전용 후광이 활성화됩니다"
                : "블랙 리그 도달 시 자동으로 레인보우 후광이 활성화됩니다"
              }
            </p>
          </div>
        </div>
        {!isBlack && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all"
                style={{ width: `${(leagueIdx / 3) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{LEAGUE_LABELS[league]} → 블랙</span>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">리그별 프레스티지</h3>
        <div className="space-y-2">
          {[
            { l: "white", label: "화이트", desc: "기본 캐릭터", icon: "⬜", active: true },
            { l: "blue", label: "블루", desc: "세련된 스타일 보상", icon: "🔵", active: leagueIdx >= 1 },
            { l: "red", label: "레드", desc: "프리미엄 보상 해금", icon: "🔴", active: leagueIdx >= 2 },
            { l: "black", label: "블랙", desc: "레인보우 후광 활성화", icon: "🖤", active: leagueIdx >= 3 },
          ].map(tier => (
            <div key={tier.l} className={`flex items-center gap-3 rounded-xl p-3 transition-all ${
              tier.active ? "bg-card border border-border" : "bg-muted/20 opacity-50"
            }`}>
              <span className="text-lg">{tier.icon}</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">{tier.label} 리그</p>
                <p className="text-[10px] text-muted-foreground">{tier.desc}</p>
              </div>
              {tier.active ? <Check className="h-3.5 w-3.5 text-status-complete" /> : <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== GYM TAB ==========
function GymTab({ currentStyle, userId, league, isAdmin, isInHallOfFame, ownedSet, walletBalance, purchaseCustomization, gymLayout, onLayoutChange }: {
  currentStyle?: string;
  userId?: string;
  league: string;
  isAdmin: boolean;
  isInHallOfFame: boolean;
  ownedSet: Set<string>;
  walletBalance: number;
  purchaseCustomization: ReturnType<typeof usePurchaseCustomization>;
  gymLayout: GymLayout;
  onLayoutChange: (layout: GymLayout) => void;
}) {
  const [activeCatIdx, setActiveCatIdx] = useState(0);
  const [purchaseModal, setPurchaseModal] = useState<{ catCode: string; item: GymItem } | null>(null);
  const userLeagueOrder = CUSTOMIZATION_LEAGUE_ORDER[league] ?? 0;
  const activeCat = GYM_CATEGORIES[activeCatIdx];

  const isItemLocked = (item: GymItem) => {
    if (isAdmin) return false;
    if (item.requirement === "hall_of_fame") return !isInHallOfFame;
    return (CUSTOMIZATION_LEAGUE_ORDER[item.league] ?? 0) > userLeagueOrder;
  };

  const isItemOwned = (catCode: string, item: GymItem) => {
    if (isAdmin) return true;
    if (item.price === 0) return true;
    return ownedSet.has(`gym_${catCode}:${item.key}`);
  };

  const placeItem = (item: GymItem) => {
    const catCode = activeCat.code;
    if (catCode === "wallpaper") {
      onLayoutChange({ ...gymLayout, wallpaper: gymLayout.wallpaper === item.key ? undefined : item.key });
    } else if (catCode === "floor_mat") {
      onLayoutChange({ ...gymLayout, floor_mat: gymLayout.floor_mat === item.key ? undefined : item.key });
    } else {
      const slotKey = item.slot as keyof GymLayout;
      onLayoutChange({ ...gymLayout, [slotKey]: (gymLayout as any)[slotKey] === item.key ? undefined : item.key });
    }
  };

  const handleItemClick = (item: GymItem) => {
    if (isItemLocked(item)) {
      if (item.requirement === "hall_of_fame") {
        toast("👑 명예의 전당 헌액자만 해금됩니다");
      } else {
        toast(`${item.league === "black" ? "블랙" : item.league === "red" ? "레드" : "블루"} 리그 달성 후 해금됩니다 🔒`);
      }
      return;
    }
    if (isItemOwned(activeCat.code, item)) {
      placeItem(item);
      return;
    }
    setPurchaseModal({ catCode: activeCat.code, item });
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseModal) return;
    const { catCode, item } = purchaseModal;
    try {
      await purchaseCustomization.mutateAsync({ category: `gym_${catCode}`, itemKey: item.key, price: item.price });
      setPurchaseModal(null);
      placeItem(item);
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
      toast.success(`🎉 ${item.label} 획득!`);
    } catch (e: any) {
      toast.error(e.message || "구매 실패");
    }
  };

  const isPlaced = (item: GymItem) => {
    const catCode = activeCat.code;
    if (catCode === "wallpaper") return gymLayout.wallpaper === item.key;
    if (catCode === "floor_mat") return gymLayout.floor_mat === item.key;
    return (gymLayout as any)[item.slot] === item.key;
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Mini Gym Preview */}
      <MiniGymPreview
        layout={gymLayout}
        characterStyle={currentStyle}
        userId={userId}
        className="border border-border"
      />

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {GYM_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.code}
            onClick={() => setActiveCatIdx(idx)}
            className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${
              activeCatIdx === idx
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-3 gap-2">
        {activeCat.items.map(item => {
          const locked = isItemLocked(item);
          const owned = isItemOwned(activeCat.code, item);
          const placed = isPlaced(item);

          return (
            <button
              key={item.key}
              onClick={() => handleItemClick(item)}
              className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 transition-all active:scale-95 min-h-[100px] justify-between ${
                locked ? "border-border bg-muted/30 opacity-60"
                : placed ? "border-primary bg-primary/5 shadow-md scale-[1.02]"
                : owned ? "border-border bg-background"
                : "border-dashed border-muted-foreground/30 bg-background"
              }`}
            >
              {placed && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary z-10">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
              {locked && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/70 z-10">
                  <Lock className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              {!locked && owned && !placed && (
                <span className="absolute -top-1 -left-1 rounded-full bg-green-500/20 px-1.5 py-0.5 text-[8px] font-bold text-green-600 z-10">
                  보유
                </span>
              )}

              <div className="flex-1 flex items-center justify-center">
                <span className="text-2xl">{item.emoji}</span>
              </div>
              <span className="text-[10px] font-bold text-foreground/80 truncate w-full text-center">{item.label}</span>

              {locked ? (
                <span className="text-[9px] text-muted-foreground">
                  {item.requirement === "hall_of_fame" ? "👑 전당" : "🔒"}
                </span>
              ) : !owned ? (
                <span className={`text-[9px] font-bold ${walletBalance >= item.price || isAdmin ? "text-accent-foreground" : "text-muted-foreground"}`}>
                  💎 {item.price.toLocaleString()}
                </span>
              ) : item.price === 0 ? (
                <span className="text-[9px] text-green-500 font-bold">무료</span>
              ) : (
                <span className="text-[9px] text-muted-foreground">✅</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Purchase modal */}
      {purchaseModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={() => setPurchaseModal(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-card p-6 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/50 border border-border">
              <span className="text-4xl">{purchaseModal.item.emoji}</span>
            </div>
            <div className="text-center mb-4">
              <h2 className="text-lg font-black text-foreground">{purchaseModal.item.label}</h2>
              {purchaseModal.item.description && (
                <p className="text-xs text-muted-foreground mt-1">{purchaseModal.item.description}</p>
              )}
            </div>
            <div className="rounded-2xl bg-muted/50 p-3.5 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">가격</span>
                <span className="font-black">💎 {purchaseModal.item.price.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">현재 잔액</span>
                <span className="font-bold">{isAdmin ? "∞" : walletBalance.toLocaleString()}</span>
              </div>
              {!isAdmin && (
                <div className="flex justify-between text-sm border-t border-border/50 pt-2">
                  <span className="text-muted-foreground">구매 후</span>
                  <span className={`font-bold ${walletBalance - purchaseModal.item.price < 0 ? "text-destructive" : ""}`}>
                    {(walletBalance - purchaseModal.item.price).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setPurchaseModal(null)} disabled={purchaseCustomization.isPending} className="flex-1 rounded-2xl border border-border bg-secondary py-3.5 text-sm font-bold active:scale-95 transition-all disabled:opacity-50">
                취소
              </button>
              <button onClick={handleConfirmPurchase} disabled={purchaseCustomization.isPending || (!isAdmin && walletBalance < purchaseModal.item.price)} className="flex-[2] rounded-2xl bg-gradient-to-r from-accent to-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-95 transition-all disabled:opacity-50">
                {purchaseCustomization.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    구매 중...
                  </span>
                ) : (!isAdmin && walletBalance < purchaseModal.item.price) ? "젬 부족" : "💎 구매하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CharacterStudioPage;
