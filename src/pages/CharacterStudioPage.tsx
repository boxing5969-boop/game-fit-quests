import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shuffle, Save, Check, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PREBUILT_CHARACTERS, getRandomCharacter, type PrebuiltCharacter } from "@/data/characterPresets";
import { useTemplatePresets, useAssignCharacter, useMemberCharacterAssignment } from "@/hooks/useCharacterData";
import CharacterSprite from "@/components/CharacterSprite";
import { toast } from "sonner";

const GENDER_TABS = [
  { key: "all", label: "전체" },
  { key: "male", label: "남성" },
  { key: "female", label: "여성" },
] as const;

const CharacterStudioPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: assignment } = useMemberCharacterAssignment();
  const { data: templatePresets } = useTemplatePresets();
  const assignCharacter = useAssignCharacter();

  // Current selection state
  const currentStyle = (assignment?.character_presets as any)?.parts_json?.style;
  const [selectedStyle, setSelectedStyle] = useState<string>(currentStyle || "male_01");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");

  const filteredCharacters = genderFilter === "all"
    ? PREBUILT_CHARACTERS
    : PREBUILT_CHARACTERS.filter(c => c.gender === genderFilter);

  const selectedChar = PREBUILT_CHARACTERS.find(c => c.style === selectedStyle) || PREBUILT_CHARACTERS[0];

  const handleRandomize = () => {
    const random = getRandomCharacter();
    setSelectedStyle(random.style);
  };

  const handleSave = async () => {
    if (!user?.id) return;
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
  };

  const isCurrentSaved = currentStyle === selectedStyle;

  return (
    <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
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
      <div className="mb-6 animate-slide-up rounded-3xl border border-border bg-gradient-to-b from-card to-secondary/30 p-6 shadow-sm">
        <div className="relative mx-auto flex h-52 w-52 items-center justify-center">
          {/* Glow behind */}
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
          <CharacterSprite
            style={selectedStyle}
            size="lg"
            animate
            className="relative z-10 !w-44 !h-44"
          />
        </div>
        <div className="mt-4 text-center">
          <p className="text-lg font-bold text-foreground">{selectedChar.label}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedChar.gender === "male" ? "남성" : "여성"} · {selectedChar.color}
          </p>
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={assignCharacter.isPending || isCurrentSaved}
        className={`mb-6 w-full rounded-2xl py-3.5 text-sm font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-50 ${
          isCurrentSaved
            ? "bg-status-complete/20 text-status-complete"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {assignCharacter.isPending ? (
          "저장 중..."
        ) : isCurrentSaved ? (
          <span className="flex items-center justify-center gap-2">
            <Check className="h-4 w-4" /> 현재 캐릭터
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Save className="h-4 w-4" /> 이 캐릭터로 저장
          </span>
        )}
      </button>

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

      {/* Info */}
      <div className="mt-6 rounded-2xl border border-dashed border-border p-4 text-center">
        <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          더 많은 캐릭터와 커스텀 파츠가 곧 추가됩니다!
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          관장님이 직접 에셋을 업로드하면 파츠 조합기가 활성화됩니다
        </p>
      </div>
    </div>
  );
};

export default CharacterStudioPage;
