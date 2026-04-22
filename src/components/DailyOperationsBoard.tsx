// ═══════════════════════════════════════════════════════
// DailyOperationsBoard — 코치 백업 모드 운영 보드
// 오늘 방문자 큐, 원탭 처리, 퀵 태그, 대시보드 메트릭
// 레벨업/리그 승격 체크 액션 추가
// ═══════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { COACH_QUICK_TAGS, COACH_QUICK_ACTIONS, type DailyParticipation, type ParticipationMode } from "@/data/allLevelsData";
import { CheckCircle2, Clock, Users, AlertTriangle, TrendingUp, ChevronDown, ArrowUpCircle, Shield } from "lucide-react";

interface TodayVisitor {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  currentLevel: number;
  currentRank: string;
  status: ParticipationMode | "pending";
  selfChallengeComplete: boolean;
  startedAt?: string;
  finishedAt?: string;
  coachTags: string[];
  coachNote?: string;
}

const STORAGE_KEY = "daily-operations";
const RANK_LABELS: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

function loadTodayVisitors(): TodayVisitor[] {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.date === today) return parsed.visitors || [];
    }
  } catch {
    // storage 깨지거나 JSON 파싱 실패해도 데모 데이터로 fallback.
  }
  return [
    { userId: "demo-1", nickname: "김복서", currentLevel: 1, currentRank: "white", status: "self_challenge", selfChallengeComplete: true, coachTags: [], startedAt: "09:30", finishedAt: "10:20" },
    { userId: "demo-2", nickname: "이도전", currentLevel: 2, currentRank: "white", status: "pending", selfChallengeComplete: false, coachTags: [] },
    { userId: "demo-3", nickname: "박파이터", currentLevel: 5, currentRank: "white", status: "pending", selfChallengeComplete: false, coachTags: [] },
    { userId: "demo-4", nickname: "최잽왕", currentLevel: 3, currentRank: "white", status: "self_challenge", selfChallengeComplete: true, coachTags: ["잽", "가드"], startedAt: "11:00", finishedAt: "11:50" },
    { userId: "demo-5", nickname: "정가드", currentLevel: 1, currentRank: "blue", status: "pending", selfChallengeComplete: false, coachTags: [] },
  ];
}

function saveTodayVisitors(visitors: TodayVisitor[]) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ date: today, visitors }));
}

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  self_challenge: { bg: "bg-status-complete/10", text: "text-status-complete", label: "오늘 도전 완료" },
  coach_backup: { bg: "bg-primary/10", text: "text-primary", label: "코치 확인 완료" },
  partial: { bg: "bg-status-pending/10", text: "text-status-pending", label: "부분 완료" },
  needs_review: { bg: "bg-destructive/10", text: "text-destructive", label: "보완 필요" },
  pending: { bg: "bg-muted", text: "text-muted-foreground", label: "미처리" },
  not_completed: { bg: "bg-muted", text: "text-muted-foreground", label: "미완료" },
};

const EXTENDED_ACTIONS = [
  ...COACH_QUICK_ACTIONS,
  { id: "league_promotion", label: "승격 체크", emoji: "🏆", color: "bg-reward" },
];

const DailyOperationsBoard = () => {
  const [visitors, setVisitors] = useState<TodayVisitor[]>(loadTodayVisitors);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState<string | null>(null);

  const metrics = useMemo(() => {
    const total = visitors.length;
    const selfComplete = visitors.filter(v => v.selfChallengeComplete).length;
    const coachComplete = visitors.filter(v => v.status === "coach_backup").length;
    const partial = visitors.filter(v => v.status === "partial").length;
    const needsReview = visitors.filter(v => v.status === "needs_review").length;
    const pending = visitors.filter(v => v.status === "pending").length;
    const selfRate = total > 0 ? Math.round((selfComplete / total) * 100) : 0;
    return { total, selfComplete, coachComplete, partial, needsReview, pending, selfRate };
  }, [visitors]);

  const handleQuickAction = (userId: string, action: string) => {
    setVisitors(prev => {
      const updated = prev.map(v => {
        if (v.userId !== userId) return v;
        const statusMap: Record<string, ParticipationMode> = {
          complete: "coach_backup",
          partial: "partial",
          needs_review: "needs_review",
          levelup_check: "needs_review",
          league_promotion: "needs_review",
        };
        return { ...v, status: statusMap[action] || v.status, coachTags: selectedTags.length > 0 ? selectedTags : v.coachTags };
      });
      saveTodayVisitors(updated);
      return updated;
    });
    setSelectedTags([]);
    setShowTagPicker(null);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const pendingVisitors = visitors.filter(v => v.status === "pending");
  const processedVisitors = visitors.filter(v => v.status !== "pending");

  return (
    <div className="space-y-4">
      {/* Metrics — 2 rows */}
      <div className="grid grid-cols-3 gap-2">
        <MetricCard icon={<Users className="h-4 w-4 text-primary" />} label="오늘 방문" value={metrics.total} />
        <MetricCard icon={<CheckCircle2 className="h-4 w-4 text-status-complete" />} label="오늘 도전" value={metrics.selfComplete} />
        <MetricCard icon={<Clock className="h-4 w-4 text-status-pending" />} label="미처리" value={metrics.pending} highlight={metrics.pending > 0} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <MetricCard icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />} label="참여율" value={`${metrics.selfRate}%`} />
        <MetricCard icon={<CheckCircle2 className="h-3.5 w-3.5 text-primary" />} label="코치" value={metrics.coachComplete} />
        <MetricCard icon={<Shield className="h-3.5 w-3.5 text-status-pending" />} label="부분" value={metrics.partial} />
        <MetricCard icon={<AlertTriangle className="h-3.5 w-3.5 text-destructive" />} label="보완" value={metrics.needsReview} />
      </div>

      {/* Pending Queue */}
      {pendingVisitors.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-foreground">⏳ 코치 백업 필요 ({pendingVisitors.length}명)</h3>
          <div className="space-y-2">
            {pendingVisitors.map(v => (
              <div key={v.userId} className="rounded-2xl border border-status-pending/30 bg-card shadow-elev-1 overflow-hidden">
                <div className="flex items-center gap-3 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {v.nickname.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">{v.nickname}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {RANK_LABELS[v.currentRank] || v.currentRank} Lv.{v.currentLevel}
                    </p>
                  </div>
                </div>

                {/* Quick actions — 5 buttons */}
                <div className="flex gap-1 border-t border-border px-2 py-2">
                  {EXTENDED_ACTIONS.map(action => (
                    <button
                      key={action.id}
                      onClick={() => handleQuickAction(v.userId, action.id)}
                      className={`flex-1 rounded-lg py-1.5 text-[9px] font-bold text-white transition-all active:scale-95 ${action.color}`}
                    >
                      {action.emoji} {action.label}
                    </button>
                  ))}
                </div>

                {/* Quick tags toggle */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => setShowTagPicker(showTagPicker === v.userId ? null : v.userId)}
                    className="text-[10px] text-muted-foreground flex items-center gap-1"
                  >
                    🏷️ 태그 추가 <ChevronDown className={`h-3 w-3 transition-transform ${showTagPicker === v.userId ? "rotate-180" : ""}`} />
                  </button>
                  {showTagPicker === v.userId && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COACH_QUICK_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                            selectedTags.includes(tag) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed List */}
      {processedVisitors.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-foreground">✅ 처리 완료 ({processedVisitors.length}명)</h3>
          <div className="space-y-1.5">
            {processedVisitors.map(v => {
              const style = STATUS_STYLE[v.status] || STATUS_STYLE.pending;
              return (
                <div key={v.userId} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {v.nickname.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-foreground">{v.nickname}</p>
                      <span className="text-[9px] text-muted-foreground">{RANK_LABELS[v.currentRank]} Lv.{v.currentLevel}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                      {v.coachTags.length > 0 && (
                        <span className="text-[9px] text-muted-foreground">
                          {v.coachTags.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  {v.selfChallengeComplete && (
                    <span className="text-[9px] font-bold text-status-complete">오늘 도전</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {visitors.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-3xl">👥</span>
          <p className="mt-2 text-sm text-muted-foreground">오늘 방문자가 없습니다</p>
        </div>
      )}
    </div>
  );
};

const MetricCard = ({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number | string; highlight?: boolean }) => (
  <div className={`rounded-2xl border p-3 text-center ${highlight ? "border-status-pending/30 bg-status-pending/5" : "border-border bg-card"}`}>
    <div className="mx-auto mb-1 flex justify-center">{icon}</div>
    <p className="text-lg font-bold text-foreground">{value}</p>
    <p className="text-[9px] text-muted-foreground">{label}</p>
  </div>
);

export default DailyOperationsBoard;
