import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import RankBadge from "@/components/RankBadge";
import AvatarUpload from "@/components/AvatarUpload";
import XPBar from "@/components/XPBar";
import CharacterSprite from "@/components/CharacterSprite";
import { useMemberCharacterAssignment } from "@/hooks/useCharacterData";
import { ArrowLeft, MapPin, Calendar, LogOut, Settings, ChevronRight, KeyRound, Award, Palette, Gem, Sparkles } from "lucide-react";
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

const MyPage = () => {
  const navigate = useNavigate();
  const { profile, progress, role, signOut } = useAuth();
  const { data: xpLogs } = useXpLogs(30);
  const { data: allBadges, isLoading: badgesLoading } = useBadges();
  const { data: myBadges } = useMyBadges();
  const { data: walletData } = useWallet();
  const { data: myCharacter } = useMemberCharacterAssignment();
  const [showPwChange, setShowPwChange] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");

  if (!profile || !progress) return null;

  const earnedIds = new Set((myBadges || []).map(mb => mb.badge_id));
  const earned = (allBadges || []).filter(b => earnedIds.has(b.id));
  const locked = (allBadges || []).filter(b => !earnedIds.has(b.id));
  const isMaster40 = progress.current_rank === "black" && progress.current_level === 10 && progress.bosses_cleared >= 4;
  const levelUpLogs = (xpLogs || []).filter(l => l.reason.includes("클리어") || l.reason.includes("타이틀매치"));

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

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

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">마이페이지</h1>
      </div>

      <div className="space-y-5">
        {/* Character Hero Card */}
        <div className="animate-slide-up rounded-2xl border border-border bg-gradient-to-b from-card to-secondary/20 p-5 shadow-sm">
          <div className="flex items-start gap-4">
            {/* Large character preview */}
            <div className="relative flex-shrink-0">
              {myCharacter?.character_presets ? (
                <CharacterSprite
                  style={(myCharacter.character_presets.parts_json as any)?.style}
                  userId={profile.user_id}
                  partsJson={myCharacter.character_presets.parts_json as any}
                  size="lg"
                  animate
                  league={progress.current_rank as any}
                  level={progress.current_level}
                  className="!w-28 !h-28"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-muted">
                  <span className="text-4xl">🥊</span>
                </div>
              )}
              <button
                onClick={() => navigate("/character-studio")}
                className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 shadow-md active:scale-95 transition-transform"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            </div>
            {/* Profile info */}
            <div className="flex-1 pt-1">
              <h2 className="text-lg text-foreground">{profile.nickname || profile.name}</h2>
              <p className="text-sm text-muted-foreground">{profile.name}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <RankBadge rank={progress.current_rank as Enums<"rank_name">} level={progress.current_level} isMaster={isManagerRole(role)} />
                {role && role !== "member" && (
                  <span className="rounded-full bg-accent/30 px-2 py-0.5 text-xs font-bold text-accent-foreground">
                    {role === "branch_manager" || role === "coach" ? "관장님" : role === "super_admin" || role === "admin" ? "전체 관리자" : role}
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => navigate("/character-studio")}
                  className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary active:scale-95"
                >
                  캐릭터 스튜디오
                </button>
                <AvatarUpload size="sm" />
              </div>
            </div>
          </div>
        </div>

        {/* XP & Stats */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-sm" style={{ animationDelay: "0.03s" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-2xl font-bold text-foreground">{progress.total_xp.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">총 XP</p>
            </div>
            <RankBadge rank={progress.current_rank as Enums<"rank_name">} level={progress.current_level} size="lg" isMaster={isManagerRole(role)} />
          </div>
          <XPBar current={progress.total_xp} max={getXpToNext(progress.current_level, progress.current_rank)} />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 animate-slide-up" style={{ animationDelay: "0.05s" }}>
          <StatCard icon="🔥" label="연속 출석" value={`${progress.streak_days}일`} />
          <StatCard icon="🏆" label="보스 클리어" value={`${progress.bosses_cleared}회`} />
          <StatCard icon="🏅" label="배지" value={`${earned.length}개`} />
        </div>

        {/* Info */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card shadow-sm" style={{ animationDelay: "0.07s" }}>
          <InfoRow icon={<MapPin className="h-4 w-4" />} label="소속 지점" value={profile.branch_name || "미설정"} />
          <InfoRow icon={<Calendar className="h-4 w-4" />} label="가입일" value={new Date(profile.created_at).toLocaleDateString("ko-KR")} last />
        </div>

        {/* Character & Items - unified */}
        <button
          onClick={() => navigate("/character-studio")}
          className="w-full animate-slide-up rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 to-accent/10 p-4 shadow-sm transition-all active:scale-[0.98]"
          style={{ animationDelay: "0.08s" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-foreground">캐릭터 스튜디오</p>
              <p className="text-xs text-muted-foreground">만들기 · 꾸미기 · 성장시키기</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1.5">
              <Gem className="h-4 w-4 text-accent" />
              <span className="text-sm font-bold text-accent-foreground">{walletData?.gems_balance?.toLocaleString() || 0}</span>
            </div>
          </div>
        </button>

        {/* Master League */}
        {isMaster40 && (
          <div className="animate-bounce-in rounded-2xl border-2 border-accent bg-gradient-to-br from-accent/20 via-primary/10 to-accent/20 p-6 text-center shadow-lg">
            <span className="text-5xl">👑</span>
            <h2 className="mt-2 text-xl font-bold text-foreground">마스터 리그 달성</h2>
            <p className="text-sm text-muted-foreground">블랙 리그 레벨 10 달성 + 모든 타이틀매치 클리어</p>
          </div>
        )}

        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="mb-3 text-base font-bold text-foreground">🏅 획득한 배지</h2>
          <EarnedBadgeGrid badges={earned} loading={badgesLoading} />
        </div>

        {locked.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.12s" }}>
            <h2 className="mb-3 text-base font-bold text-muted-foreground">🔒 미획득</h2>
            <LockedBadgeGrid badges={locked} />
          </div>
        )}

        {levelUpLogs.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.15s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">📜 레벨업 기록</h2>
            <LevelUpHistory logs={levelUpLogs} />
          </div>
        )}

        {xpLogs && xpLogs.length > 0 && (
          <div className="animate-slide-up" style={{ animationDelay: "0.18s" }}>
            <h2 className="mb-3 text-base font-bold text-foreground">⚡ 최근 XP 획득</h2>
            <RecentXpList logs={xpLogs} />
          </div>
        )}

        {/* Password Change */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card shadow-sm" style={{ animationDelay: "0.2s" }}>
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
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50">
                {pwLoading ? "처리 중..." : "비밀번호 변경 🥊"}
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="animate-slide-up rounded-2xl border border-border bg-card shadow-sm" style={{ animationDelay: "0.22s" }}>
          {(role === "coach" || role === "admin" || role === "branch_manager" || role === "super_admin") && (
            <button onClick={() => navigate("/manager")} className="flex w-full items-center justify-between border-b border-border px-4 py-4 active:bg-secondary/50">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">📋</span>
                <span className="text-sm text-foreground">회원 관리</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <button onClick={() => navigate("/guide")} className="flex w-full items-center justify-between border-b border-border px-4 py-4 active:bg-secondary/50">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">📖</span>
              <span className="text-sm text-foreground">가이드</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/safety-check")} className="flex w-full items-center justify-between border-b border-border px-4 py-4 active:bg-secondary/50">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">🛡️</span>
              <span className="text-sm text-foreground">안전 체크 수정</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => navigate("/settings")} className="flex w-full items-center justify-between border-b border-border px-4 py-4 active:bg-secondary/50">
            <div className="flex items-center gap-3">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">설정</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 px-4 py-4 active:bg-secondary/50">
            <LogOut className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">로그아웃</span>
          </button>
        </div>
      </div>
    </div>
  );
};

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
