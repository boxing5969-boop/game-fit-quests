import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shuffle, Save, Check, Sparkles, ChevronDown, ChevronUp, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PREBUILT_CHARACTERS, getRandomCharacter } from "@/data/characterPresets";
import {
  PARTS_BY_CATEGORY,
  CATEGORY_LABELS,
  DEFAULT_SELECTION,
  getRandomSelection,
  type PartsSelection,
} from "@/data/characterPartsData";
import { useTemplatePresets, useAssignCharacter, useMemberCharacterAssignment, useSaveCustomPreset } from "@/hooks/useCharacterData";
import CharacterSprite from "@/components/CharacterSprite";
import { toast } from "sonner";

const GENDER_TABS = [
  { key: "all", label: "전체" },
  { key: "male", label: "남성" },
  { key: "female", label: "여성" },
] as const;

/** Categories exposed in the customization panel — ordered by visual impact & quality */
const CUSTOMIZE_CATEGORIES = [
  "gloves", "top", "shorts", "hair_front", "hair_back",
  "eyes", "mouth", "shoes", "skin", "eyebrows",
  "accessory", "effect",
];

const CharacterStudioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: assignment } = useMemberCharacterAssignment();
  const { data: templatePresets } = useTemplatePresets();
  const assignCharacter = useAssignCharacter();
  const saveCustomPreset = useSaveCustomPreset();

  // Current assignment info
  const currentPartsJson = (assignment?.character_presets as any)?.parts_json;
  const currentStyle = currentPartsJson?.style;
  const currentParts = currentPartsJson?.parts as PartsSelection | undefined;

  // State
  const [selectedStyle, setSelectedStyle] = useState<string>(currentStyle || "male_01");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [customizeOpen, setCustomizeOpen] = useState(false);
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
    setCustomizeOpen(false);
  }, []);

  const handleOpenCustomize = useCallback(() => {
    setCustomizeOpen(true);
    setIsCustomized(true);
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
    if (customizeOpen) {
      setPartsSelection(getRandomSelection());
      setIsCustomized(true);
    } else {
      const random = getRandomCharacter();
      setSelectedStyle(random.style);
      setIsCustomized(false);
    }
  }, [customizeOpen]);

  const handleResetToPreset = useCallback(() => {
    setIsCustomized(false);
    setCustomizeOpen(false);
  }, []);

  const handleSavePreset = async () => {
    if (!user?.id) return;

    if (!isCustomized) {
      // Save preset directly
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
    } else {
      // Save custom parts preset then assign
      try {
        const preset = await saveCustomPreset.mutateAsync({
          name: `${selectedChar.label}_커스텀`,
          partsJson: { parts: partsSelection, baseStyle: selectedStyle },
        });
        await assignCharacter.mutateAsync({ userId: user.id, presetId: preset.id });
        toast.success("커스텀 캐릭터가 저장되었습니다! 🥊");
      } catch (e: any) {
        toast.error(e.message || "저장 실패");
      }
    }
  };

  const isSaving = assignCharacter.isPending || saveCustomPreset.isPending;
  const isCurrentPreset = !isCustomized && currentStyle === selectedStyle;

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95 transition-transform">
            <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
          </button>
          <h1 className="text-xl text-foreground">캐릭터 스튜디오</h1>
        </div>
        <button
          onClick={handleRandomize}
          className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1.5 text-sm font-bold text-accent-foreground active:scale-95 transition-transform"
        >
          <Shuffle className="h-4 w-4" />
          랜덤
        </button>
      </div>

      {/* Character Preview */}
      <div className="mb-4 animate-slide-up rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-6 shadow-sm">
        <div className="relative mx-auto flex h-52 w-52 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
          {isCustomized ? (
            <CharacterSprite
              partsJson={{ parts: partsSelection }}
              size="lg"
              animate
              className="relative z-10 !w-44 !h-44"
            />
          ) : (
            <CharacterSprite
              style={selectedStyle}
              size="lg"
              animate
              className="relative z-10 !w-44 !h-44"
            />
          )}
        </div>
        <div className="mt-3 text-center">
          <p className="text-lg font-bold text-foreground">
            {isCustomized ? `${selectedChar.label} (커스텀)` : selectedChar.label}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedChar.gender === "male" ? "남성" : "여성"} · {selectedChar.color}
          </p>
        </div>
      </div>

      {/* Save + Customize Buttons */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={handleSavePreset}
          disabled={isSaving || isCurrentPreset}
          className={`flex-1 rounded-2xl py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50 ${
            isCurrentPreset
              ? "bg-status-complete/20 text-status-complete"
              : "bg-primary text-primary-foreground"
          }`}
        >
          {isSaving ? "저장 중..." : isCurrentPreset ? (
            <span className="flex items-center justify-center gap-2"><Check className="h-4 w-4" /> 현재 캐릭터</span>
          ) : (
            <span className="flex items-center justify-center gap-2"><Save className="h-4 w-4" /> 저장</span>
          )}
        </button>
        {!customizeOpen ? (
          <button
            onClick={handleOpenCustomize}
            className="flex items-center gap-1.5 rounded-2xl border-2 border-primary/30 bg-primary/5 px-4 py-3 text-sm font-bold text-primary transition-all active:scale-[0.98]"
          >
            <Sparkles className="h-4 w-4" />
            세부 꾸미기
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleResetToPreset}
            className="flex items-center gap-1.5 rounded-2xl border-2 border-border bg-secondary/50 px-4 py-3 text-sm font-bold text-muted-foreground transition-all active:scale-[0.98]"
          >
            <X className="h-4 w-4" />
            프리셋으로
          </button>
        )}
      </div>

      {/* === CUSTOMIZATION PANEL (inline, opens below) === */}
      {customizeOpen && (
        <div className="mb-5 animate-slide-up rounded-2xl border border-primary/20 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">파츠 세부 조정</span>
            <button onClick={() => setCustomizeOpen(false)} className="rounded-full bg-secondary p-1.5 active:scale-95">
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className="mb-3 overflow-x-auto scrollbar-hide">
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

          {/* Parts Grid */}
          <div className="grid grid-cols-4 gap-2">
            {(PARTS_BY_CATEGORY[activeCategory] || []).map(part => {
              const isSelected = partsSelection[activeCategory] === part.key;
              return (
                <button
                  key={part.key}
                  onClick={() => handlePartSelect(activeCategory, part.key)}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition-all active:scale-95 ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 rounded-full bg-primary p-0.5">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
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
      )}

      {/* === PRESET GRID (always visible) === */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-foreground">프리셋 선택</span>
      </div>

      {/* Gender Filter */}
      <div className="mb-3 flex rounded-2xl border border-border bg-secondary/50 p-1">
        {GENDER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setGenderFilter(tab.key as any)}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all ${
              genderFilter === tab.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Character Grid */}
      <div className="grid grid-cols-4 gap-3">
        {filteredCharacters.map(char => {
          const isSelected = !isCustomized && selectedStyle === char.style;
          return (
            <button
              key={char.style}
              onClick={() => handleSelectPreset(char.style)}
              className={`relative flex flex-col items-center gap-1.5 rounded-2xl border-2 p-3 transition-all active:scale-95 ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card"
              }`}
            >
              {isSelected && (
                <div className="absolute -top-1.5 -right-1.5 rounded-full bg-primary p-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              {currentStyle === char.style && !currentParts && (
                <div className="absolute -top-1.5 -left-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                </div>
              )}
              <CharacterSprite style={char.style} size="sm" />
              <span className="text-[10px] font-bold text-foreground/80 truncate w-full text-center">
                {char.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Info */}
      <div className="mt-6 rounded-2xl border border-dashed border-border p-4 text-center">
        <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          프리셋을 선택한 뒤 "세부 꾸미기"로 파츠를 커스텀할 수 있습니다
        </p>
      </div>
    </div>
  );
};

/** Mini swatch preview for a part */
function PartSwatch({ part, category }: { part: any; category: string }) {
  const c = part.config;

  if (category === "skin" || category === "gloves" || category === "top" || category === "shorts" || category === "shoes") {
    return (
      <div
        className="h-8 w-8 rounded-lg border border-border/50 shadow-inner"
        style={{
          background: `linear-gradient(135deg, ${c.fill} 60%, ${c.shadow || c.fill}aa)`,
        }}
      />
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

  if (category === "effect") {
    const icon = c.style === "sparkle" ? "✨" : c.style === "sweat" ? "💧" : c.style === "hearts" ? "💕" : c.style === "fire" ? "🔥" : "✨";
    return <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-secondary text-base">{icon}</div>;
  }

  return <div className="h-8 w-8 rounded-lg bg-secondary" />;
}

export default CharacterStudioPage;
