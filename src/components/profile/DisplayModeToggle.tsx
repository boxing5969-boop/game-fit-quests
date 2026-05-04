/**
 * 마이복서153 — 라이센스 카드 표시 모드 토글.
 *
 * 마이페이지에서 사용자가 라이센스 카드에 어떤 이미지를 보여줄지 선택:
 *   · 자동 (기본) — 사진 있으면 사진, 없으면 캐릭터, 없으면 이니셜
 *   · 사진       — 업로드한 사진 강제
 *   · 캐릭터     — 캐릭터 스튜디오 캐릭터 강제
 *
 * localStorage 저장 (디바이스마다 다름).
 */

import { Camera, User, Sparkles } from "lucide-react";
import { useDisplayMode, type DisplayMode } from "@/hooks/useDisplayMode";

const OPTIONS: { value: DisplayMode; label: string; icon: typeof Camera; hint: string }[] = [
  { value: "auto", label: "자동", icon: Sparkles, hint: "사진→캐릭터→이니셜" },
  { value: "photo", label: "사진", icon: Camera, hint: "업로드한 사진" },
  { value: "character", label: "캐릭터", icon: User, hint: "스튜디오 캐릭터" },
];

const DisplayModeToggle = () => {
  const { mode, setMode } = useDisplayMode();

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">라이센스 카드 표시</h3>
        <span className="text-[10px] text-muted-foreground">홈 / 라이브보드</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMode(opt.value)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 transition-all active:scale-95 ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[11px] font-bold">{opt.label}</span>
              <span className="text-[9px] opacity-70 truncate w-full text-center">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DisplayModeToggle;
