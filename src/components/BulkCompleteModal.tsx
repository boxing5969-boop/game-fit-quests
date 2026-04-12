import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Award, CheckCircle2, Crown, Shield, Star, Trophy, X, Zap } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  currentRank: string;
  currentLevel: number;
  currentXp: number;
  bossesCleard: number;
}

const REASON_OPTIONS = [
  "테스트 계정 세팅",
  "시범 회원 계정 세팅",
  "마케팅용 데모 세팅",
  "데이터 복구",
  "운영자 수동 승인",
];

const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const BulkCompleteModal = ({ open, onClose, memberId, memberName, currentRank, currentLevel, currentXp, bossesCleard }: Props) => {
  const qc = useQueryClient();
  const [step, setStep] = useState<"options" | "confirm" | "executing" | "done">("options");

  // Options
  const [doLevels, setDoLevels] = useState(true);
  const [doBosses, setDoBosses] = useState(true);
  const [doBadges, setDoBadges] = useState(true);
  const [doMaster, setDoMaster] = useState(true);
  const [sendNotification, setSendNotification] = useState(false);
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState("");

  // Confirm
  const [confirmText, setConfirmText] = useState("");

  // Result
  const [result, setResult] = useState<any>(null);

  if (!open) return null;

  const finalReason = customReason.trim() || reason;
  const isMaster40 = currentRank === "black" && currentLevel === 10 && bossesCleard >= 4;

  // Preview
  const levelsToComplete = doLevels ? 40 : 0;
  const bossesToClear = doBosses ? 4 - bossesCleard : 0;
  const xpToAdd = Math.max(0, 2000 - currentXp);
  const confirmRequired = memberName;

  const handleExecute = async () => {
    setStep("executing");
    try {
      const { data, error } = await supabase.rpc("bulk_complete_member", {
        _member_id: memberId,
        _reason: finalReason,
        _send_notification: sendNotification,
        _options: {
          missions: true,
          levels: doLevels,
          bosses: doBosses,
          badges: doBadges,
          master40: doMaster,
        },
      });
      if (error) throw error;
      setResult(data);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["member-detail", memberId] });
      qc.invalidateQueries({ queryKey: ["member-level-status", memberId] });
      qc.invalidateQueries({ queryKey: ["branch-members"] });
      toast.success("전체 완료 처리가 실행되었습니다");
    } catch (e: any) {
      toast.error(e.message || "실행 실패");
      setStep("confirm");
    }
  };

  const handleClose = () => {
    setStep("options");
    setConfirmText("");
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={handleClose}>
      <div className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-destructive" />
            <h2 className="text-base font-bold text-foreground">회원 전체 완료 처리</h2>
          </div>
          <button onClick={handleClose} className="rounded-full p-1.5 hover:bg-muted transition-colors">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {/* Target member */}
          <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs text-muted-foreground">대상 회원</p>
            <p className="text-lg font-bold text-foreground">{memberName}</p>
            <p className="text-xs text-muted-foreground">
              현재: {RANK_LABELS[currentRank] || currentRank} 리그 · 레벨 {currentLevel} · {currentXp} XP · 보스전 {bossesCleard}회
            </p>
          </div>

          {/* Step 1: Options */}
          {step === "options" && (
            <div className="space-y-4">
              {/* Already master warning */}
              {isMaster40 && (
                <div className="rounded-xl border border-accent/30 bg-accent/10 p-3">
                  <p className="text-xs font-bold text-accent-foreground">⚠️ 이 회원은 이미 MASTER 40입니다</p>
                </div>
              )}

              {/* Checkboxes */}
              <div className="space-y-2.5">
                <p className="text-sm font-bold text-foreground">완료 항목 선택</p>
                <CheckOption checked={doLevels} onChange={setDoLevels} icon={<Star className="h-4 w-4 text-primary" />} label="모든 레벨 완료 (40레벨)" desc="화이트~블랙 리그 전체" />
                <CheckOption checked={doBosses} onChange={setDoBosses} icon={<Trophy className="h-4 w-4 text-accent-foreground" />} label="모든 보스전 합격 (4회)" desc="각 리그 타이틀매치 합격" />
                <CheckOption checked={doBadges} onChange={setDoBadges} icon={<Award className="h-4 w-4 text-status-pending" />} label="모든 배지 지급" desc="전체 배지 자동 부여" />
                <CheckOption checked={doMaster} onChange={setDoMaster} icon={<Crown className="h-4 w-4 text-yellow-500" />} label="MASTER 40 달성" desc="블랙 리그 Lv.10 + 보스전 4회" />
                <CheckOption checked={sendNotification} onChange={setSendNotification} icon={<Zap className="h-4 w-4 text-blue-500" />} label="회원에게 알림 보내기" desc="완료 축하 알림 발송" />
              </div>

              {/* Reason */}
              <div>
                <p className="text-sm font-bold text-foreground mb-2">실행 사유</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {REASON_OPTIONS.map(r => (
                    <button key={r} onClick={() => { setReason(r); setCustomReason(""); }}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${reason === r && !customReason ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      {r}
                    </button>
                  ))}
                </div>
                <input value={customReason} onChange={e => setCustomReason(e.target.value)}
                  placeholder="직접 입력..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              </div>

              {/* Preview */}
              <div className="rounded-xl border border-border bg-muted/50 p-3">
                <p className="text-xs font-bold text-muted-foreground mb-2">📋 실행 미리보기</p>
                <div className="space-y-1 text-xs text-foreground">
                  {doLevels && <p>✅ {levelsToComplete}개 레벨 완료 처리</p>}
                  {doBosses && <p>✅ 보스전 {Math.max(0, 4 - bossesCleard)}회 추가 합격</p>}
                  {doBadges && <p>✅ 전체 배지 지급</p>}
                  {doMaster && <p>✅ MASTER 40 달성</p>}
                  <p>⚡ XP +{xpToAdd} 보정 (최종 2,000 XP 이상)</p>
                  <p className="font-bold text-primary mt-1">→ 최종: 블랙 리그 · 레벨 10</p>
                  {sendNotification && <p>🔔 완료 알림 발송</p>}
                </div>
              </div>

              <button onClick={() => setStep("confirm")}
                disabled={!doLevels && !doBosses && !doBadges && !doMaster}
                className="w-full rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground transition-all active:scale-[0.98] disabled:opacity-50">
                다음: 최종 확인
              </button>
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === "confirm" && (
            <div className="space-y-4">
              <div className="rounded-xl border-2 border-destructive/50 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-destructive">⚠️ 이 작업은 되돌리기 전까지 매우 큰 영향을 줍니다</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      "{memberName}" 회원의 모든 리그/레벨/배지/보스전이 일괄 완료 처리됩니다.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-foreground mb-1">
                  확인을 위해 <span className="text-destructive">"{confirmRequired}"</span> 을 입력하세요
                </p>
                <input value={confirmText} onChange={e => setConfirmText(e.target.value)}
                  placeholder={confirmRequired}
                  className="w-full rounded-lg border border-destructive/30 bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-destructive focus:outline-none" />
              </div>

              <div className="flex gap-2">
                <button onClick={() => setStep("options")}
                  className="flex-1 rounded-xl bg-secondary py-3 text-sm font-bold text-secondary-foreground active:scale-[0.98]">
                  뒤로
                </button>
                <button onClick={handleExecute}
                  disabled={confirmText !== confirmRequired}
                  className="flex-1 rounded-xl bg-destructive py-3 text-sm font-bold text-destructive-foreground transition-all active:scale-[0.98] disabled:opacity-30">
                  🔥 실행
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Executing */}
          {step === "executing" && (
            <div className="py-12 text-center">
              <div className="mx-auto mb-4 h-16 w-16 animate-pulse rounded-2xl bg-primary/20 flex items-center justify-center text-3xl">⚙️</div>
              <p className="text-foreground font-bold">처리 중...</p>
              <p className="text-xs text-muted-foreground mt-1">잠시만 기다려주세요</p>
            </div>
          )}

          {/* Step 4: Done */}
          {step === "done" && result && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <span className="text-5xl">🏆</span>
                <p className="mt-3 text-lg font-bold text-foreground">완료!</p>
                <p className="text-sm text-muted-foreground">{memberName} 회원의 전체 완료 처리가 실행되었습니다</p>
              </div>

              <div className="rounded-xl border border-status-complete/30 bg-status-complete/5 p-4 space-y-1.5">
                <p className="text-xs font-bold text-status-complete mb-2">📋 실행 결과</p>
                <ResultRow label="레벨 완료" value={`${result.levels_completed}개`} />
                <ResultRow label="보스전 클리어" value={`${result.bosses_cleared}회`} />
                <ResultRow label="배지 지급" value={`${result.badges_granted}개`} />
                <ResultRow label="XP 보정" value={`+${result.xp_added}`} />
                <ResultRow label="최종 상태" value={`${RANK_LABELS[result.final_rank]} 리그 · 레벨 ${result.final_level}`} highlight />
                {result.master40 && <ResultRow label="MASTER 40" value="달성 ✅" highlight />}
              </div>

              <button onClick={handleClose}
                className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]">
                확인
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CheckOption = ({ checked, onChange, icon, label, desc }: {
  checked: boolean; onChange: (v: boolean) => void; icon: React.ReactNode; label: string; desc: string;
}) => (
  <button onClick={() => onChange(!checked)}
    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
      checked ? "border-primary/30 bg-primary/5" : "border-border bg-card"
    }`}>
    <div className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
      checked ? "border-primary bg-primary" : "border-muted-foreground/30"
    }`}>
      {checked && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
    </div>
    {icon}
    <div className="flex-1">
      <p className="text-sm font-bold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{desc}</p>
    </div>
  </button>
);

const ResultRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className="flex justify-between text-xs">
    <span className="text-muted-foreground">{label}</span>
    <span className={highlight ? "font-bold text-primary" : "font-medium text-foreground"}>{value}</span>
  </div>
);

export default BulkCompleteModal;
