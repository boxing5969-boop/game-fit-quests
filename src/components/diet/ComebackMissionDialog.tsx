import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Circle, Heart, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { successHaptic } from "@/lib/haptics";
import { celebrateComeback } from "@/lib/celebrations";
import {
  COMEBACK_MISSIONS,
  pickComebackLine,
  type ComebackMission,
} from "@/data/diet/comebackMissions";

interface ComebackMissionDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "망쳤어요" 버튼을 누르면 뜨는 복귀 미션 다이얼로그.
 *
 * 핵심 UX:
 *   - 죄책감 자극 0 · 완수 바(bar) 매우 낮음 (1개만 체크해도 성공)
 *   - 오삼 코치의 따뜻한 한마디가 상단에
 *   - 각 미션은 체크박스, localStorage 에 일자별 저장
 *   - 같은 날 다시 열면 체크 상태 복원
 */
const LOCAL_KEY_BASE = "diet_comeback_v1";

function todayKey(): string {
  const d = new Date();
  return `${LOCAL_KEY_BASE}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadChecks(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(todayKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveChecks(next: Record<string, boolean>) {
  try {
    localStorage.setItem(todayKey(), JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export const ComebackMissionDialog = ({ open, onClose }: ComebackMissionDialogProps) => {
  const [checks, setChecks] = useState<Record<string, boolean>>(() => loadChecks());
  const celebratedRef = useRef<boolean>(
    Object.values(loadChecks()).some(Boolean), // 재진입 시 중복 연출 방지
  );

  const warmLine = useMemo(() => pickComebackLine(), []);
  const completedCount = Object.values(checks).filter(Boolean).length;
  const isSuccess = completedCount >= 1;

  if (!open || typeof document === "undefined") return null;

  const toggle = (code: string) => {
    const prevCount = Object.values(checks).filter(Boolean).length;
    const next = { ...checks, [code]: !checks[code] };
    setChecks(next);
    saveChecks(next);

    // 오늘 첫 복귀 체크 시 1회만 축하 연출 — 햅틱 + 민트 콘페티
    const nextCount = Object.values(next).filter(Boolean).length;
    if (!celebratedRef.current && prevCount === 0 && nextCount > 0) {
      celebratedRef.current = true;
      try {
        successHaptic();
        celebrateComeback();
      } catch {
        // best-effort
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[72] flex items-end justify-center bg-background/80 p-4 backdrop-blur-sm animate-fade-in sm:items-center">
      <div className="relative w-full max-w-[440px] overflow-hidden rounded-3xl border border-emerald-400/40 bg-card shadow-elev-3">
        {/* 상단 mint glow */}
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />

        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-emerald-500" />
            <p className="text-[13px] font-extrabold text-foreground">오삼 코치의 복귀 루틴</p>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="rounded-full bg-muted p-1.5 active:scale-95"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {/* 오삼 코치 따뜻한 말 */}
          <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              COMEBACK · 끝이 아니라 쉼표
            </p>
            <p className="mt-1 text-[13px] font-extrabold leading-snug text-foreground">
              {warmLine}
            </p>
          </div>

          {/* 진행 요약 */}
          <p className="mt-3 text-center text-[11.5px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">{completedCount}</strong>개 완료 · 1개만 해도
            오늘은 복구 성공이에요.
          </p>

          {/* 미션 체크리스트 */}
          <ul className="mt-3 space-y-1.5">
            {COMEBACK_MISSIONS.map((m) => (
              <MissionRow
                key={m.code}
                mission={m}
                checked={!!checks[m.code]}
                onToggle={() => toggle(m.code)}
              />
            ))}
          </ul>

          {/* 성공 상태 배지 — 가볍게, 따뜻한 톤 */}
          {isSuccess && (
            <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-400/5 px-3 py-2.5 text-center">
              <Sparkles className="mx-auto h-4 w-4 text-emerald-500" />
              <p className="mt-0.5 text-[12px] font-extrabold text-emerald-600">
                오늘, 다시 돌아왔어요
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                복귀 속도가 진짜 힘입니다. 그걸 오늘 증명했어요.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-border px-5 py-3">
          <Button
            onClick={onClose}
            className={cn(
              "h-10 w-full rounded-xl font-bold",
              isSuccess
                ? "bg-emerald-500/90 text-white hover:bg-emerald-500"
                : "bg-primary text-primary-foreground",
            )}
          >
            {isSuccess ? "좋아요, 이어가볼게요" : "괜찮아요, 잠시 닫기"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

const MissionRow = ({
  mission,
  checked,
  onToggle,
}: {
  mission: ComebackMission;
  checked: boolean;
  onToggle: () => void;
}) => (
  <li>
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.99]",
        checked
          ? "border-emerald-400/40 bg-emerald-400/10"
          : "border-border bg-background hover:border-primary/40",
      )}
    >
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[18px]"
      >
        {mission.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[12.5px] font-extrabold",
            checked ? "text-emerald-500" : "text-foreground",
          )}
        >
          {mission.label}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {mission.hint}
        </p>
      </div>
      {checked ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  </li>
);

export default ComebackMissionDialog;
