import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shuffle, Save, Check, Sparkles, Lock, ChevronRight, Crown, Gem } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PREBUILT_CHARACTERS, getRandomCharacter } from "@/data/characterPresets";
import {
  PARTS_BY_CATEGORY,
  CATEGORY_LABELS,
  DEFAULT_SELECTION,
  getRandomSelection,
  type PartsSelection,
} from "@/data/characterPartsData";
import { getUnlockedPartKeys, getCurrentMilestone, UNLOCK_MILESTONES } from "@/data/characterUnlockData";
import { useTemplatePresets, useAssignCharacter, useMemberCharacterAssignment, useSaveCustomPreset } from "@/hooks/useCharacterData";
import { useWallet } from "@/hooks/useWallet";
import CharacterSprite from "@/components/CharacterSprite";
import RankBadge from "@/components/RankBadge";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";

const TABS = [
  { key: "my", label: "내 캐릭터", icon: "🥊" },
  { key: "preset", label: "프리셋", icon: "🎭" },
  { key: "parts", label: "꾸미기", icon: "✂️" },
  { key: "growth", label: "성장", icon: "📈" },
  { key: "effects", label: "효과", icon: "✨" },
] as const;

const CUSTOMIZE_CATEGORIES = [
  "skin", "hair_front", "hair_back", "eyebrows", "eyes", "mouth",
  "gloves", "top", "shorts", "shoes", "accessory",
];

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
  const saveCustomPreset = useSaveCustomPreset();

  const currentPartsJson = (assignment?.character_presets as any)?.parts_json;
  const currentStyle = currentPartsJson?.style;
  const currentParts = currentPartsJson?.parts as PartsSelection | undefined;
  const currentLeague = (progress?.current_rank || "white") as string;
  const currentLevel = progress?.current_level || 1;

  // Unlock data
  const unlockedKeys = useMemo(() => getUnlockedPartKeys(currentLeague, currentLevel), [currentLeague, currentLevel]);
  const { current: currentMilestone, next: nextMilestone } = useMemo(
    () => getCurrentMilestone(currentLeague, currentLevel),
    [currentLeague, currentLevel]
  );

  // State
  const [activeTab, setActiveTab] = useState<string>("my");
  const [selectedStyle, setSelectedStyle] = useState<string>(currentStyle || "male_01");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [partsSelection, setPartsSelection] = useState<PartsSelection>(currentParts || DEFAULT_SELECTION);
  const [activeCategory, setActiveCategory] = useState("gloves");
  const [isCustomized, setIsCustomized] = useState(!!currentParts);

  const filteredCharacters = genderFilter === "all"
    ? PREBUILT_CHARACTERS
    : PREBUILT_CHARACTERS.filter(c => c.gender === genderFilter);

  const selectedChar = PREBUILT_CHARACTERS.find(c => c.style === selectedStyle) || PREBUILT_CHARACTERS[0];

  const handleSelectPreset = useCallback((style: string) => {
    setSelectedStyle(style);
    setIsCustomized(false);
  }, []);

  const handlePartSelect = useCallback((category: string, key: string) => {
    setPartsSelection(prev => {
      if (prev[category] === key && (category === "accessory" || category === "effect")) {
        const next = { ...prev };
        delete next[category];
        return next;
      }
      return { ...prev, [category]: key };
    });
    setIsCustomized(true);
  }, []);

  const handleRandomize = useCallback(() => {
    if (activeTab === "parts") {
      setPartsSelection(getRandomSelection());
      setIsCustomized(true);
    } else {
      const random = getRandomCharacter();
      setSelectedStyle(random.style);
      setIsCustomized(false);
    }
  }, [activeTab]);

  const handleSavePreset = async () => {
    if (!user?.id) return;
    if (!isCustomized) {
      const matchingPreset = (templatePresets || []).find(p => {
        const pj = p.parts_json as any;
        return pj?.style === selectedStyle;
      });
      if (!matchingPreset) { toast.error("프리셋을 찾을 수 없습니다"); return; }
      try {
        await assignCharacter.mutateAsync({ userId: user.id, presetId: matchingPreset.id });
        toast.success("내 캐릭터가 저장되었습니다! 🥊");
      } catch (e: any) { toast.error(e.message || "저장 실패"); }
    } else {
      try {
        const preset = await saveCustomPreset.mutateAsync({
          name: `${selectedChar.label}_커스텀`,
          partsJson: { parts: partsSelection, baseStyle: selectedStyle },
        });
        await assignCharacter.mutateAsync({ userId: user.id, presetId: preset.id });
        toast.success("커스텀 캐릭터가 저장되었습니다! 🥊");
      } catch (e: any) { toast.error(e.message || "저장 실패"); }
    }
  };

  const isSaving = assignCharacter.isPending || saveCustomPreset.isPending;
  const isCurrentPreset = !isCustomized && currentStyle === selectedStyle;

  // Preview character
  const previewPartsJson = isCustomized ? { parts: partsSelection } : undefined;
  const previewStyle = isCustomized ? undefined : selectedStyle;

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
            <button onClick={handleRandomize} className="rounded-full bg-secondary p-2 active:scale-95 transition-transform">
              <Shuffle className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="px-4 pt-4">
        <div className="relative rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-5 shadow-sm">
          <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
            <CharacterSprite
              style={previewStyle}
              partsJson={previewPartsJson as any}
              userId={user?.id}
              size="lg"
              animate
              league={currentLeague as any}
              level={currentLevel}
              className="relative z-10 !w-40 !h-40"
            />
          </div>
          <div className="mt-2 text-center">
            <p className="text-base font-bold text-foreground">
              {isCustomized ? `${selectedChar.label} (커스텀)` : selectedChar.label}
            </p>
            <div className="mt-1.5 flex items-center justify-center gap-2">
              <RankBadge rank={currentLeague as Enums<"rank_name">} level={currentLevel} size="sm" />
              {currentMilestone && (
                <span className="text-[10px] text-muted-foreground">{currentMilestone.icon} {currentMilestone.label}</span>
              )}
            </div>
          </div>
          {/* Save button overlaid */}
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
        </div>
      </div>

      {/* Segmented Tabs */}
      <div className="px-4 mt-4">
        <div className="flex rounded-2xl border border-border bg-secondary/50 p-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold transition-all ${
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
        {activeTab === "my" && <MyCharacterTab currentStyle={currentStyle} currentParts={currentParts} league={currentLeague} level={currentLevel} navigate={navigate} />}
        {activeTab === "preset" && (
          <PresetTab
            filteredCharacters={filteredCharacters}
            selectedStyle={selectedStyle}
            isCustomized={isCustomized}
            currentStyle={currentStyle}
            currentParts={currentParts}
            genderFilter={genderFilter}
            setGenderFilter={setGenderFilter}
            onSelect={handleSelectPreset}
          />
        )}
        {activeTab === "parts" && (
          <PartsTab
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            partsSelection={partsSelection}
            onPartSelect={handlePartSelect}
            unlockedKeys={unlockedKeys}
          />
        )}
        {activeTab === "growth" && <GrowthTab league={currentLeague} level={currentLevel} unlockedKeys={unlockedKeys} />}
        {activeTab === "effects" && <EffectsTab league={currentLeague} level={currentLevel} partsSelection={partsSelection} onPartSelect={handlePartSelect} />}
      </div>
    </div>
  );
};

// ========== MY CHARACTER TAB ==========
function MyCharacterTab({ currentStyle, currentParts, league, level, navigate }: {
  currentStyle?: string; currentParts?: PartsSelection; league: string; level: number; navigate: (path: string) => void;
}) {
  const hasCharacter = !!(currentStyle || currentParts);
  const { current, next } = getCurrentMilestone(league, level);
  const totalUnlocked = getUnlockedPartKeys(league, level).size;

  return (
    <div className="space-y-4 animate-slide-up">
      {!hasCharacter && (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
          <span className="text-4xl">🥊</span>
          <p className="mt-2 text-sm font-bold text-foreground">아직 캐릭터를 선택하지 않았어요</p>
          <p className="text-xs text-muted-foreground mt-1">"프리셋" 탭에서 마음에 드는 복서를 골라보세요!</p>
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
          <span className="text-lg">🧩</span>
          <span className="mt-1 text-lg font-bold text-foreground">{totalUnlocked}</span>
          <span className="text-[10px] text-muted-foreground">해금 파츠</span>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-3">
          <span className="text-lg">{current?.icon || "🥊"}</span>
          <span className="mt-1 text-xs font-bold text-foreground truncate w-full text-center">{current?.label || "입문"}</span>
          <span className="text-[10px] text-muted-foreground">현재 등급</span>
        </div>
      </div>

      {/* Next unlock */}
      {next && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{next.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">다음 해금: {next.label}</p>
              <p className="text-xs text-muted-foreground">{next.description}</p>
              <p className="text-[10px] text-primary mt-0.5">
                {LEAGUE_LABELS[next.league]} 리그 Lv.{next.levelRange[0]} 도달 시
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

// ========== PRESET TAB ==========
function PresetTab({ filteredCharacters, selectedStyle, isCustomized, currentStyle, currentParts, genderFilter, setGenderFilter, onSelect }: {
  filteredCharacters: typeof PREBUILT_CHARACTERS;
  selectedStyle: string;
  isCustomized: boolean;
  currentStyle?: string;
  currentParts?: PartsSelection;
  genderFilter: string;
  setGenderFilter: (f: any) => void;
  onSelect: (style: string) => void;
}) {
  return (
    <div className="space-y-3 animate-slide-up">
      {/* Gender Filter */}
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

      {/* Grid */}
      <div className="grid grid-cols-4 gap-2.5">
        {filteredCharacters.map(char => {
          const isSelected = !isCustomized && selectedStyle === char.style;
          const isCurrent = currentStyle === char.style && !currentParts;
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
              {isCurrent && (
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
    </div>
  );
}

// ========== PARTS TAB ==========
function PartsTab({ activeCategory, setActiveCategory, partsSelection, onPartSelect, unlockedKeys }: {
  activeCategory: string;
  setActiveCategory: (c: string) => void;
  partsSelection: PartsSelection;
  onPartSelect: (cat: string, key: string) => void;
  unlockedKeys: Set<string>;
}) {
  return (
    <div className="space-y-3 animate-slide-up">
      {/* Category chips */}
      <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex gap-1.5 pb-1" style={{ minWidth: "max-content" }}>
          {CUSTOMIZE_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/70 text-muted-foreground"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Parts grid */}
      <div className="grid grid-cols-4 gap-2">
        {(PARTS_BY_CATEGORY[activeCategory] || []).map(part => {
          const isSelected = partsSelection[activeCategory] === part.key;
          const isLocked = !unlockedKeys.has(part.key);
          return (
            <button
              key={part.key}
              onClick={() => !isLocked && onPartSelect(activeCategory, part.key)}
              disabled={isLocked}
              className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all active:scale-95 disabled:opacity-40 ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : isLocked
                  ? "border-border bg-muted/30"
                  : "border-border bg-card"
              }`}
            >
              {isSelected && (
                <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
              {isLocked && (
                <div className="absolute -top-1 -right-1 rounded-full bg-muted p-0.5">
                  <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                </div>
              )}
              <PartSwatch part={part} category={activeCategory} />
              <span className="text-[9px] font-bold text-foreground/80 truncate w-full text-center leading-tight">
                {part.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ========== GROWTH TAB ==========
function GrowthTab({ league, level, unlockedKeys }: { league: string; level: number; unlockedKeys: Set<string> }) {
  const leagueIdx = { white: 0, blue: 1, red: 2, black: 3 }[league] ?? 0;

  return (
    <div className="space-y-3 animate-slide-up">
      <p className="text-xs text-muted-foreground">레벨을 올리고 새로운 캐릭터 파츠를 해금하세요!</p>

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
                    {isCompleted ? "✅" : isCurrent ? "🔓" : "🔒"} 파츠 {m.unlockedPartKeys.length}개
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
function EffectsTab({ league, level, partsSelection, onPartSelect }: {
  league: string; level: number; partsSelection: PartsSelection; onPartSelect: (cat: string, key: string) => void;
}) {
  const isBlack = league === "black";
  const isMaster = isBlack && level >= 10;
  const leagueIdx = { white: 0, blue: 1, red: 2, black: 3 }[league] ?? 0;
  const effectsUnlocked = leagueIdx >= 2; // Red league unlocks effects

  const effects = PARTS_BY_CATEGORY["effect"] || [];

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Aura Status */}
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

      {/* Effect Particles */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">이펙트 파티클</h3>
        {!effectsUnlocked ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <Lock className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">레드 리그부터 이펙트를 사용할 수 있습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {effects.map(part => {
              const isSelected = partsSelection["effect"] === part.key;
              const icon = part.config.style === "sparkle" ? "✨" : part.config.style === "sweat" ? "💧" : part.config.style === "hearts" ? "💕" : "🔥";
              return (
                <button
                  key={part.key}
                  onClick={() => onPartSelect("effect", part.key)}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-all active:scale-95 ${
                    isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card"
                  }`}
                >
                  <span className="text-2xl">{icon}</span>
                  <div className="text-left">
                    <p className="text-sm font-bold text-foreground">{part.label}</p>
                    {isSelected && <span className="text-[10px] text-primary">적용됨</span>}
                  </div>
                  {isSelected && <Check className="ml-auto h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* League effect tiers */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">리그별 프레스티지</h3>
        <div className="space-y-2">
          {[
            { l: "white", label: "화이트", desc: "기본 캐릭터", icon: "⬜", active: true },
            { l: "blue", label: "블루", desc: "세련된 스타일 해금", icon: "🔵", active: leagueIdx >= 1 },
            { l: "red", label: "레드", desc: "이펙트 파티클 해금", icon: "🔴", active: leagueIdx >= 2 },
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

// ========== PART SWATCH ==========
function PartSwatch({ part, category }: { part: any; category: string }) {
  const c = part.config;

  if (["skin", "gloves", "top", "shorts", "shoes"].includes(category)) {
    return (
      <div className="h-8 w-8 rounded-lg border border-border/50 shadow-inner"
        style={{ background: `linear-gradient(135deg, ${c.fill} 60%, ${c.shadow || c.fill}aa)` }} />
    );
  }
  if (category === "hair_back" || category === "hair_front") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50" style={{ background: c.fill }}>
        <span className="text-[8px] text-white/80 font-bold">
          {c.style === "short" ? "숏" : c.style === "medium" ? "미디" : c.style === "long" ? "롱" : c.style === "spiky" ? "뾰족" :
           c.style === "bangs" ? "앞" : c.style === "side" ? "옆" : c.style === "swept" ? "넘김" : c.style === "curly" ? "컬" : ""}
        </span>
      </div>
    );
  }
  if (category === "eyes") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-white">
        <div className="h-4 w-4 rounded-full border-2 border-foreground/10" style={{ background: c.iris }}>
          <div className="mt-0.5 ml-0.5 h-1.5 w-1.5 rounded-full" style={{ background: c.pupil }} />
        </div>
      </div>
    );
  }
  if (category === "eyebrows") {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-secondary">
        <div className="flex gap-1">
          <div className="w-2.5 rounded-full" style={{ background: c.fill, height: c.style === "thick" ? "3px" : c.style === "thin" ? "1px" : "2px" }} />
          <div className="w-2.5 rounded-full" style={{ background: c.fill, height: c.style === "thick" ? "3px" : c.style === "thin" ? "1px" : "2px" }} />
        </div>
      </div>
    );
  }
  if (category === "mouth") {
    const emoji = c.style === "smile" ? "😊" : c.style === "grin" ? "😁" : c.style === "serious" ? "😐" : c.style === "shout" ? "😤" : c.style === "smirk" ? "😏" : "😗";
    return <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-secondary text-base">{emoji}</div>;
  }
  if (category === "accessory") {
    const icon = c.style === "headband" ? "🎗️" : c.style === "ribbon" ? "🎀" : c.style === "scar" ? "⚡" : c.style === "star" ? "⭐" : c.style === "bandage" ? "🩹" : "✨";
    return <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-secondary text-base">{icon}</div>;
  }
  return <div className="h-8 w-8 rounded-lg bg-secondary" />;
}

export default CharacterStudioPage;
