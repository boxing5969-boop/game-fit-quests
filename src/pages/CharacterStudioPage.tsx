import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Shuffle,
  Save,
  Check,
  Sparkles,
  Lock,
  ChevronRight,
  Crown,
  Banknote,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PREBUILT_CHARACTERS, getRandomCharacter } from "@/data/characterPresets";
import { getCurrentMilestone, UNLOCK_MILESTONES } from "@/data/characterUnlockData";
import {
  useTemplatePresets,
  useAssignCharacter,
  useMemberCharacterAssignment,
  useSaveCustomization,
} from "@/hooks/useCharacterData";
import { useIsInHallOfFame } from "@/hooks/useRankingData";
import {
  useOwnedCustomizations,
  useOwnedSet,
  usePurchaseCustomization,
} from "@/hooks/useCustomizationPurchase";
import { useWallet, useSpendGems } from "@/hooks/useWallet";
import CharacterSprite from "@/components/CharacterSprite";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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
import {
  computeUserLevel,
  getUnlockStatus,
  resolveDisplayName,
  type UnlockCategory,
} from "@/data/unlockRules";
import {
  AppPage,
  PageHeader,
  StatCard,
} from "@/components/ui/rankingup";

const TABS = [
  { key: "my", label: "내 캐릭터" },
  { key: "preset", label: "복서" },
  { key: "customize", label: "꾸미기" },
  { key: "growth", label: "성장" },
  { key: "effects", label: "효과" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const FILTER_TABS = [
  { key: "white",  label: "화이트", icon: "🤍" },
  { key: "blue",   label: "블루",   icon: "💙" },
  { key: "red",    label: "레드",   icon: "❤️" },
  { key: "black",  label: "블랙",   icon: "🖤" },
  { key: "legend", label: "전설",   icon: "👑" },
] as const;

const LEAGUE_ORDER: Record<string, number> = { white: 0, blue: 1, red: 2, black: 3 };

const LEAGUE_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

/** League pill tones — dark-theme friendly, desaturated so the screen
 *  doesn't become a wash of league colors. */
const LEAGUE_COLORS: Record<string, string> = {
  white: "bg-[hsl(220_14%_71%)]/15 text-[hsl(220_14%_85%)]",
  blue: "bg-accent/15 text-accent",
  red: "bg-destructive/15 text-destructive",
  black: "bg-reward/15 text-reward",
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
  const { data: ownedCustomizations = [] } = useOwnedCustomizations();
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
      // currentStyle 자동 추가를 제거. "현재 적용 중" 판별은 isApplied(=== currentStyle) 로
      // 따로 처리되므로 ownedStyles 에 넣지 않아도 "✅ 적용됨" 은 정상 노출된다.
      // 이전 로직은 admin 이 과거 무지갑 적용한 복서가 계속 "보유" 로 보이게 해서,
      // "admin 도 구매해야 보유" 라는 규칙을 깨뜨렸다.
      return new Set([...freeStyles, ...stored]);
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
      } catch {
        // storage quota 초과 등은 UI 에만 반영하고 다음 세션에 재동기화.
      }
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

  /**
   * 인벤토리에서 아이템 클릭 → 즉시 장착/해제 (디아블로 스타일).
   * customize 탭의 Save 버튼을 거치지 않고 서버에 바로 반영.
   * itemKey=undefined 이면 해당 카테고리 장착 해제.
   */
  const handleEquipFromInventory = useCallback(
    async (category: string, itemKey: string | undefined) => {
      if (!user?.id) return;
      if (!currentStyle) {
        toast.error("먼저 복서를 선택해주세요");
        return;
      }
      const next: CharacterCustomization = {
        ...currentCustomization,
        [category]: itemKey,
      };
      // undefined 필드는 JSON 저장 시에도 키 자체가 빠지도록 정리.
      if (itemKey === undefined) {
        delete (next as Record<string, unknown>)[category];
      }
      try {
        await saveCustomization.mutateAsync({
          style: currentStyle,
          customization: next,
        });
        // pending state 도 맞춰 두어 customize 탭으로 이동해도 동기화 유지.
        setPendingCustomization(next);
        toast.success(itemKey ? "장착 완료 ⚡" : "장착 해제");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "장착 실패");
      }
    },
    [user?.id, currentStyle, currentCustomization, saveCustomization],
  );

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

    // Client-side pre-check matches the server RPC/trigger — catches bad
    // state before the round trip so the user gets an immediate toast.
    if (!isAdmin) {
      const pendingUserLevel = computeUserLevel({
        current_rank: currentLeague,
        current_level: currentLevel,
        bosses_cleared: progress?.bosses_cleared || 0,
        is_in_hall_of_fame: isInHallOfFame,
      });
      for (const [category, itemKey] of Object.entries(pendingCustomization)) {
        if (!itemKey || itemKey === "none") continue;
        const status = getUnlockStatus(pendingUserLevel, {
          category: category as UnlockCategory,
          itemKey: String(itemKey),
        });
        if (status.locked && status.requiredLevel !== null) {
          toast.error(`레벨 ${status.requiredLevel} 달성 시 해금됩니다`);
          return;
        }
      }
    }

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

  const gemsDisplay = isAdmin ? "∞" : (walletData?.gems_balance ?? 0).toLocaleString();

  // 현재 스테이지에 서 있는 캐릭터가 "전설"(HoF)인지 판정.
  // preset 탭 프리뷰 중일 땐 selectedStyle, 그 외엔 실제 적용 중인 currentStyle 기준.
  const stageCharStyle = activeTab === "preset" ? selectedStyle : (currentStyle ?? selectedStyle);
  const stageChar = PREBUILT_CHARACTERS.find((c) => c.style === stageCharStyle);
  const isStageHof = stageChar?.requirement === "hall_of_fame";

  return (
    <>
      <AppPage
        header={
          <PageHeader
            title="캐릭터 스튜디오"
            leftAction={
              <button
                onClick={() => navigate(-1)}
                aria-label="뒤로가기"
                className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
              >
                <ArrowLeft className="h-4 w-4 text-secondary-foreground" />
              </button>
            }
            rightAction={
              <>
                {/* Reward-tinted gem pill per spec
                    — rgba(246, 196, 83, 0.12) bg, #F6C453 text */}
                <span className="inline-flex items-center gap-1 rounded-pill bg-[rgba(246,196,83,0.12)] px-3 py-1.5 text-caption font-bold text-[#F6C453]">
                  <Banknote className="h-3.5 w-3.5" />
                  <span className="number-font">{gemsDisplay}</span>
                </span>
                {activeTab === "preset" && currentStyle && selectedStyle !== currentStyle && (
                  <button
                    onClick={handleRevert}
                    aria-label="되돌리기"
                    className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
                  >
                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                {activeTab === "preset" && (
                  <button
                    onClick={handleRandomize}
                    aria-label="랜덤 복서"
                    className="flex h-9 w-9 items-center justify-center rounded-pill bg-secondary active:scale-95"
                  >
                    <Shuffle className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </>
            }
            sticky
          />
        }
      >
        <div className="space-y-6">
          {/* ─── Character Hero Stage ─── 전설(HoF) 캐릭터면 amber 톤 + breathe + 황금 glow */}
          <section
            className={cn(
              "relative overflow-visible rounded-hero p-6",
              isStageHof
                ? "border-[2px] border-amber-400 animate-[breathe_2.4s_ease-in-out_infinite]"
                : "border border-border bg-gradient-to-b from-[hsl(var(--surface-2))] to-card shadow-elev-2",
            )}
            style={
              isStageHof
                ? {
                    background:
                      "linear-gradient(to bottom, hsla(50, 92%, 13%, 0.55) 0%, hsla(35, 80%, 20%, 0.50) 50%, hsla(50, 92%, 13%, 0.55) 100%)",
                    boxShadow:
                      "0 0 24px 8px rgba(251, 191, 36, 0.55), 0 0 54px 18px rgba(234, 179, 8, 0.28)",
                  }
                : undefined
            }
          >
            {/* Subtle reward glow behind the character — 일반 캐릭터용 */}
            {!isStageHof && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-hero">
                <div className="absolute left-1/2 top-[40%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-reward/10 blur-3xl" />
                <div className="absolute left-1/2 top-[40%] h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-2xl" />
              </div>
            )}
            {/* HoF 전용 — 중앙 강한 황금 hotspot + 스파클 */}
            {isStageHof && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-hero">
                <div className="absolute left-1/2 top-[38%] h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400/25 blur-3xl" />
                <span aria-hidden className="absolute left-6 top-6 text-base opacity-70 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]">✨</span>
                <span aria-hidden className="absolute right-8 top-10 text-sm opacity-60 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]">⭐</span>
                <span aria-hidden className="absolute left-10 bottom-14 text-xs opacity-55 drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]">✨</span>
                <span aria-hidden className="absolute right-6 bottom-20 text-sm opacity-50 drop-shadow-[0_0_5px_rgba(251,191,36,0.7)]">⭐</span>
              </div>
            )}

            {/* Contextual save button */}
            {activeTab === "preset" && (
              <button
                onClick={handleSavePreset}
                disabled={isSaving || isCurrentPreset}
                className={`absolute top-4 right-4 z-10 inline-flex items-center gap-1 rounded-pill px-3 py-1.5 text-caption font-bold transition-all active:scale-95 disabled:opacity-50 ${
                  isCurrentPreset
                    ? "bg-[#22C55E]/15 text-[#22C55E]"
                    : "bg-primary text-primary-foreground shadow-glow-soft hover:shadow-glow-primary"
                }`}
              >
                {isSaving ? (
                  "..."
                ) : isCurrentPreset ? (
                  <>
                    <Check className="h-3 w-3" /> 적용됨
                  </>
                ) : (
                  <>
                    <Save className="h-3 w-3" /> 저장
                  </>
                )}
              </button>
            )}
            {activeTab === "customize" && (
              <button
                onClick={handleSaveCustomization}
                disabled={isSaving}
                className="absolute top-4 right-4 z-10 inline-flex items-center gap-1 rounded-pill bg-primary px-3 py-1.5 text-caption font-bold text-primary-foreground shadow-glow-soft transition-all hover:shadow-glow-primary active:scale-95 disabled:opacity-50"
              >
                {isSaving ? "..." : (<><Save className="h-3 w-3" /> 저장</>)}
              </button>
            )}

            <div className="relative flex flex-col items-center">
              {/* Character */}
              <div className="mb-5 flex h-44 w-44 items-center justify-center">
                <CharacterSprite
                  style={selectedStyle}
                  userId={user?.id}
                  size="lg"
                  animate={activeTab !== "customize"}
                  league={currentLeague as any}
                  level={currentLevel}
                  customization={previewCustomization}
                  className="!w-40 !h-40"
                  priority
                />
              </div>

              {/* Name */}
              <h2 className="text-[24px] font-extrabold leading-tight text-foreground">
                {selectedChar.label}
              </h2>

              {/* League · Lv pill */}
              <div className="mt-2 flex items-center gap-2">
                <span className={cn("badge-pill", LEAGUE_COLORS[currentLeague])}>
                  {LEAGUE_LABELS[currentLeague]} 리그 · Lv.
                  <span className="number-font">{currentLevel}</span>
                </span>
              </div>

              {/* Milestone / current grade */}
              {currentMilestone && (
                <p className="mt-1.5 text-caption text-muted-foreground">
                  {currentMilestone.icon} {currentMilestone.label}
                </p>
              )}
            </div>
          </section>

          {/* ─── Tab bar ─── Horizontally-scrollable chips so CJK labels
               never wrap. Each chip sizes to its natural width; active
               tab uses the shadcn-style raised surface so it still reads
               as a tab (not a filter). */}
          <div
            role="tablist"
            aria-label="캐릭터 스튜디오 탭"
            className="flex gap-1 overflow-x-auto rounded-pill border border-border bg-muted/40 p-1 scrollbar-hide"
          >
            {TABS.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.key)}
                  className={cn(
                    "shrink-0 whitespace-nowrap rounded-pill px-4 py-1.5 text-body-sm font-bold transition-all active:scale-[0.98]",
                    active
                      ? "bg-card text-foreground shadow-elev-1"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* ─── Tab content ─── */}
          {activeTab === "my" && (
            <MyCharacterTab
              currentStyle={currentStyle}
              league={currentLeague}
              level={currentLevel}
              navigate={navigate}
              currentMilestone={currentMilestone}
              nextMilestone={nextMilestone}
              currentCustomization={currentCustomization}
              ownedStyles={ownedStyles}
              ownedCustomizations={ownedCustomizations}
              onEquip={handleEquipFromInventory}
              isEquipping={saveCustomization.isPending}
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
              onApply={async (char) => {
                markOwned(char.style);
                await handleApplyStyle(char.style);
                toast.success(`${char.label} 적용! 🥊`);
              }}
              onPurchaseClick={(char) => setPurchaseModal(char)}
            />
          )}
          {activeTab === "customize" && (
            <CustomizeTab
              customization={pendingCustomization}
              onChange={setPendingCustomization}
              league={currentLeague}
              level={currentLevel}
              bossesCleared={progress?.bosses_cleared || 0}
              isInHallOfFame={isInHallOfFame}
              isAdmin={isAdmin}
              walletBalance={walletData?.gems_balance || 0}
            />
          )}
          {activeTab === "growth" && (
            <GrowthTab league={currentLeague} level={currentLevel} />
          )}
          {activeTab === "effects" && (
            <EffectsTab league={currentLeague} level={currentLevel} />
          )}
        </div>
      </AppPage>

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
function MyCharacterTab({ currentStyle, league, level, navigate, currentMilestone, nextMilestone, currentCustomization, ownedStyles, ownedCustomizations, onEquip, isEquipping }: {
  currentStyle?: string;
  league: string;
  level: number;
  ownedStyles: Set<string>;
  ownedCustomizations: { category: string; item_key: string }[];
  navigate: (path: string) => void;
  currentMilestone: any;
  nextMilestone: any;
  currentCustomization: CharacterCustomization;
  onEquip: (category: string, itemKey: string | undefined) => Promise<void>;
  isEquipping: boolean;
}) {
  const hasCharacter = !!currentStyle;
  const customCount = Object.values(currentCustomization).filter(Boolean).length;

  return (
    <div className="space-y-4 animate-slide-up">
      {!hasCharacter && (
        <div className="rounded-card border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
          <span className="text-4xl">🥊</span>
          <p className="mt-2 text-body-sm font-bold text-foreground">
            아직 캐릭터를 선택하지 않았어요
          </p>
          <p className="text-caption text-muted-foreground mt-1">
            "복서" 탭에서 마음에 드는 복서를 골라보세요.
          </p>
        </div>
      )}

      {/* 3 stat cards — number-font pinned via StatCard */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="현재 리그"
          value={`${LEAGUE_LABELS[league]} · Lv.${level}`}
          accent="accent"
          icon={<Sparkles className="h-5 w-5" />}
        />
        <StatCard
          label="꾸미기"
          value={`${customCount}개`}
          accent="reward"
          icon={<Banknote className="h-5 w-5" />}
        />
        <StatCard
          label="현재 등급"
          value={currentMilestone?.label || "입문"}
          accent="primary"
          icon={
            currentMilestone?.icon ? (
              <span className="text-lg">{currentMilestone.icon}</span>
            ) : (
              <Crown className="h-5 w-5" />
            )
          }
        />
      </div>

      {/* Next unlock */}
      {nextMilestone && (
        <div className="rounded-card border border-primary/25 bg-gradient-to-r from-primary/5 to-reward/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xl">
              {nextMilestone.icon}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-bold text-foreground">
                다음 해금: {nextMilestone.label}
              </p>
              <p className="text-caption text-muted-foreground">
                {nextMilestone.description}
              </p>
              <p className="text-[10px] text-primary mt-0.5">
                {LEAGUE_LABELS[nextMilestone.league]} 리그 Lv.
                <span className="number-font">
                  {nextMilestone.levelRange[0]}
                </span>{" "}
                도달 시
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Inventory + 명예의 전당 */}
      <InventorySection
        ownedStyles={ownedStyles}
        ownedCustomizations={ownedCustomizations}
        currentCustomization={currentCustomization}
        onEquip={onEquip}
        isEquipping={isEquipping}
      />
      <button
        onClick={() => navigate("/halloffame")}
        className="elevated-card flex w-full items-center gap-3 text-left"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(246,196,83,0.12)]">
          <Crown className="h-5 w-5 text-[#F6C453]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-bold text-foreground">
            명예의 전당
          </p>
          <p className="text-caption text-muted-foreground">
            내 캐릭터가 전시됩니다
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
}

// ========== INVENTORY SECTION (Diablo-style) ==========
//
// 게임 인벤토리처럼 동작.
//   • 복서(프리셋)는 디스플레이 전용 — 프리셋 탭에서 "적용" 으로 전환.
//   • 꾸미기 4종(이펙트·프레임·칭호·오라)은 슬롯 그리드로 표시.
//     - 보유한 아이템만 표시 (미구매는 꾸미기 탭 상점에서 구매).
//     - 탭하면 즉시 장착 (saveCustomization 호출), 한 번 더 탭하면 해제.
//     - 현재 장착 아이템은 primary 테두리 + "장착 중" 배지 + glow.
//
function InventorySection({
  ownedStyles,
  ownedCustomizations,
  currentCustomization,
  onEquip,
  isEquipping,
}: {
  ownedStyles: Set<string>;
  ownedCustomizations: { category: string; item_key: string }[];
  currentCustomization: CharacterCustomization;
  onEquip: (category: string, itemKey: string | undefined) => Promise<void>;
  isEquipping: boolean;
}) {
  // 카테고리별로 보유 아이템 key 를 모은다.
  // DB 에 미리 알려진 것 외의 카테고리(halo 등)가 있어도 일단 살려 두고,
  // 렌더할 때 라벨만 fallback 처리. 하드코딩된 4개로 제한하면 사용자가
  // "이미 보유" 인데 UI 에서 사라지는 버그가 난다.
  const groupedCustomizations = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const item of ownedCustomizations) {
      (groups[item.category] ??= []).push(item.item_key);
    }
    return groups;
  }, [ownedCustomizations]);

  const ownedPresets = useMemo(
    () => PREBUILT_CHARACTERS.filter((c) => ownedStyles.has(c.style) || c.price === 0),
    [ownedStyles],
  );

  const totalOwned =
    ownedPresets.length +
    Object.values(groupedCustomizations).reduce((a, arr) => a + arr.length, 0);

  // 장착된 카테고리 수 — customization 객체에서 비어있지 않은 값 카운트.
  // 미래에 halo 가 customization 에 포함돼도 자연스럽게 반영.
  const equippedCount = Object.values(
    currentCustomization as Record<string, string | undefined>,
  ).filter((v) => v && v !== "none").length;

  const categoryLabels: Record<string, { label: string; icon: string }> = {
    effect: { label: "이펙트", icon: "✨" },
    frame:  { label: "프레임", icon: "🖼️" },
    title:  { label: "칭호",   icon: "🏷️" },
    aura:   { label: "오라",   icon: "🌀" },
    halo:   { label: "후광",   icon: "👑" },
  };

  // 실제로 보유한 카테고리 목록을 동적으로 추출 — 4종 이외 항목도 포함.
  const presentCategories = Object.keys(groupedCustomizations).filter(
    (cat) => (groupedCustomizations[cat]?.length ?? 0) > 0,
  );

  return (
    <div className="elevated-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(246,196,83,0.12)]">
          <Banknote className="h-5 w-5 text-[#F6C453]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-bold text-foreground">인벤토리</p>
          <p className="text-caption text-muted-foreground">
            보유 <span className="number-font font-bold text-foreground">{totalOwned}</span>개 · 장착{" "}
            <span className="number-font font-bold text-primary">{equippedCount}</span>/4
          </p>
        </div>
      </div>

      {/* 전체 인벤토리 비어있을 때 */}
      {totalOwned === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 text-center">
          <span className="text-3xl">📦</span>
          <p className="mt-2 text-[12px] font-bold text-foreground">
            아직 구매한 아이템이 없어요
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            꾸미기 탭에서 💵 파이트 머니로 이펙트·프레임·칭호를 구매하면 여기에 쌓입니다.
          </p>
        </div>
      )}

      {/* 보유 복서 (프리셋) — 디스플레이 전용, "복서" 탭에서 교체 */}
      {ownedPresets.length > 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold text-foreground">🥊 보유 복서</span>
            <span className="number-font text-[11px] font-bold text-muted-foreground">
              {ownedPresets.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ownedPresets.slice(0, 12).map((c) => (
              <span
                key={c.style}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-foreground/85"
                title={c.label}
              >
                {c.requirement === "hall_of_fame" && <Crown className="h-2.5 w-2.5 text-reward" />}
                <span className="truncate max-w-[70px]">{c.label}</span>
              </span>
            ))}
            {ownedPresets.length > 12 && (
              <span className="text-[10px] text-muted-foreground">+{ownedPresets.length - 12}</span>
            )}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            교체하려면 "복서" 탭에서 선택해주세요.
          </p>
        </div>
      )}

      {/* 꾸미기 4종 슬롯 그리드 — 클릭하면 즉시 장착/해제 */}
      {presentCategories.map((cat) => {
        const items = groupedCustomizations[cat] ?? [];
        const meta = categoryLabels[cat] ?? { label: cat, icon: "🎒" };
        const equippedKey = (currentCustomization as Record<string, string | undefined>)[cat];
        if (items.length === 0) return null;
        return (
          <div key={cat} className="rounded-xl border border-border bg-card/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-foreground">
                {meta.icon} {meta.label}
              </span>
              <span className="number-font text-[10px] text-muted-foreground">
                {items.length}개 보유
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {items.map((key) => {
                const catOptions =
                  CUSTOMIZATION_CATEGORIES.find((c) => c.code === cat)?.options ?? [];
                const option = catOptions.find((o) => o.key === key);
                // resolveDisplayName 은 UnlockCategory 타입이라 cat 을 캐스팅.
                // 알 수 없는 카테고리는 item_key 그대로 라벨로 사용.
                const label = resolveDisplayName(cat as UnlockCategory, key, option?.label ?? key);
                const isHof = option?.requirement === "hall_of_fame";
                const isEquipped = equippedKey === key;
                return (
                  <button
                    key={`${cat}:${key}`}
                    type="button"
                    disabled={isEquipping}
                    onClick={() => onEquip(cat, isEquipped ? undefined : key)}
                    aria-pressed={isEquipped}
                    className={cn(
                      "relative flex flex-col items-center gap-1 rounded-xl border-2 p-2 pb-4 transition-all active:scale-95 disabled:opacity-60",
                      isEquipped
                        ? isHof
                          ? "border-reward bg-reward/10 shadow-[0_0_16px_rgba(246,196,83,0.35)]"
                          : "border-primary bg-primary/10 shadow-glow-soft"
                        : isHof
                          ? "border-reward/40 bg-gradient-to-br from-[hsl(42_92%_10%)] via-card to-card"
                          : "border-border bg-card",
                    )}
                  >
                    {isEquipped && (
                      <span
                        className={cn(
                          "absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full",
                          isHof ? "bg-reward" : "bg-primary",
                        )}
                      >
                        <Check
                          className={cn(
                            "h-2.5 w-2.5",
                            isHof ? "text-background" : "text-primary-foreground",
                          )}
                        />
                      </span>
                    )}
                    {isHof && (
                      <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-reward text-[hsl(30_60%_12%)]">
                        <Crown className="h-2.5 w-2.5" />
                      </span>
                    )}
                    <OptionPreview category={cat} optionKey={key} />
                    <span
                      className={cn(
                        "w-full truncate text-center text-[9px] font-bold leading-tight",
                        isEquipped
                          ? isHof
                            ? "text-reward"
                            : "text-primary"
                          : isHof
                            ? "text-reward/90"
                            : "text-foreground/80",
                      )}
                    >
                      {label}
                    </span>
                    {isEquipped && (
                      <span className="absolute bottom-1 left-1 right-1 mx-auto inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-primary-foreground">
                        장착 중
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ========== CUSTOMIZE TAB ==========
function CustomizeTab({ customization, onChange, league, level, bossesCleared, isInHallOfFame, isAdmin, walletBalance }: {
  customization: CharacterCustomization;
  onChange: (c: CharacterCustomization) => void;
  league: string;
  level: number;
  bossesCleared: number;
  isInHallOfFame: boolean;
  isAdmin: boolean;
  walletBalance: number;
}) {
  const isMaster = league === "black" && level >= 10;
  const userLevel = useMemo(
    () => computeUserLevel({
      current_rank: league,
      current_level: level,
      bosses_cleared: bossesCleared,
      is_in_hall_of_fame: isInHallOfFame,
    }),
    [league, level, bossesCleared, isInHallOfFame],
  );
  const [activeCat, setActiveCat] = useState(CUSTOMIZATION_CATEGORIES[0].code);

  // 구매 관련 — 아이템 상점처럼 미소유 유료 아이템 클릭 시 구매 모달 오픈.
  const ownedSet = useOwnedSet();
  const purchase = usePurchaseCustomization();
  const [purchaseItem, setPurchaseItem] = useState<{ category: string; option: CustomizationOption } | null>(null);

  const isItemOwned = (catCode: string, itemKey: string): boolean =>
    ownedSet.has(`${catCode}:${itemKey}`);

  const applySelection = (catCode: string, itemKey: string) => {
    const current = (customization as any)[catCode];
    const newVal = current === itemKey ? undefined : itemKey;
    onChange({ ...customization, [catCode]: newVal });
  };

  const handleSelect = (catCode: string, opt: CustomizationOption) => {
    // HoF 게이트 — 서버 purchase_customization 의 hof_required 에러와 동일 경로.
    if (opt.requirement === "hall_of_fame" && !isInHallOfFame && !isAdmin) {
      toast("명예의 전당 입성 후 구매 가능");
      return;
    }
    if (!isAdmin) {
      const status = getUnlockStatus(userLevel, {
        category: catCode as UnlockCategory,
        itemKey: opt.key,
      });
      if (status.locked && status.requiredLevel !== null) {
        toast(`레벨 ${status.requiredLevel} 달성 시 해금됩니다`);
        return;
      }
    }
    if (opt.blackOnly && league !== "black" && !isAdmin) {
      toast("블랙리그 달성 후 해금됩니다 🔒");
      return;
    }

    // 유료 + 미소유 → 구매 모달. admin 도 예외 없이 진입 — 서버 RPC 가
    // admin 지갑 체크를 우회하므로 '파이트 머니 무제한' 으로 항상 구매 성공.
    const needsPurchase =
      opt.price > 0 && !isItemOwned(catCode, opt.key);
    if (needsPurchase) {
      setPurchaseItem({ category: catCode, option: opt });
      return;
    }

    // 소유했거나 FREE 아이템 → 바로 토글 적용 (기존 동작 유지).
    applySelection(catCode, opt.key);
  };

  const handleConfirmPurchase = async () => {
    if (!purchaseItem) return;
    const { category, option } = purchaseItem;
    try {
      await purchase.mutateAsync({
        category,
        itemKey: option.key,
        price: option.price,
      });
      toast.success(`💵 ${resolveDisplayName(category as UnlockCategory, option.key, option.label)} 구매 완료!`);
      setPurchaseItem(null);
      // 구매 직후 자동 적용 — 사용자가 이 아이템을 고른 맥락이므로 의도 명확.
      applySelection(category, option.key);
    } catch (e) {
      // useCustomizationPurchase 훅이 Error 메시지로 insufficient_gems 등 번역해 던짐.
      toast.error(e instanceof Error ? e.message : "구매 실패");
    }
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

      {/* Options grid — 모든 아이템에 가격 + 해금 조건을 일관되게 표기.
          admin 은 요구 조건을 그대로 보되 클릭은 허용 (handleSelect 의 !isAdmin 가드). */}
      <div className="grid grid-cols-4 gap-2">
        {activeCatData.options.map(opt => {
          const isSelected = (customization as any)[activeCat] === opt.key;
          const unlock = getUnlockStatus(userLevel, {
            category: activeCat as UnlockCategory,
            itemKey: opt.key,
          });
          const isHof = opt.requirement === "hall_of_fame";

          // 요구 조건 (admin 무관 — 정보 노출용)
          const requiresHof = isHof && !isInHallOfFame;
          const requiresLevel = unlock.locked; // user level < requiredLevel
          const requiresBlack = !!opt.blackOnly && league !== "black";

          // 시각상 잠금 처리 (admin 은 풀컬러 + 클릭 가능)
          const visuallyLocked = !isAdmin && (requiresHof || requiresLevel || requiresBlack);

          // 구매 여부 — 실제 user_owned_customizations 기록 기준.
          // admin 도 예외 없음 (구매하면 "보유", 안 했으면 미보유).
          const owned = opt.price > 0 && isItemOwned(activeCat, opt.key);

          const displayLabel = resolveDisplayName(
            activeCat as UnlockCategory,
            opt.key,
            opt.label,
          );
          return (
            <button
              key={opt.key}
              onClick={() => handleSelect(activeCat, opt)}
              className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 pb-6 transition-all active:scale-95 ${
                // HoF 카드는 금빛 테두리로 시각 차별화 (admin 포함)
                isHof
                  ? visuallyLocked
                    ? "border-reward/40 bg-gradient-to-br from-[hsl(42_92%_14%)] via-card to-card"
                    : isSelected
                    ? "border-reward bg-reward/5 shadow-[0_0_18px_rgba(246,196,83,0.25)]"
                    : "border-reward/60 bg-gradient-to-br from-[hsl(42_92%_10%)] via-card to-card"
                  : visuallyLocked
                  ? "border-border bg-muted/30"
                  : isSelected
                  ? "border-primary bg-primary/5 shadow-glow-soft"
                  : "border-border bg-card"
              }`}
            >
              {isSelected && !visuallyLocked && (
                <span className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${isHof ? "bg-reward" : "bg-primary"}`}>
                  <Check className={`h-2.5 w-2.5 ${isHof ? "text-background" : "text-primary-foreground"}`} />
                </span>
              )}
              {visuallyLocked && !requiresHof && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted-foreground/70">
                  <Lock className="h-2.5 w-2.5 text-white" />
                </span>
              )}
              {/* HoF 왕관 배지 — 잠김/해금 무관 항상 표시 */}
              {isHof && (
                <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-reward text-[hsl(30_60%_12%)] shadow">
                  <Crown className="h-2.5 w-2.5" />
                </span>
              )}
              <div className={visuallyLocked ? "grayscale opacity-60" : undefined}>
                <OptionPreview category={activeCat} optionKey={opt.key} />
              </div>
              <span
                className={`text-[10px] font-bold truncate w-full text-center leading-tight ${
                  visuallyLocked ? "text-muted-foreground" : isHof ? "text-reward" : "text-foreground/80"
                }`}
              >
                {displayLabel}
              </span>
              {/* 가격/상태 — 아이템 상점 톤. 소유자는 "보유", 미소유 유료는 가격, 0원은 FREE. */}
              {opt.price > 0 && owned ? (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold leading-none text-success">
                  <Check className="h-2.5 w-2.5" />
                  보유
                </span>
              ) : opt.price > 0 ? (
                <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold leading-none ${isHof ? (visuallyLocked ? "text-muted-foreground" : "text-reward") : visuallyLocked ? "text-muted-foreground" : "text-foreground/70"}`}>
                  <Banknote className="h-2.5 w-2.5" />
                  <span className="number-font">{opt.price.toLocaleString()}</span>
                </span>
              ) : (
                <span className="text-[9px] font-bold leading-none text-success">FREE</span>
              )}
              {/* 해금 조건 하단 pill — 우선순위: HoF > Black > Level
                  admin 에게도 정보 제공을 위해 visuallyLocked 와 무관하게 표시 */}
              {requiresHof ? (
                <span className="absolute bottom-1 left-1 right-1 mx-auto inline-flex items-center justify-center gap-0.5 rounded-full bg-reward/90 px-1.5 py-0.5 text-[9px] font-bold leading-none text-[hsl(30_60%_12%)]">
                  <Crown className="h-2 w-2" />
                  명예의 전당 전용
                </span>
              ) : requiresBlack ? (
                <span className="absolute bottom-1 left-1 right-1 mx-auto inline-flex items-center justify-center gap-0.5 rounded-full bg-foreground/85 px-1.5 py-0.5 text-[9px] font-bold leading-none text-background">
                  <Lock className="h-2 w-2" />
                  블랙리그 전용
                </span>
              ) : requiresLevel && unlock.requiredLevel !== null ? (
                <span className="absolute bottom-1 left-1 right-1 mx-auto inline-flex items-center justify-center gap-0.5 rounded-full bg-foreground/85 px-1.5 py-0.5 text-[9px] font-bold leading-none text-background">
                  <Lock className="h-2 w-2" />
                  Lv.{unlock.requiredLevel} 해금
                </span>
              ) : null}
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
        <p className="text-[10px] leading-snug text-muted-foreground">
          ※ 오라 탭의 <b className="text-reward">명예의 전당 전용</b> 오라와는 별개 카테고리입니다.
        </p>
        <div className="grid grid-cols-5 gap-2">
          {HALO_OPTIONS.map(opt => {
            // undefined 는 "선택 안함" 의 기본 — "none" 옵션을 활성화 표시.
            // 마스터여도 자동 rainbow 선택 처리 없음 (유저가 명시 선택해야 함).
            const currentHalo = customization.halo ?? "none";
            const isSelected = currentHalo === opt.key;
            return (
              <button
                key={opt.key}
                disabled={!isMaster}
                onClick={() => {
                  if (!isMaster) return;
                  // 명시 선택 = 항상 해당 key 로 설정. "none" 을 고르면
                  // halo 렌더가 사라진다 (CharacterSprite 가 "none" 에
                  // 대해 haloConfig=null 처리).
                  onChange({ ...customization, halo: opt.key });
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

      {/* 꾸미기 아이템 구매 모달 — 미소유 유료 아이템 클릭 시 열림 */}
      {purchaseItem && (
        <CustomizationPurchaseModal
          category={purchaseItem.category}
          option={purchaseItem.option}
          walletBalance={walletBalance}
          isAdmin={isAdmin}
          isPurchasing={purchase.isPending}
          onConfirm={handleConfirmPurchase}
          onCancel={() => setPurchaseItem(null)}
        />
      )}
    </div>
  );
}

// ========== CUSTOMIZATION PURCHASE MODAL ==========
// 꾸미기(이펙트/프레임/칭호/오라) 단일 아이템 구매 확인.
// 프리셋(PurchaseConfirmModal)과 동일 톤이지만 미리보기는 OptionPreview 사용.
function CustomizationPurchaseModal({
  category,
  option,
  walletBalance,
  isAdmin,
  isPurchasing,
  onConfirm,
  onCancel,
}: {
  category: string;
  option: CustomizationOption;
  walletBalance: number;
  isAdmin: boolean;
  isPurchasing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const afterBalance = walletBalance - option.price;
  // admin 은 파이트 머니 ∞ 취급 — 서버 RPC 가 지갑 체크 우회하므로 항상 구매 가능.
  const canAfford = isAdmin || walletBalance >= option.price;
  const isHof = option.requirement === "hall_of_fame";
  const displayLabel = resolveDisplayName(
    category as UnlockCategory,
    option.key,
    option.label,
  );
  const catMeta = CUSTOMIZATION_CATEGORIES.find((c) => c.code === category);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <div
        className="relative w-full max-w-sm rounded-t-3xl bg-card p-6 shadow-2xl animate-slide-up sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 아이템 프리뷰 */}
        <div
          className={`mx-auto mb-4 flex h-32 w-32 items-center justify-center rounded-2xl ${
            isHof
              ? "bg-gradient-to-br from-[hsl(42_92%_14%)] via-card to-card ring-2 ring-reward/60"
              : "bg-muted/40"
          }`}
        >
          <OptionPreview category={category} optionKey={option.key} />
        </div>

        {/* 이름 + 카테고리 */}
        <div className="mb-4 text-center">
          <h2 className="text-xl font-black text-foreground">{displayLabel}</h2>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-muted/70 px-3 py-0.5 text-xs font-bold text-muted-foreground">
            {catMeta?.icon}
            <span>{catMeta?.label}</span>
            {isHof && (
              <>
                <span className="mx-1 opacity-40">·</span>
                <Crown className="h-3 w-3 text-reward" />
                <span className="text-reward">명예의 전당 전용</span>
              </>
            )}
          </span>
        </div>

        {/* 가격 내역 — admin 은 ∞ / 지갑 무차감 표시 */}
        <div className="mb-5 space-y-2 rounded-2xl bg-muted/50 p-3.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">가격</span>
            <span className="font-black text-foreground">
              💵 {option.price.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">현재 잔액</span>
            <span className="font-bold">
              {isAdmin ? "∞" : walletBalance.toLocaleString()}
            </span>
          </div>
          {!isAdmin && (
            <div className="flex justify-between border-t border-border/50 pt-2 text-sm">
              <span className="text-muted-foreground">구매 후 잔액</span>
              <span
                className={`font-bold ${
                  afterBalance < 0 ? "text-destructive" : "text-foreground"
                }`}
              >
                {afterBalance.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {!canAfford && !isAdmin && (
          <div className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-[12px] font-bold text-destructive">
            파이트 머니가 {(option.price - walletBalance).toLocaleString()}원 부족합니다
          </div>
        )}

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isPurchasing}
            className="flex-1 rounded-2xl border border-border bg-secondary py-3.5 text-sm font-bold text-secondary-foreground transition-all active:scale-95 disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isPurchasing || !canAfford}
            className={cn(
              "flex-[2] rounded-2xl py-3.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-50",
              canAfford
                ? "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-[0_4px_14px_-4px_rgba(217,54,32,0.6)]"
                : "bg-muted text-muted-foreground",
            )}
          >
            {isPurchasing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                구매 중...
              </span>
            ) : !canAfford ? (
              "파이트 머니 부족"
            ) : (
              "💰 구매하기"
            )}
          </button>
        </div>
      </div>
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
          // 실제 구매 기록(ownedStyles) 과 무료(price=0) 만 "보유" 로 인정.
          // admin 도 예외 없이 구매 플로우를 거친다 — 지갑 차감만 스킵(handleConfirmPurchase 참고).
          const isOwned = ownedStyles.has(char.style) || char.price === 0;
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
                💵 {char.price.toLocaleString()}
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
                    <Sparkles className="h-3.5 w-3.5 text-reward" />
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

              {/* Name + price label + action button */}
              <div className="p-2.5 pt-1 space-y-1.5">
                <p className={`text-sm font-bold text-center leading-tight line-clamp-2 ${labelColor}`}>
                  {char.label}
                </p>
                {/* 가격 라벨 — 상태(잠김/적용중/보유/구매가능) 무관하게 항상 노출.
                    FREE 는 녹색, 유료는 💵 {가격}, 보유한 유료는 "· 보유" 꼬리표 추가. */}
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold leading-none">
                  {char.price === 0 ? (
                    <span className="text-emerald-500">🎁 FREE</span>
                  ) : (
                    <>
                      <span className={isHof ? "text-amber-400" : "text-muted-foreground"}>
                        💵 {char.price.toLocaleString()}
                      </span>
                      {isOwned && (
                        <span className="text-emerald-500">· ✓ 보유</span>
                      )}
                    </>
                  )}
                </div>
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
            <span className="font-black text-foreground">💵 {char.price.toLocaleString()}</span>
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
              "파이트 머니 부족"
            ) : (
              "💰 구매하기"
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
                className="h-full rounded-full bg-gradient-to-r from-primary to-reward transition-all"
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
