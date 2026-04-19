import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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
import {
  CUSTOMIZATION_CATEGORIES,
  EFFECT_EMOJIS,
  TITLE_LABELS,
  AURA_CONFIG,
  HALO_CONFIGS,
  HALO_OPTIONS,
  type CharacterCustomization,
  type CustomizationOption,
} from "@/data/characterCustomizationData";

const TABS = [
  { key: "my", label: "내 캐릭터", icon: "🥊" },
  { key: "preset", label: "프리셋 선택", icon: "🎭" },
  { key: "customize", label: "꾸미기", icon: "🎨" },
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

  // Sync local state from server assignment exactly once after it loads.
  // Without this, a page refresh leaves selectedStyle stuck on "male_01"
  // (루키) and saving would clobber the real preset in DB.
  const hasSyncedFromAssignmentRef = useRef(false);
  useEffect(() => {
    if (!assignment || hasSyncedFromAssignmentRef.current) return;
    if (currentStyle) setSelectedStyle(currentStyle);
    setPendingCustomization(currentCustomization);
    hasSyncedFromAssignmentRef.current = true;
  }, [assignment, currentStyle, currentCustomization]);

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
      });
      toast.success("꾸미기가 저장되었습니다! 🎨");
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
        <div className="relative rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-5 shadow-glow-soft">
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
                <span className="text-[10px] text-muted-foreground">{currentMilestone.icon} {currentMilestone.label}</span>
              )}
            </div>
          </div>
          {activeTab === "preset" && (
            <button
              onClick={handleSavePreset}
              disabled={isSaving || isCurrentPreset}
              className={`absolute top-3 right-3 rounded-full px-3 py-1.5 text-xs font-bold shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-95 disabled:opacity-50 ${
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
          {activeTab === "customize" && (
            <button
              onClick={handleSaveCustomization}
              disabled={isSaving}
              className="absolute top-3 right-3 rounded-full px-3 py-1.5 text-xs font-bold shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-95 disabled:opacity-50 bg-primary text-primary-foreground"
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
                  ? "bg-card text-foreground shadow-elev-1"
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
            level={currentLevel}
            isAdmin={isAdmin}
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
function CustomizeTab({ customization, onChange, league, level, isAdmin }: {
  customization: CharacterCustomization;
  onChange: (c: CharacterCustomization) => void;
  league: string;
  level: number;
  isAdmin: boolean;
}) {
  const isMaster = league === "black" && level >= 10;
  const [activeCat, setActiveCat] = useState(CUSTOMIZATION_CATEGORIES[0].code);

  const handleSelect = (catCode: string, opt: CustomizationOption) => {
    if (opt.blackOnly && league !== "black" && !isAdmin) {
      toast("블랙리그 달성 후 해금됩니다 🔒");
      return;
    }
    const current = (customization as any)[catCode];
    const newVal = current === opt.key ? undefined : opt.key;
    onChange({ ...customization, [catCode]: newVal });
  };

  const activeCount = Object.values(customization).filter(Boolean).length;
  const activeCatData = CUSTOMIZATION_CATEGORIES.find(c => c.code === activeCat)!;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Category tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted/60 p-1">
        {CUSTOMIZATION_CATEGORIES.map(cat => {
          const hasSelection = !!(customization as any)[cat.code];
          const isActive = activeCat === cat.code;
          return (
            <button
              key={cat.code}
              onClick={() => setActiveCat(cat.code)}
              className={`relative flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all active:scale-[0.97] ${
                isActive
                  ? "bg-background text-primary shadow-elev-1"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              <span>{cat.label}</span>
              {hasSelection && (
                <span className={`ml-0.5 h-1.5 w-1.5 rounded-full ${isActive ? "bg-primary" : "bg-primary/60"}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-4 gap-2">
        {activeCatData.options.map(opt => {
          const isSelected = (customization as any)[activeCat] === opt.key;
          const isLocked = !!opt.blackOnly && league !== "black" && !isAdmin;
          return (
            <button
              key={opt.key}
              onClick={() => handleSelect(activeCat, opt)}
              className={`relative flex flex-col items-center gap-2 rounded-2xl border-2 p-3 transition-all active:scale-95 ${
                isLocked
                  ? "border-border bg-muted/30 opacity-60"
                  : isSelected
                  ? "border-primary bg-primary/5 shadow-glow-soft"
                  : "border-border bg-card"
              }`}
            >
              {isSelected && !isLocked && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </span>
              )}
              {isLocked && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/70">
                  <Lock className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              <OptionPreview category={activeCat} optionKey={opt.key} />
              <span className="text-[9px] font-bold text-foreground/80 truncate w-full text-center">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── 후광 섹션 (마스터 전용) ── */}
      <div className={`rounded-xl border-2 p-3 space-y-3 ${isMaster ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/20 opacity-50"}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">👑</span>
          <span className="text-xs font-bold text-foreground">마스터 후광</span>
          {!isMaster && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              블랙 마스터 달성 시 해금
            </span>
          )}
          {isMaster && customization.halo && customization.halo !== "none" && (
            <span className="ml-auto text-[10px] text-amber-500 font-bold">적용 중</span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          {HALO_OPTIONS.map(opt => {
            const isSelected = customization.halo === opt.key || (!customization.halo && opt.key === "halo_rainbow" && isMaster);
            return (
              <button
                key={opt.key}
                disabled={!isMaster}
                onClick={() => {
                  if (!isMaster) return;
                  const newVal = customization.halo === opt.key ? undefined : opt.key;
                  onChange({ ...customization, halo: newVal });
                }}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-all active:scale-95 ${
                  !isMaster
                    ? "border-border bg-muted/30 cursor-not-allowed"
                    : isSelected
                    ? "border-amber-400 bg-amber-400/10 shadow-md"
                    : "border-border bg-card"
                }`}
              >
                {isSelected && isMaster && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500">
                    <Check className="h-2 w-2 text-white" />
                  </span>
                )}
                <OptionPreview category="halo" optionKey={opt.key} />
                <span className="text-[8px] font-bold text-foreground/70 truncate w-full text-center">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeCount > 0 && (
        <button
          onClick={() => onChange({})}
          className="w-full rounded-xl border border-border bg-secondary/50 py-2.5 text-xs font-medium text-muted-foreground active:scale-[0.98] transition-all"
        >
          전체 초기화 ({activeCount}개 적용 중)
        </button>
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
      basic_white:   "border-gray-300 shadow-gray-300/30",
      fire:          "border-orange-500 shadow-orange-500/30",
      ice:           "border-cyan-400 shadow-cyan-400/30",
      moon:          "border-blue-200 shadow-blue-200/30",
      lightning:     "border-yellow-400 shadow-yellow-400/30",
      cherry:        "border-pink-300 shadow-pink-300/30",
      electric:      "border-sky-400 shadow-sky-400/30",
      ocean:         "border-blue-500 shadow-blue-500/30",
      emerald:       "border-emerald-400 shadow-emerald-400/30",
      sakura:        "border-rose-300 shadow-rose-300/30",
      diamond:       "border-cyan-300 shadow-cyan-300/30",
      gold:          "border-amber-400 shadow-amber-400/30",
      rainbow:       "border-pink-400 shadow-pink-400/30",
      blood:         "border-red-700 shadow-red-700/30",
      dark_red:      "border-red-900 shadow-red-900/30",
      purple:        "border-purple-500 shadow-purple-500/30",
      neon:          "border-lime-400 shadow-lime-400/30",
      crystal:       "border-white shadow-white/30",
      storm:         "border-slate-500 shadow-slate-500/30",
      neon_green:    "border-green-400 shadow-green-400/30",
      shadow:        "border-gray-600 shadow-gray-600/30",
      galaxy:        "border-indigo-500 shadow-indigo-500/30",
      rainbow_frame: "border-violet-500 shadow-violet-500/30",
      holy:          "border-yellow-200 shadow-yellow-200/30",
      inferno:       "border-red-600 shadow-red-600/30",
      void:          "border-gray-900 shadow-gray-900/30",
      eternal:       "border-amber-200 shadow-amber-200/30",
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
    const tier = AURA_CONFIG[optionKey];
    if (!tier || tier.layers.length === 0) {
      return <div className="h-9 w-9 rounded-full bg-muted shadow-inner" />;
    }
    const bg = tier.layers[0].background;
    return (
      <div
        className="h-9 w-9 rounded-full shadow-md"
        style={{ background: bg }}
      />
    );
  }
  if (category === "halo") {
    const cfg = HALO_CONFIGS[optionKey];
    if (!cfg) {
      return <div className="h-9 w-9 rounded-full bg-muted shadow-inner" />;
    }
    const bg = cfg.rings[0]?.gradient || "transparent";
    return (
      <div
        className="h-9 w-9 rounded-full shadow-md animate-spin"
        style={{ background: bg, animationDuration: "4s" }}
      />
    );
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
              activeFilter === tab.key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
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
                ? (leagueSelected[char.league] ?? "border-2 border-primary bg-primary/5 shadow-glow-soft")
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
                  <span className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full shadow-elev-1 leading-none whitespace-nowrap">
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
                ? "border-primary bg-primary/5 shadow-elev-1"
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
              {isMaster ? "마스터 후광" : isBlack ? "블랙 리그 후광" : "오라 미해금"}
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

export default CharacterStudioPage;
