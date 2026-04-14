import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shuffle, Save, Check, Sparkles, Lock, ChevronRight, Crown, Gem, RotateCcw, Paintbrush } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PREBUILT_CHARACTERS, getRandomCharacter } from "@/data/characterPresets";
import { getCurrentMilestone, UNLOCK_MILESTONES, getUnlockedPartKeys } from "@/data/characterUnlockData";
import { useTemplatePresets, useAssignCharacter, useMemberCharacterAssignment, useSaveCustomization } from "@/hooks/useCharacterData";
import { useWallet } from "@/hooks/useWallet";
import CharacterSprite from "@/components/CharacterSprite";
import RankBadge from "@/components/RankBadge";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import {
  CUSTOMIZATION_CATEGORIES,
  GLOVE_COLORS,
  EFFECT_EMOJIS,
  FRAME_STYLES,
  TITLE_LABELS,
  type CharacterCustomization,
} from "@/data/characterCustomizationData";

const TABS = [
  { key: "my", label: "내 캐릭터", icon: "🥊" },
  { key: "preset", label: "프리셋 선택", icon: "🎭" },
  { key: "customize", label: "꾸미기", icon: "🎨" },
  { key: "growth", label: "성장", icon: "📈" },
  { key: "effects", label: "효과", icon: "✨" },
] as const;

const GENDER_TABS = [
  { key: "all", label: "전체" },
  { key: "male", label: "남성" },
  { key: "female", label: "여성" },
] as const;

const LEAGUE_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };
const LEAGUE_COLORS: Record<string, string> = {
  white: "bg-gray-100 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-700",
  black: "bg-gray-900 text-amber-400",
};

const CharacterStudioPage = () => {
  const navigate = useNavigate();
  const { user, progress } = useAuth();
  const { data: assignment } = useMemberCharacterAssignment();
  const { data: templatePresets } = useTemplatePresets();
  const { data: walletData } = useWallet();
  const assignCharacter = useAssignCharacter();
  const saveCustomization = useSaveCustomization();

  const currentPartsJson = (assignment?.character_presets as any)?.parts_json;
  const currentStyle = currentPartsJson?.style;
  const currentCustomization: CharacterCustomization = currentPartsJson?.customization || {};
  const currentLeague = (progress?.current_rank || "white") as string;
  const currentLevel = progress?.current_level || 1;

  const unlockedKeys = useMemo(() => getUnlockedPartKeys(currentLeague, currentLevel), [currentLeague, currentLevel]);
  const { current: currentMilestone, next: nextMilestone } = useMemo(
    () => getCurrentMilestone(currentLeague, currentLevel),
    [currentLeague, currentLevel]
  );

  const [activeTab, setActiveTab] = useState<string>("my");
  const [selectedStyle, setSelectedStyle] = useState<string>(currentStyle || "male_01");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  // Customization state
  const [pendingCustomization, setPendingCustomization] = useState<CharacterCustomization>(currentCustomization);

  const filteredCharacters = genderFilter === "all"
    ? PREBUILT_CHARACTERS
    : PREBUILT_CHARACTERS.filter(c => c.gender === genderFilter);

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
    const matchingPreset = (templatePresets || []).find(p => {
      const pj = p.parts_json as any;
      return pj?.style === selectedStyle;
    });
    if (!matchingPreset) {
      toast.error("프리셋을 찾을 수 없습니다");
      return;
    }
    try {
      await assignCharacter.mutateAsync({ userId: user.id, presetId: matchingPreset.id });
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

  // Determine which customization to show in preview
  const previewCustomization = activeTab === "customize" ? pendingCustomization : currentCustomization;

  return (
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
              <span className="text-xs font-bold text-accent-foreground">{walletData?.gems_balance?.toLocaleString() || 0}</span>
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

      {/* Live Preview — Always PNG preset + overlay */}
      <div className="px-4 pt-4">
        <div className="relative rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-5 shadow-sm">
          <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            <CharacterSprite
              style={selectedStyle}
              userId={user?.id}
              size="lg"
              animate
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
          {/* Save button for preset tab */}
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
          {/* Save button for customize tab */}
          {activeTab === "customize" && (
            <button
              onClick={handleSaveCustomization}
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

      {/* Segmented Tabs */}
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
            unlockedKeys={unlockedKeys}
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
            genderFilter={genderFilter}
            setGenderFilter={setGenderFilter}
            onSelect={handleSelectPreset}
          />
        )}
        {activeTab === "customize" && (
          <CustomizeTab
            customization={pendingCustomization}
            onChange={setPendingCustomization}
          />
        )}
        {activeTab === "growth" && <GrowthTab league={currentLeague} level={currentLevel} unlockedKeys={unlockedKeys} />}
        {activeTab === "effects" && <EffectsTab league={currentLeague} level={currentLevel} />}
      </div>
    </div>
  );
};

// ========== MY CHARACTER TAB ==========
function MyCharacterTab({ currentStyle, league, level, navigate, unlockedKeys, currentMilestone, nextMilestone, currentCustomization }: {
  currentStyle?: string;
  league: string;
  level: number;
  navigate: (path: string) => void;
  unlockedKeys: Set<string>;
  currentMilestone: any;
  nextMilestone: any;
  currentCustomization: CharacterCustomization;
}) {
  const hasCharacter = !!currentStyle;
  const totalUnlocked = unlockedKeys.size;
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

      {/* Status cards */}
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

      {/* Next unlock */}
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

      {/* Quick links */}
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
function CustomizeTab({ customization, onChange }: {
  customization: CharacterCustomization;
  onChange: (c: CharacterCustomization) => void;
}) {
  const [activeCat, setActiveCat] = useState(CUSTOMIZATION_CATEGORIES[0].code);
  const category = CUSTOMIZATION_CATEGORIES.find(c => c.code === activeCat)!;

  const handleSelect = (catCode: string, optionKey: string) => {
    const current = (customization as any)[catCode];
    // Toggle: click again to deselect
    const newVal = current === optionKey ? undefined : optionKey;
    onChange({ ...customization, [catCode]: newVal });
  };

  const handleClearAll = () => {
    onChange({});
  };

  const activeCount = Object.values(customization).filter(Boolean).length;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {CUSTOMIZATION_CATEGORIES.map(cat => {
          const isActive = activeCat === cat.code;
          const hasSelection = !!(customization as any)[cat.code];
          return (
            <button
              key={cat.code}
              onClick={() => setActiveCat(cat.code)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : hasSelection
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              <span className="text-[11px]">{cat.icon}</span>
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Options grid */}
      <div className="grid grid-cols-4 gap-2">
        {category.options.map(opt => {
          const isSelected = (customization as any)[activeCat] === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleSelect(activeCat, opt.key)}
              className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 transition-all active:scale-95 ${
                isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card"
              }`}
            >
              {isSelected && (
                <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              <OptionPreview category={activeCat} optionKey={opt.key} />
              <span className="text-[9px] font-bold text-foreground/80 truncate w-full text-center">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Clear all */}
      {activeCount > 0 && (
        <button
          onClick={handleClearAll}
          className="w-full rounded-xl border border-border bg-secondary/50 py-2 text-xs text-muted-foreground active:scale-[0.98] transition-all"
        >
          전체 초기화 ({activeCount}개 적용 중)
        </button>
      )}

      <p className="text-[10px] text-center text-muted-foreground">
        꾸미기를 선택하면 위 프리뷰에 즉시 반영됩니다. 저장 버튼을 눌러 적용하세요!
      </p>
    </div>
  );
}

// Visual preview for each option type
function OptionPreview({ category, optionKey }: { category: string; optionKey: string }) {
  if (category === "gloveColor") {
    const color = GLOVE_COLORS[optionKey] || "#888";
    return (
      <div className="flex h-8 w-8 items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-card shadow-sm" style={{ backgroundColor: color }} />
      </div>
    );
  }
  if (category === "effect") {
    const emoji = EFFECT_EMOJIS[optionKey] || "✨";
    return <span className="text-2xl">{emoji}</span>;
  }
  if (category === "accessory") {
    const emojis: Record<string, string> = {
      headband_red: "🎗️", headband_black: "🖤", sunglasses: "🕶️",
      bandage: "🩹", sweatband: "💦", mouthguard: "😤",
    };
    return <span className="text-2xl">{emojis[optionKey] || "🎀"}</span>;
  }
  if (category === "frame") {
    const colors: Record<string, string> = {
      fire: "border-orange-500 shadow-orange-500/30",
      ice: "border-cyan-400 shadow-cyan-400/30",
      gold: "border-amber-400 shadow-amber-400/30",
      shadow: "border-gray-600 shadow-gray-600/30",
    };
    return (
      <div className={`h-8 w-8 rounded-full border-2 shadow-md ${colors[optionKey] || "border-border"}`} />
    );
  }
  if (category === "title") {
    const info = TITLE_LABELS[optionKey];
    return <span className={`text-sm font-bold ${info?.color || "text-foreground"}`}>{info?.text || optionKey}</span>;
  }
  return <span className="text-lg">❓</span>;
}

// ========== PRESET TAB ==========
function PresetTab({ filteredCharacters, selectedStyle, currentStyle, genderFilter, setGenderFilter, onSelect }: {
  filteredCharacters: typeof PREBUILT_CHARACTERS;
  selectedStyle: string;
  currentStyle?: string;
  genderFilter: string;
  setGenderFilter: (f: any) => void;
  onSelect: (style: string) => void;
}) {
  return (
    <div className="space-y-3 animate-slide-up">
      <div className="flex rounded-xl border border-border bg-secondary/50 p-0.5">
        {GENDER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setGenderFilter(tab.key)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
              genderFilter === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {filteredCharacters.map(char => {
          const isSelected = selectedStyle === char.style;
          const isCurrent = currentStyle === char.style;
          return (
            <button
              key={char.style}
              onClick={() => onSelect(char.style)}
              className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 transition-all active:scale-95 ${
                isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card"
              }`}
            >
              {isSelected && (
                <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              {isCurrent && !isSelected && (
                <div className="absolute -top-1 -left-1">
                  <Sparkles className="h-3 w-3 text-accent" />
                </div>
              )}
              <CharacterSprite style={char.style} size="sm" />
              <span className="text-[9px] font-bold text-foreground/80 truncate w-full text-center">{char.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-center text-muted-foreground">
        프리셋을 선택한 후 저장 버튼을 눌러 내 캐릭터로 설정하세요
      </p>
    </div>
  );
}

// ========== GROWTH TAB ==========
function GrowthTab({ league, level, unlockedKeys }: { league: string; level: number; unlockedKeys: Set<string> }) {
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

export default CharacterStudioPage;
