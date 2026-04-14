import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shuffle, Save, Check, Sparkles, Palette, Image } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PREBUILT_CHARACTERS, getRandomCharacter } from "@/data/characterPresets";
import {
  PARTS_BY_CATEGORY,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
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

type StudioMode = "preset" | "parts";

const CharacterStudioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: assignment } = useMemberCharacterAssignment();
  const { data: templatePresets } = useTemplatePresets();
  const assignCharacter = useAssignCharacter();
  const saveCustomPreset = useSaveCustomPreset();

  // Mode
  const [mode, setMode] = useState<StudioMode>("preset");

  // === PRESET MODE STATE ===
  const currentStyle = (assignment?.character_presets as any)?.parts_json?.style;
  const [selectedStyle, setSelectedStyle] = useState<string>(currentStyle || "male_01");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");

  // === PARTS MODE STATE ===
  const currentParts = (assignment?.character_presets as any)?.parts_json?.parts as PartsSelection | undefined;
  const [partsSelection, setPartsSelection] = useState<PartsSelection>(currentParts || DEFAULT_SELECTION);
  const [activeCategory, setActiveCategory] = useState("skin");

  const filteredCharacters = genderFilter === "all"
    ? PREBUILT_CHARACTERS
    : PREBUILT_CHARACTERS.filter(c => c.gender === genderFilter);

  const selectedChar = PREBUILT_CHARACTERS.find(c => c.style === selectedStyle) || PREBUILT_CHARACTERS[0];

  const handleRandomize = useCallback(() => {
    if (mode === "preset") {
      const random = getRandomCharacter();
      setSelectedStyle(random.style);
    } else {
      setPartsSelection(getRandomSelection());
    }
  }, [mode]);

  const handlePartSelect = useCallback((category: string, key: string) => {
    setPartsSelection(prev => {
      // Toggle off if same
      if (prev[category] === key && (category === "accessory" || category === "effect")) {
        const next = { ...prev };
        delete next[category];
        return next;
      }
      return { ...prev, [category]: key };
    });
  }, []);

  const handleSavePreset = async () => {
    if (!user?.id) return;

    if (mode === "preset") {
      // Find matching preset from DB
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
          name: `커스텀_${Date.now()}`,
          partsJson: { parts: partsSelection },
        });
        await assignCharacter.mutateAsync({ userId: user.id, presetId: preset.id });
        toast.success("커스텀 캐릭터가 저장되었습니다! 🥊");
      } catch (e: any) {
        toast.error(e.message || "저장 실패");
      }
    }
  };

  const isSaving = assignCharacter.isPending || saveCustomPreset.isPending;
  const isPresetSaved = mode === "preset" && currentStyle === selectedStyle;

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

      {/* Mode Toggle */}
      <div className="mb-4 flex rounded-2xl border border-border bg-secondary/50 p-1">
        <button
          onClick={() => setMode("preset")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all ${
            mode === "preset" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Image className="h-4 w-4" />
          프리셋 선택
        </button>
        <button
          onClick={() => setMode("parts")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all ${
            mode === "parts" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Palette className="h-4 w-4" />
          파츠 조합
        </button>
      </div>

      {/* Character Preview */}
      <div className="mb-5 animate-slide-up rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-6 shadow-sm">
        <div className="relative mx-auto flex h-52 w-52 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
          {mode === "preset" ? (
            <CharacterSprite
              style={selectedStyle}
              size="lg"
              animate
              className="relative z-10 !w-44 !h-44"
            />
          ) : (
            <CharacterSprite
              partsJson={{ parts: partsSelection }}
              size="lg"
              animate
              className="relative z-10 !w-44 !h-44"
            />
          )}
        </div>
        <div className="mt-3 text-center">
          {mode === "preset" ? (
            <>
              <p className="text-lg font-bold text-foreground">{selectedChar.label}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedChar.gender === "male" ? "남성" : "여성"} · {selectedChar.color}
              </p>
            </>
          ) : (
            <p className="text-sm font-bold text-foreground">커스텀 캐릭터</p>
          )}
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSavePreset}
        disabled={isSaving || isPresetSaved}
        className={`mb-5 w-full rounded-2xl py-3.5 text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50 ${
          isPresetSaved
            ? "bg-status-complete/20 text-status-complete"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {isSaving ? (
          "저장 중..."
        ) : isPresetSaved ? (
          <span className="flex items-center justify-center gap-2">
            <Check className="h-4 w-4" /> 현재 캐릭터
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Save className="h-4 w-4" /> 이 캐릭터로 저장
          </span>
        )}
      </button>

      {/* === PRESET MODE === */}
      {mode === "preset" && (
        <>
          {/* Gender Filter */}
          <div className="mb-4 flex rounded-2xl border border-border bg-secondary/50 p-1">
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
              const isSelected = selectedStyle === char.style;
              return (
                <button
                  key={char.style}
                  onClick={() => setSelectedStyle(char.style)}
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
                  {currentStyle === char.style && (
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
        </>
      )}

      {/* === PARTS MODE === */}
      {mode === "parts" && (
        <>
          {/* Category Tabs - Horizontal Scroll */}
          <div className="mb-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1.5 pb-1" style={{ minWidth: "max-content" }}>
              {CATEGORY_ORDER.map(cat => (
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
          <div className="grid grid-cols-4 gap-2.5">
            {(PARTS_BY_CATEGORY[activeCategory] || []).map(part => {
              const isSelected = partsSelection[activeCategory] === part.key;
              return (
                <button
                  key={part.key}
                  onClick={() => handlePartSelect(activeCategory, part.key)}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 p-2.5 transition-all active:scale-95 ${
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
                  {/* Part preview swatch */}
                  <PartSwatch part={part} category={activeCategory} />
                  <span className="text-[10px] font-bold text-foreground/80 truncate w-full text-center leading-tight">
                    {part.label}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Info */}
      <div className="mt-6 rounded-2xl border border-dashed border-border p-4 text-center">
        <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          {mode === "parts"
            ? "파츠를 선택해서 나만의 캐릭터를 만들어보세요!"
            : "더 많은 캐릭터와 커스텀 파츠가 곧 추가됩니다!"}
        </p>
      </div>
    </div>
  );
};

/** Mini swatch preview for a part */
function PartSwatch({ part, category }: { part: any; category: string }) {
  const c = part.config;

  // Color-based categories show a colored circle/swatch
  if (category === "skin" || category === "gloves" || category === "top" || category === "shorts" || category === "shoes") {
    return (
      <div
        className="h-9 w-9 rounded-xl border border-border/50 shadow-inner"
        style={{
          background: `linear-gradient(135deg, ${c.fill} 60%, ${c.shadow || c.fill}aa)`,
        }}
      />
    );
  }

  // Hair shows color circle
  if (category === "hair_back" || category === "hair_front") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50" style={{ background: c.fill }}>
        <span className="text-[10px] text-white/80 font-bold">
          {c.style === "short" ? "숏" : c.style === "medium" ? "미디" : c.style === "long" ? "롱" : c.style === "spiky" ? "스파이키" :
           c.style === "bangs" ? "앞" : c.style === "side" ? "사이드" : c.style === "swept" ? "스웹" : c.style === "curly" ? "컬리" : ""}
        </span>
      </div>
    );
  }

  // Eyes - show iris color
  if (category === "eyes") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-white">
        <div className="h-5 w-5 rounded-full border-2 border-foreground/10" style={{ background: c.iris }}>
          <div className="mt-1 ml-1 h-2 w-2 rounded-full" style={{ background: c.pupil }} />
        </div>
      </div>
    );
  }

  // Eyebrows - show style indicator
  if (category === "eyebrows") {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-secondary">
        <div className="flex gap-1">
          <div className="h-0.5 w-3 rounded-full" style={{ background: c.fill, height: c.style === "thick" ? "3px" : c.style === "thin" ? "1px" : "2px" }} />
          <div className="h-0.5 w-3 rounded-full" style={{ background: c.fill, height: c.style === "thick" ? "3px" : c.style === "thin" ? "1px" : "2px" }} />
        </div>
      </div>
    );
  }

  // Mouth - show expression icon
  if (category === "mouth") {
    const emoji = c.style === "smile" ? "😊" : c.style === "grin" ? "😁" : c.style === "serious" ? "😐" : c.style === "shout" ? "😤" : c.style === "smirk" ? "😏" : "😗";
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-secondary text-lg">
        {emoji}
      </div>
    );
  }

  // Accessory
  if (category === "accessory") {
    const icon = c.style === "headband" ? "🎗️" : c.style === "ribbon" ? "🎀" : c.style === "scar" ? "⚡" : c.style === "star" ? "⭐" : c.style === "bandage" ? "🩹" : "✨";
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-secondary text-lg">
        {icon}
      </div>
    );
  }

  // Effect
  if (category === "effect") {
    const icon = c.style === "sparkle" ? "✨" : c.style === "sweat" ? "💧" : c.style === "hearts" ? "💕" : c.style === "fire" ? "🔥" : "✨";
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-secondary text-lg">
        {icon}
      </div>
    );
  }

  return <div className="h-9 w-9 rounded-xl bg-secondary" />;
}

export default CharacterStudioPage;
