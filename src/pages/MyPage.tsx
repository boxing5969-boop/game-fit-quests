import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTutorialState } from "@/hooks/useTutorialState";
import RankBadge from "@/components/RankBadge";
import AvatarUpload from "@/components/AvatarUpload";
import DisplayModeToggle from "@/components/profile/DisplayModeToggle";
import XPBar from "@/components/XPBar";
import CharacterSprite from "@/components/CharacterSprite";
import { useMemberCharacterAssignment } from "@/hooks/useCharacterData";
import { ArrowLeft, MapPin, Calendar, ChevronRight, KeyRound, Award, Palette, Banknote, Sparkles, Clock } from "lucide-react";
import { isManagerRole } from "@/lib/rankLabels";
import { useNavigate } from "react-router-dom";
import { useBadges, useMyBadges, useXpLogs } from "@/hooks/useQuestData";
import { toast } from "sonner";
import type { Enums } from "@/integrations/supabase/types";
import { useWallet } from "@/hooks/useWallet";
import {
  EarnedBadgeGrid,
  LockedBadgeGrid,
  LevelUpHistory,
  RecentXpList,
  StatCard,
} from "@/components/shared/BadgeGrid";
import {
  BoxingHallSummaryCard,
  BoxingIqLeagueCard,
  HiddenMissionPanel,
  BoxerStyleDiagnosisCard,
  GrowthReportCard,
  ShadowBoxerCard,
} from "@/components/engagement";

const MyPage = () => {
  const navigate = useNavigate();
  const { user, profile, progress, role, refreshProfile } = useAuth();
  const { data: xpLogs } = useXpLogs(30);
  const { data: allBadges, isLoading: badgesLoading } = useBadges();
  const { data: myBadges } = useMyBadges();
  const { data: walletData } = useWallet();
  const { data: myCharacter } = useMemberCharacterAssignment();
  const { isCompleted: tutorialDone, isSkipped: tutorialSkipped, restart: restartTutorial } =
    useTutorialState();
  const [showPwChange, setShowPwChange] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [showBirthEdit, setShowBirthEdit] = useState(false);
  const [birthInput, setBirthInput] = useState(profile?.birth_date ?? "");
  const [birthLoading, setBirthLoading] = useState(false);
  const [birthError, setBirthError] = useState("");
  const [tutorialRestartBusy, setTutorialRestartBusy] = useState(false);
  const [showGrowthTools, setShowGrowthTools] = useState(false);
  const [showAllXp, setShowAllXp] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [showAllMedals, setShowAllMedals] = useState(false);

  /**
   * 입단식 다시 보기 — 이미 완료/스킵한 유저만 노출되는 재시작 진입점.
   *
   * 경로
   *   MyPage 액션 리스트 → restart_tutorial RPC → /home 이동 →
   *   글로벌 InductionCeremonyOverlay 가 자동 재진입.
   *
   * 중복 지급 방지 (서버측)
   *   • profiles.tutorial_reward_claimed 은 restart_tutorial 이 리셋하지 않음
   *   • tutorial_step_claims 도 보존 → 단계별 보상 0젬 재지급
   *   • complete_tutorial_once 는 reward_claimed=true 시 already_granted 반환
   */
  const handleRestartTutorial = async () => {
    if (tutorialRestartBusy) return;
    setTutorialRestartBusy(true);
    try {
      const ok = await restartTutorial();
      if (!ok) {
        toast.error("다시 시작에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      toast.success("튜토리얼을 다시 시작합니다 🥊");
      navigate("/home");
    } finally {
      setTutorialRestartBusy(false);
    }
  };

  if (!profile || !progress) return null;

  const earnedIds = new Set((myBadges || []).map(mb => mb.badge_id));
  const earned = (allBadges || []).filter(b => earnedIds.has(b.id));
  const locked = (allBadges || []).filter(b => !earnedIds.has(b.id));
  const isMaster40 = progress.current_rank === "black" && progress.current_level === 10 && progress.bosses_cleared >= 4;
  const levelUpLogs = (xpLogs || []).filter(l => l.reason.includes("클리어") || l.reason.includes("타이틀매치"));

  // 수강권 — 등록일/만료일/남은 기간 (브로제이 일괄등록 시 채워짐, 본인만 조회 가능)
  const memEnd = (profile as { membership_end?: string }).membership_end ?? null;
  const regDate = (profile as { gym_reg_date?: string }).gym_reg_date ?? null;
  const ddays = memEnd ? Math.ceil((new Date(memEnd + "T23:59:59").getTime() - Date.now()) / 86400000) : null;
  const ddayText = ddays === null ? "" : ddays < 0 ? "만료됨" : ddays === 0 ? "오늘 만료" : `${ddays}일 남음`;

  const handlePasswordChange = async () => {
    setPwError("");
    if (newPw.length < 6) { setPwError("새 비밀번호는 6자 이상이어야 합니다"); return; }
    if (newPw !== confirmPw) { setPwError("새 비밀번호가 일치하지 않습니다"); return; }
    setPwLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;
      if (!email) throw new Error("이메일을 찾을 수 없습니다");
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: currentPw });
      if (signInErr) { setPwError("현재 비밀번호가 올바르지 않습니다"); return; }
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPw });
      if (updateErr) throw updateErr;
      toast.success("비밀번호가 변경되었습니다 ✅");
      setShowPwChange(false); setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) { setPwError(err.message || "비밀번호 변경 실패"); }
    finally { setPwLoading(false); }
  };

  const handleBirthSave = async () => {
    setBirthError("");
    if (!user?.id) { setBirthError("로그인 상태를 확인해 주세요"); return; }
    const trimmed = birthInput.trim();
    // YYYY-MM-DD 간단 포맷 검증 (비움 = 삭제 허용)
    if (trimmed && !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      setBirthError("YYYY-MM-DD 형식으로 입력해 주세요");
      return;
    }
    setBirthLoading(true);
    try {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ birth_date: trimmed === "" ? null : trimmed })
        .eq("user_id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      toast.success("생년월일이 저장되었습니다 ✅");
      setShowBirthEdit(false);
    } catch (err: any) {
      setBirthError(err.message || "생년월일 저장 실패");
    } finally {
      setBirthLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div data-tour="mypage-profile" className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">마이페이지</h1>
      </div>

      <div className="space-y-7">
        {/* ═══════════ 프로필 ═══════════ */}
        <section className="animate-slide-up space-y-3">
          {/* Character Hero Card */}
          <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-secondary/20 p-5 shadow-glow-soft">
            <div className="flex items-start gap-4">
              {/* 프로필 사진 (메인) */}
              <div data-tutorial-target="profile-photo-button" className="relative flex-shrink-0">
                <AvatarUpload size="xl" />
              </div>
              {/* Profile info */}
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg text-foreground">{profile.nickname || profile.name}</h2>
                    <p className="truncate text-sm text-muted-foreground">{profile.name}</p>
                  </div>
                  {/* 보유 젬 (기존 중복 버튼에서 프로필로 통합) */}
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-reward/20 px-2.5 py-1">
                    <Banknote className="h-3.5 w-3.5 text-reward" />
                    <span className="text-xs font-bold text-reward-foreground">
                      {role === "admin" || role === "super_admin"
                        ? "∞"
                        : walletData?.gems_balance?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <RankBadge rank={progress.current_rank as Enums<"rank_name">} level={progress.current_level} isMaster={isManagerRole(role)} />
                  {role && role !== "member" && (
                    <span className="rounded-full bg-reward/30 px-2 py-0.5 text-xs font-bold text-reward-foreground">
                      {role === "branch_manager" || role === "coach" ? "관장님" : role === "super_admin" || role === "admin" ? "전체 관리자" : role}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => navigate("/character-studio")}
                    className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary active:scale-95"
                  >
                    캐릭터 스튜디오
                  </button>
                  {/* 글러브 캐릭터 — 캐릭터 스튜디오 버튼 옆으로 이동 */}
                  <button
                    onClick={() => navigate("/character-studio")}
                    aria-label="캐릭터 스튜디오"
                    className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary active:scale-95"
                  >
                    {myCharacter?.character_presets ? (
                      <CharacterSprite
                        style={(myCharacter.character_presets.parts_json as any)?.style}
                        userId={profile.user_id}
                        partsJson={myCharacter.character_presets.parts_json as any}
                        size="sm"
                        league={progress.current_rank as any}
                        level={progress.current_level}
                        className="!w-11 !h-11"
                      />
                    ) : (
                      <span className="text-lg">🥊</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 라이센스 카드 표시 모드 토글 */}
          <DisplayModeToggle />
        </section>

        {/* ═══════════ 내 기록 ═══════════ */}
        <section className="animate-slide-up space-y-3">
          <SectionHeader>내 기록</SectionHeader>

          {/* XP & Stats */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{progress.total_xp.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">총 XP</p>
              </div>
              <RankBadge rank={progress.current_rank as Enums<"rank_name">} level={progress.current_level} size="lg" isMaster={isManagerRole(role)} />
            </div>
            <XPBar current={progress.total_xp} max={getXpToNext(progress.current_level, progress.current_rank)} />
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon="🔥" label="연속 출석" value={`${progress.streak_days}일`} />
            <StatCard icon="🏆" label="보스 클리어" value={`${progress.bosses_cleared}회`} />
            <StatCard icon="🏅" label="메달" value={`${earned.length}개`} />
          </div>

          {/* Master League */}
          {isMaster40 && (
            <div className="animate-bounce-in rounded-2xl border-2 border-reward bg-gradient-to-br from-reward/20 via-primary/10 to-reward/20 p-6 text-center shadow-glow-reward">
              <span className="text-5xl">👑</span>
              <h3 className="mt-2 text-xl font-bold text-foreground">마스터 리그 달성</h3>
              <p className="text-sm text-muted-foreground">블랙 리그 레벨 10 달성 + 모든 타이틀매치 클리어</p>
            </div>
          )}

          {/* 획득한 메달 (상위 3개만, 나머지는 접기) */}
          <div>
            <h3 className="mb-3 text-base font-bold text-foreground">획득한 메달</h3>
            <EarnedBadgeGrid badges={showAllMedals ? earned : earned.slice(0, 3)} loading={badgesLoading} />
            {earned.length > 3 && (
              <button
                onClick={() => setShowAllMedals((v) => !v)}
                className="mt-2 w-full rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground active:scale-[0.98]"
              >
                {showAllMedals ? "접기" : `더보기 (${earned.length - 3}개 더)`}
              </button>
            )}
          </div>

          {locked.length > 0 && (
            <div>
              <button
                onClick={() => setShowLocked((v) => !v)}
                className="mb-3 flex w-full items-center justify-between"
              >
                <h3 className="text-base font-bold text-muted-foreground">미획득 ({locked.length})</h3>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showLocked ? "rotate-90" : ""}`} />
              </button>
              {showLocked && <LockedBadgeGrid badges={locked} />}
            </div>
          )}

          {levelUpLogs.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-foreground">레벨업 기록</h3>
              <LevelUpHistory logs={levelUpLogs} />
            </div>
          )}

          {xpLogs && xpLogs.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold text-foreground">최근 XP 획득</h3>
              <RecentXpList logs={showAllXp ? xpLogs : xpLogs.slice(0, 1)} />
              {xpLogs.length > 1 && (
                <button
                  onClick={() => setShowAllXp((v) => !v)}
                  className="mt-2 w-full rounded-xl border border-border py-2 text-xs font-medium text-muted-foreground active:scale-[0.98]"
                >
                  {showAllXp ? "접기" : `더보기 (${xpLogs.length - 1}개 더)`}
                </button>
              )}
            </div>
          )}
        </section>

        {/* ═══════════ 성장 도구 (기본 접힘) ═══════════ */}
        <section className="animate-slide-up space-y-3">
          <button
            onClick={() => setShowGrowthTools((v) => !v)}
            className="flex w-full items-center justify-between px-1"
          >
            <span className="flex items-center gap-2 text-[13px] font-bold text-muted-foreground">
              <span className="h-3.5 w-1 rounded-full bg-primary/60" />
              성장 도구
            </span>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              {showGrowthTools ? "접기" : "펼치기"}
              <ChevronRight className={`h-4 w-4 transition-transform ${showGrowthTools ? "rotate-90" : ""}`} />
            </span>
          </button>
          {showGrowthTools && (
            <div className="space-y-3">
              <div data-tour="boxing-hall-card">
                <BoxingHallSummaryCard />
              </div>
              <BoxingIqLeagueCard />
              <BoxerStyleDiagnosisCard />
              <ShadowBoxerCard />
              <GrowthReportCard />
              <HiddenMissionPanel />
            </div>
          )}
        </section>

        {/* ═══════════ 계정 · 정보 ═══════════ */}
        <section className="animate-slide-up space-y-3">
          <SectionHeader>계정 · 정보</SectionHeader>

          {/* Info */}
          <div className="rounded-2xl border border-border bg-card shadow-elev-1">
            <InfoRow icon={<MapPin className="h-4 w-4" />} label="소속 지점" value={profile.branch_name || "미설정"} />
            <InfoRow icon={<Calendar className="h-4 w-4" />} label="가입일" value={new Date(profile.created_at).toLocaleDateString("ko-KR")} last={!regDate && !memEnd} />
            {regDate && <InfoRow icon={<Calendar className="h-4 w-4" />} label="등록일" value={new Date(regDate).toLocaleDateString("ko-KR")} last={!memEnd} />}
            {memEnd && <InfoRow icon={<Calendar className="h-4 w-4" />} label="수강 만료" value={new Date(memEnd).toLocaleDateString("ko-KR")} />}
            {memEnd && <InfoRow icon={<Clock className="h-4 w-4" />} label="남은 기간" value={ddayText} last />}
          </div>

          {/* Password Change */}
          <div className="rounded-2xl border border-border bg-card shadow-elev-1">
            <button onClick={() => setShowPwChange(!showPwChange)} className="flex w-full items-center justify-between px-4 py-4 active:bg-secondary/50">
              <div className="flex items-center gap-3">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-foreground">비밀번호 변경</span>
              </div>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showPwChange ? "rotate-90" : ""}`} />
            </button>
            {showPwChange && (
              <div className="space-y-3 border-t border-border px-4 py-4">
                <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="현재 비밀번호"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="새 비밀번호 (6자 이상)"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="새 비밀번호 확인"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none" />
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                <button onClick={handlePasswordChange} disabled={pwLoading}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98] disabled:opacity-50">
                  {pwLoading ? "처리 중..." : "비밀번호 변경 🥊"}
                </button>
              </div>
            )}
          </div>

          {/* Birth date edit — 다이어트 트랙 자동 판정에 사용됨 */}
          <div className="rounded-2xl border border-border bg-card shadow-elev-1">
            <button onClick={() => { setShowBirthEdit(!showBirthEdit); setBirthInput(profile?.birth_date ?? ""); setBirthError(""); }} className="flex w-full items-center justify-between px-4 py-4 active:bg-secondary/50">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col items-start">
                  <span className="text-sm text-foreground">생년월일 수정</span>
                  <span className="text-[11px] text-muted-foreground">
                    {profile?.birth_date ? profile.birth_date : "등록되지 않음"}
                  </span>
                </div>
              </div>
              <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${showBirthEdit ? "rotate-90" : ""}`} />
            </button>
            {showBirthEdit && (
              <div className="space-y-3 border-t border-border px-4 py-4">
                <input
                  type="date"
                  value={birthInput}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setBirthInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  153 다이어트 트랙 자동 판정(성인·청소년), 프로그램 맞춤 카피에 사용됩니다. 비워두면 '등록되지 않음' 처리됩니다.
                </p>
                {birthError && <p className="text-xs text-destructive">{birthError}</p>}
                <button
                  onClick={handleBirthSave}
                  disabled={birthLoading}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {birthLoading ? "처리 중..." : "생년월일 저장"}
                </button>
              </div>
            )}
          </div>

          {/* Actions — 회원관리/가이드/153다이어트/설정/로그아웃 은 /settings 로 이관됨.
              보상(/rewards) + 튜토리얼 다시 시작만 여기 유지. */}
          <div className="rounded-2xl border border-border bg-card shadow-elev-1">
            <button onClick={() => navigate("/rewards")} className={`flex w-full items-center justify-between px-4 py-4 active:bg-secondary/50 ${(tutorialDone || tutorialSkipped) ? "border-b border-border" : ""}`}>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">🎁</span>
                <span className="text-sm text-foreground">보상</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            {(tutorialDone || tutorialSkipped) && (
              <button
                onClick={handleRestartTutorial}
                disabled={tutorialRestartBusy}
                className="flex w-full items-center justify-between px-4 py-4 active:bg-secondary/50 disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground">🥊</span>
                  <span className="text-sm text-foreground">
                    {tutorialRestartBusy ? "준비 중…" : "튜토리얼 다시 시작"}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <h2 className="flex items-center gap-2 px-1 text-[13px] font-bold text-muted-foreground">
    <span className="h-3.5 w-1 rounded-full bg-primary/60" />
    {children}
  </h2>
);

const InfoRow = ({ icon, label, value, last = false }: { icon: React.ReactNode; label: string; value: string; last?: boolean }) => (
  <div className={`flex items-center justify-between px-4 py-3.5 ${!last ? "border-b border-border" : ""}`}>
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
    <span className="text-sm font-medium text-foreground">{value}</span>
  </div>
);


function getXpToNext(level: number, rank: string): number {
  const rankIdx = ["white", "blue", "red", "black"].indexOf(rank);
  return ((rankIdx * 10 + level) + 1) * 50;
}

export default MyPage;
