/**
 * 153 — 관리자 레벨 조정 패널.
 *
 * 코치 / 관장 / super_admin 만 표시 (회원/일반은 자동 숨김).
 *
 * 5 액션:
 *   ⬆ 레벨업 (Lv +1)
 *   ⬇ 레벨다운 (Lv -1)
 *   🎯 보스전 클리어 (랭크 승급 가능)
 *   ⚙ 직접 설정 (리그 + 레벨 모달)
 *   💰 XP 지급 (수동 XP)
 *
 * 보호 원칙:
 *   · 모든 액션은 기존 RPC 호출 (member_progress 직접 update 0)
 *   · wallet 직접 update 0
 *   · 공식 미션 흐름 무수정
 *   · 권한 검증: useAuth().role + RPC 내부 권한 체크 (서버 측)
 *
 * 두 가지 모드:
 *   "compact" — 좁은 우측 패널용 (BranchManagerHome 미리보기)
 *   "full"    — 회원 상세 페이지 메인 영역용 (MemberDetailPage)
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Banknote,
  Settings2,
  Shield,
  Swords,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  useGrantManualXp,
  useManualLevelDown,
  useManualLevelUp,
  usePassBossBattle,
  useSetMemberLevel,
} from "@/hooks/useQuestData";

const RANK_LABELS: Record<string, string> = {
  white: "화이트",
  blue: "블루",
  red: "레드",
  black: "블랙",
};

const RANK_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: "white", label: "화이트", color: "text-rank-white" },
  { value: "blue", label: "블루", color: "text-rank-blue" },
  { value: "red", label: "레드", color: "text-rank-red" },
  { value: "black", label: "블랙", color: "text-rank-black" },
];

export interface LevelAdminPanelProps {
  memberId: string;
  /** memberName/currentRank/currentLevel 이 없으면 panel 자체가 fetch (compact 모드 편의용) */
  memberName?: string;
  currentRank?: string;
  currentLevel?: number;
  /** "compact" — 좁은 패널용. "full" — 메인 영역용 (default). */
  mode?: "compact" | "full";
}

const LevelAdminPanel = ({
  memberId,
  memberName: memberNameProp,
  currentRank: currentRankProp,
  currentLevel: currentLevelProp,
  mode = "full",
}: LevelAdminPanelProps) => {
  const { role } = useAuth();
  const isAuthorized =
    role === "super_admin" ||
    role === "admin" ||
    role === "branch_manager" ||
    role === "coach";

  // props 부족 시 자동 fetch (memberId 만 알아도 panel 표시 가능)
  const needsFetch =
    !memberNameProp || !currentRankProp || currentLevelProp == null;
  const { data: fetched } = useQuery({
    queryKey: ["level-admin-panel-member", memberId],
    enabled: isAuthorized && needsFetch && !!memberId,
    staleTime: 30_000,
    queryFn: async () => {
      const [profileRes, progressRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, name, nickname")
          .eq("user_id", memberId)
          .maybeSingle(),
        supabase
          .from("member_progress")
          .select("current_rank, current_level")
          .eq("user_id", memberId)
          .maybeSingle(),
      ]);
      return {
        name:
          profileRes.data?.nickname ||
          profileRes.data?.name ||
          "선택된 회원",
        rank: progressRes.data?.current_rank ?? "white",
        level: progressRes.data?.current_level ?? 1,
      };
    },
  });

  const memberName = memberNameProp ?? fetched?.name ?? "선택된 회원";
  const currentRank = currentRankProp ?? fetched?.rank ?? "white";
  const currentLevel = currentLevelProp ?? fetched?.level ?? 1;

  const levelUp = useManualLevelUp();
  const levelDown = useManualLevelDown();
  const setLevel = useSetMemberLevel();
  const passBoss = usePassBossBattle();
  const grantXp = useGrantManualXp();

  const [setLevelModal, setSetLevelModal] = useState(false);
  const [pickRank, setPickRank] = useState(currentRank);
  const [pickLevel, setPickLevel] = useState(currentLevel);

  const [xpModal, setXpModal] = useState(false);
  const [xpAmount, setXpAmount] = useState(50);
  const [xpReason, setXpReason] = useState("");

  if (!isAuthorized) return null;

  const handleLevelUp = async () => {
    try {
      const r = await levelUp.mutateAsync(memberId);
      toast.success(
        `${memberName} → ${RANK_LABELS[r.current_rank] ?? r.current_rank} Lv.${r.new_level} 🥊`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "레벨업 실패");
    }
  };

  const handleLevelDown = async () => {
    if (!confirm(`${memberName} 의 레벨을 1단계 내리시겠습니까?`)) return;
    try {
      const r = await levelDown.mutateAsync(memberId);
      toast.success(
        `${memberName} → ${RANK_LABELS[r.new_rank] ?? r.new_rank} Lv.${r.new_level}`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "레벨다운 실패");
    }
  };

  const handlePassBoss = async () => {
    if (!confirm(`${memberName} 의 타이틀매치(보스전)를 합격 처리하시겠습니까?`))
      return;
    try {
      const r = await passBoss.mutateAsync({ memberId });
      if (r.ranked_up) {
        toast.success(
          `🏆 ${memberName} 리그 승급! ${RANK_LABELS[r.new_rank] ?? r.new_rank} Lv.${r.new_level}`,
        );
      } else {
        toast.success(`${memberName} 타이틀매치 합격`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "보스전 처리 실패");
    }
  };

  const handleSetLevel = async () => {
    try {
      const r = await setLevel.mutateAsync({
        memberId,
        rank: pickRank,
        level: pickLevel,
      });
      toast.success(
        `${memberName} → ${RANK_LABELS[r.new_rank] ?? r.new_rank} Lv.${r.new_level}`,
      );
      setSetLevelModal(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "레벨 설정 실패");
    }
  };

  const handleGrantXp = async () => {
    if (xpAmount <= 0) {
      toast.error("XP 는 1 이상이어야 합니다");
      return;
    }
    try {
      await grantXp.mutateAsync({
        memberId,
        amount: xpAmount,
        reason: xpReason.trim() || undefined,
      });
      toast.success(`${memberName} 에게 XP +${xpAmount} 지급`);
      setXpModal(false);
      setXpAmount(50);
      setXpReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "XP 지급 실패");
    }
  };

  const isCompact = mode === "compact";
  const busy =
    levelUp.isPending ||
    levelDown.isPending ||
    setLevel.isPending ||
    passBoss.isPending ||
    grantXp.isPending;

  return (
    <>
      <section
        className={`rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-400/10 via-card to-card shadow-elev-1 ${
          isCompact ? "p-3" : "p-4"
        }`}
        aria-label="관리자 레벨 조정"
      >
        {/* Header */}
        <div className={`mb-3 flex items-center gap-2 ${isCompact ? "" : "mb-4"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/20 text-amber-600">
            <Shield className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
              관리자 — 레벨 조정
            </p>
            <p className="mt-0.5 truncate text-[12px] font-bold text-foreground">
              현재: {RANK_LABELS[currentRank] ?? currentRank} 리그 Lv.{currentLevel}
            </p>
          </div>
        </div>

        {/* 빠른 액션 — 레벨업 / 레벨다운 / 보스전 */}
        <div className={`grid grid-cols-3 gap-2 ${isCompact ? "" : "mb-3"}`}>
          <button
            type="button"
            onClick={handleLevelUp}
            disabled={busy}
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-[11px] font-bold text-primary-foreground transition-all active:scale-[0.97] disabled:opacity-50"
          >
            <ArrowUp className="h-4 w-4" />
            레벨업
            <span className="text-[9px] opacity-80">Lv.{currentLevel + 1}</span>
          </button>
          <button
            type="button"
            onClick={handleLevelDown}
            disabled={busy || currentLevel <= 1}
            className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card py-2.5 text-[11px] font-bold text-muted-foreground transition-all active:scale-[0.97] hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
          >
            <ArrowDown className="h-4 w-4" />
            레벨다운
            <span className="text-[9px] opacity-80">
              {currentLevel > 1 ? `Lv.${currentLevel - 1}` : "—"}
            </span>
          </button>
          <button
            type="button"
            onClick={handlePassBoss}
            disabled={busy}
            className="flex flex-col items-center justify-center gap-1 rounded-xl bg-reward py-2.5 text-[11px] font-bold text-reward-foreground transition-all active:scale-[0.97] disabled:opacity-50"
          >
            <Swords className="h-4 w-4" />
            보스전
            <span className="text-[9px] opacity-80">합격</span>
          </button>
        </div>

        {/* 추가 액션 — 직접 설정 / XP 지급 */}
        <div className={`mt-2 grid grid-cols-2 gap-2 ${isCompact ? "" : "mt-3"}`}>
          <button
            type="button"
            onClick={() => {
              setPickRank(currentRank);
              setPickLevel(currentLevel);
              setSetLevelModal(true);
            }}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 py-2.5 text-[11.5px] font-bold text-amber-700 transition-all active:scale-[0.98] hover:bg-amber-400/20 disabled:opacity-50"
          >
            <Settings2 className="h-3.5 w-3.5" />
            리그/레벨 직접 설정
          </button>
          <button
            type="button"
            onClick={() => setXpModal(true)}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-[11.5px] font-bold text-emerald-700 transition-all active:scale-[0.98] hover:bg-emerald-500/20 disabled:opacity-50"
          >
            <Banknote className="h-3.5 w-3.5" />
            XP 수동 지급
          </button>
        </div>

        {!isCompact && (
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
            ※ 모든 변경은 공식 RPC (manual_level_up / manual_level_down /
            set_member_level / pass_boss_battle / grant_manual_xp) 를 통해서만
            처리됩니다. member_progress 직접 수정 0.
          </p>
        )}
      </section>

      {/* ─── 직접 설정 모달 ─── */}
      {setLevelModal && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center"
          onClick={() => setSetLevelModal(false)}
        >
          <div
            className="mx-4 w-full max-w-md animate-slide-up rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                리그 / 레벨 직접 설정
              </h3>
              <button
                onClick={() => setSetLevelModal(false)}
                className="rounded-full bg-muted p-1.5 active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="mb-3 text-[12px] text-muted-foreground">
              {memberName} 의 리그와 레벨을 직접 설정합니다.
            </p>

            {/* 리그 선택 */}
            <p className="mb-1.5 text-[11px] font-bold text-foreground">리그</p>
            <div className="mb-4 grid grid-cols-4 gap-1.5">
              {RANK_OPTIONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setPickRank(r.value)}
                  className={`rounded-xl py-2 text-[12px] font-bold transition-all active:scale-95 ${
                    pickRank === r.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* 레벨 선택 */}
            <p className="mb-1.5 text-[11px] font-bold text-foreground">
              레벨 (1~10)
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setPickLevel(lv)}
                  className={`h-9 w-9 rounded-lg text-sm font-bold transition-all active:scale-95 ${
                    pickLevel === lv
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {lv}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleSetLevel}
              disabled={setLevel.isPending}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {setLevel.isPending
                ? "설정 중..."
                : `${RANK_LABELS[pickRank] ?? pickRank} Lv.${pickLevel} 로 설정`}
            </button>

            <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
              ※ set_member_level RPC 호출. 공식 레벨 시스템 흐름을 따릅니다.
            </p>
          </div>
        </div>
      )}

      {/* ─── XP 지급 모달 ─── */}
      {xpModal && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center"
          onClick={() => setXpModal(false)}
        >
          <div
            className="mx-4 w-full max-w-md animate-slide-up rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                XP 수동 지급
              </h3>
              <button
                onClick={() => setXpModal(false)}
                className="rounded-full bg-muted p-1.5 active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="mb-3 text-[12px] text-muted-foreground">
              {memberName} 에게 공식 XP 를 지급합니다.
            </p>

            <p className="mb-1.5 text-[11px] font-bold text-foreground">
              XP 수치
            </p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[10, 30, 50, 100, 200, 500].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setXpAmount(preset)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all active:scale-95 ${
                    xpAmount === preset
                      ? "bg-emerald-500 text-white"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  +{preset}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={xpAmount}
              onChange={(e) => setXpAmount(Number(e.target.value))}
              min={1}
              className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="직접 입력"
            />

            <p className="mb-1.5 text-[11px] font-bold text-foreground">
              사유 (선택)
            </p>
            <input
              type="text"
              value={xpReason}
              onChange={(e) => setXpReason(e.target.value.slice(0, 80))}
              className="mb-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="예: 외부 자격 인정 / 특별 평가 보너스"
            />

            <button
              type="button"
              onClick={handleGrantXp}
              disabled={grantXp.isPending || xpAmount <= 0}
              className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {grantXp.isPending ? "지급 중..." : `+${xpAmount} XP 지급`}
            </button>

            <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
              ※ grant_manual_xp RPC 호출. 자동 레벨업이 발생할 수 있습니다.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default LevelAdminPanel;
