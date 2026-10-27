/**
 * 마이복서153 — 라이센스 카드 표시 모드 토글.
 *
 * 마이페이지에서 사용자가 라이센스 카드에 어떤 이미지를 보여줄지 선택:
 *   · 자동 (기본) — 사진 있으면 사진, 없으면 캐릭터, 없으면 이니셜
 *   · 사진       — 업로드한 사진 강제
 *   · 캐릭터     — 캐릭터 스튜디오 캐릭터 강제
 *
 * localStorage 저장 (디바이스마다 다름) — 그래서 이 폰의 홈 카드에만 적용된다.
 * 체육관 TV(라이브보드)는 회원 폰 설정을 알 수 없어 늘 사진 > 캐릭터 > 이니셜 순서다 (2026-10-14 문구 정정).
 * 입장 환영·얼굴/QR 출석 카드의 사진은 시범 지점(선릉역점)부터 (lib/pilotBranches).
 * 2026-10-28 리디자인: 세그먼트 한 줄(자동 · 사진 · 캐릭터) — 칸마다 붙던 설명 · 아래 안내 문장은 뺐다 (뜻은 aria-label 에).
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
    <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
      <h3 className="text-body font-bold text-foreground">라이센스 카드 표시</h3>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="라이센스 카드 표시">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${opt.label} — ${opt.hint}`}
              onClick={() => setMode(opt.value)}
              className={`flex h-11 items-center justify-center gap-1.5 rounded-lg text-label font-bold transition-all active:scale-95 ${
                active ? "bg-card text-primary shadow-elev-1" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DisplayModeToggle;
