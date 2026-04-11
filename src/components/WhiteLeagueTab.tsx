import { useState } from "react";
import { whiteLevels, WhiteLevelDetail } from "@/data/whiteLevelData";
import {
  WHITE_LV1_META,
  WHITE_LV1_SESSION,
  WHITE_LV1_CHECKLIST,
  WHITE_LV1_PURPOSE,
  WHITE_LV1_VALUE,
  XP_RULES,
  PROMOTION_METRICS,
  RECOMMENDED_PATHS,
  BEGINNER_ALTERNATIVES,
  COACH_POINTS,
  SUPPLEMENT_RULES,
  PROMOTION_RULES,
  type SessionBlock,
  type ChecklistItem,
} from "@/data/whiteLevel1Data";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import {
  CheckCircle2, Lock, ChevronRight, ChevronDown, Clock, Zap, Target,
  ArrowLeft, Star, Shield, Info, Dumbbell, Eye, Award,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import whiteLv1Hero from "@/assets/white-lv1-hero.jpg";

type LevelState = "complete" | "active" | "locked";

const INTENSITY_STYLE: Record<string, string> = {
  "가볍게": "bg-status-complete/10 text-status-complete",
  "보통": "bg-primary/10 text-primary",
  "조금 힘듦": "bg-status-pending/10 text-status-pending",
};

const WhiteLeagueTab = () => {
  const { progress } = useAuth();
  const [selectedLevel, setSelectedLevel] = useState<WhiteLevelDetail | null>(null);
  const [showLv1Detail, setShowLv1Detail] = useState(false);

  const currentRank = progress?.current_rank || "white";
  const currentLevel = progress?.current_level || 1;

  const getLevelState = (level: number): LevelState => {
    if (currentRank !== "white") return "complete";
    if (level < currentLevel) return "complete";
    if (level === currentLevel) return "active";
    return "locked";
  };

  const completedCount = whiteLevels.filter(l => getLevelState(l.level) === "complete").length;
  const progressPct = Math.round((completedCount / whiteLevels.length) * 100);

  // Show White Lv.1 full detail
  if (showLv1Detail) {
    return <WhiteLv1DetailView onBack={() => setShowLv1Detail(false)} />;
  }

  // Show other level detail
  if (selectedLevel) {
    return <LevelDetailView level={selectedLevel} state={getLevelState(selectedLevel.level)} onBack={() => setSelectedLevel(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground">⚪ 화이트 리그 진행률</span>
          <span className="text-sm font-bold text-primary">{completedCount}/10</span>
        </div>
        <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-1 px-1">
          {whiteLevels.map(l => {
            const state = getLevelState(l.level);
            return (
              <div
                key={l.level}
                className={`h-2 w-2 rounded-full transition-all ${
                  state === "complete" ? "bg-primary" :
                  state === "active" ? "bg-primary animate-pulse ring-2 ring-primary/30" :
                  "bg-muted-foreground/20"
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Level cards */}
      <div className="space-y-2.5">
        {whiteLevels.map((level, idx) => {
          const state = getLevelState(level.level);
          const isLocked = state === "locked";
          const isLv1 = level.level === 1;

          return (
            <button
              key={level.level}
              onClick={() => {
                if (isLocked) return;
                if (isLv1) setShowLv1Detail(true);
                else setSelectedLevel(level);
              }}
              disabled={isLocked}
              className={`group w-full animate-slide-up rounded-2xl border p-4 text-left transition-all active:scale-[0.98] ${
                state === "complete"
                  ? "border-primary/20 bg-card shadow-sm"
                  : state === "active"
                  ? "border-primary/40 bg-card shadow-md ring-1 ring-primary/20"
                  : "border-border bg-muted/50 opacity-60"
              }`}
              style={{ animationDelay: `${idx * 0.04}s` }}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  state === "complete" ? "bg-primary/10 text-primary"
                  : state === "active" ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground"
                }`}>
                  {state === "complete" ? <CheckCircle2 className="h-5 w-5" />
                    : state === "locked" ? <Lock className="h-4 w-4" />
                    : level.level}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">{level.levelLabel}</span>
                    {level.level === 10 && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-accent-foreground">리그 승격</span>
                    )}
                  </div>
                  <h3 className={`text-sm font-bold leading-tight ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                    {isLv1 ? WHITE_LV1_META.title : level.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {isLv1 ? WHITE_LV1_META.shortGoal : level.shortGoal}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs font-bold text-primary">+{isLv1 ? WHITE_LV1_META.baseXp : level.xpReward} XP</span>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="text-[10px]">{isLv1 ? WHITE_LV1_META.duration : level.duration}</span>
                  </div>
                </div>
                {!isLocked && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   White Lv.1 Full Detail View
   ═══════════════════════════════════════════════════════ */
const WhiteLv1DetailView = ({ onBack }: { onBack: () => void }) => {
  const { metrics, status, totalXp, canAttemptChecklist, submitChecklist } = useLocalProgress();
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [showChecklist, setShowChecklist] = useState(false);
  const [checkResults, setCheckResults] = useState<boolean[]>([false, false, false, false, false, false]);

  const handleChecklistSubmit = () => {
    const passed = submitChecklist(checkResults);
    if (passed) {
      toast.success("🎉 체크테스트 통과! 화이트 Lv.2 승급 가능!");
    } else {
      toast("보완 포인트를 확인하고 6회차에서 다시 도전하세요");
    }
    setShowChecklist(false);
  };

  return (
    <div className="animate-slide-up space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-primary active:scale-95">
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </button>

      {/* 1. Hero Card */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        <img src={whiteLv1Hero} alt="White Lv.1" className="h-44 w-full object-cover" width={800} height={512} />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <span className="mb-1 inline-block rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] font-bold text-primary backdrop-blur-sm">
            {WHITE_LV1_META.levelLabel}
          </span>
          <h2 className="text-xl font-bold text-white">{WHITE_LV1_META.title}</h2>
          <p className="text-xs text-white/80">{WHITE_LV1_META.shortGoal}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Clock className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">소요 시간</p>
            <p className="text-sm font-bold text-foreground">{WHITE_LV1_META.duration}</p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">보상</p>
            <p className="text-sm font-bold text-primary">+{WHITE_LV1_META.baseXp} XP</p>
          </div>
        </div>
      </div>

      {/* 2. 오늘의 목적 */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">오늘의 목적</span>
        </div>
        <div className="space-y-2">
          {WHITE_LV1_PURPOSE.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</div>
              <p className="text-sm text-foreground">{p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 3. 50분 수업 구성 */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">50분 수업 구성</span>
        </div>
        <div className="space-y-2">
          {WHITE_LV1_SESSION.map(block => {
            const isExpanded = expandedBlock === block.id;
            return (
              <div key={block.id} className="overflow-hidden rounded-xl border border-border">
                <button
                  onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-all active:bg-muted/50"
                >
                  <span className="text-lg">{block.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">{block.timeRange}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${INTENSITY_STYLE[block.intensity]}`}>
                        {block.intensity}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-foreground">{block.title}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{block.durationMin}분</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 px-3 pb-3 pt-2">
                    <p className="mb-2 text-xs text-muted-foreground">{block.description}</p>
                    <div className="space-y-1">
                      {block.drills.map((drill, di) => (
                        <div key={di} className="flex items-start gap-2">
                          <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/40" />
                          <p className="text-xs text-foreground">
                            {drill.name}{drill.detail ? <span className="text-muted-foreground"> · {drill.detail}</span> : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                    {block.beginnerAlt && (
                      <div className="mt-2 rounded-lg bg-primary/5 px-2.5 py-1.5">
                        <p className="text-[10px] text-primary">💡 초보자: {block.beginnerAlt}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. XP 규칙 */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">XP 규칙</span>
        </div>
        <div className="space-y-1.5">
          {XP_RULES.map(rule => (
            <div key={rule.label} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
              <div>
                <p className="text-xs font-bold text-foreground">{rule.label}</p>
                {rule.note && <p className="text-[10px] text-muted-foreground">{rule.note}</p>}
              </div>
              <span className={`text-sm font-bold ${rule.xp > 0 ? "text-primary" : "text-muted-foreground"}`}>
                {rule.xp > 0 ? `+${rule.xp}` : "0"} XP
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. 승급 조건 */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">승급 조건 (Lv.1 → Lv.2)</span>
        </div>
        <div className="space-y-2">
          {PROMOTION_METRICS.map(m => {
            const met = metrics[m.id as keyof typeof metrics];
            const done = met && met.current >= met.target;
            return (
              <div key={m.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{m.emoji}</span>
                  <span className="text-xs text-foreground">{m.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${done ? "text-status-complete" : "text-muted-foreground"}`}>
                    {met?.current ?? 0}/{m.target}{m.unit}
                  </span>
                  {done && <CheckCircle2 className="h-3.5 w-3.5 text-status-complete" />}
                </div>
              </div>
            );
          })}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm">✅</span>
              <span className="text-xs text-foreground">체크테스트 통과</span>
            </div>
            <span className="text-xs font-bold text-muted-foreground">6개 중 5개 이상</span>
          </div>
        </div>

        {/* Recommended paths */}
        <div className="mt-3 flex gap-2">
          {RECOMMENDED_PATHS.map(path => (
            <div key={path.label} className="flex-1 rounded-xl bg-muted/30 p-2.5 text-center">
              <p className="text-[10px] font-bold text-muted-foreground">{path.label}</p>
              <p className="text-xs font-bold text-foreground">{path.frequency}</p>
              <p className="text-[10px] text-muted-foreground">{path.duration} · {path.sessions}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 6. 최종 체크테스트 */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">최종 체크테스트</span>
          </div>
          <span className="text-[10px] text-muted-foreground">6개 중 5개 이상 통과</span>
        </div>
        <div className="space-y-2">
          {WHITE_LV1_CHECKLIST.map((item, idx) => (
            <div key={item.id} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{item.id}.</span>
                  <span className="text-xs font-bold text-foreground">{item.title}</span>
                </div>
                {item.mandatory && (
                  <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold text-destructive">필수</span>
                )}
              </div>
              {item.details.length > 0 && (
                <div className="mt-1 ml-5 space-y-0.5">
                  {item.details.map((d, di) => (
                    <p key={di} className="text-[10px] text-muted-foreground">· {d}</p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {canAttemptChecklist && (
          <button
            onClick={() => setShowChecklist(true)}
            className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]"
          >
            ✅ 체크테스트 시작
          </button>
        )}
      </div>

      {/* Checklist Modal */}
      {showChecklist && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowChecklist(false)}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-foreground">✅ 체크테스트</h3>
            <div className="space-y-3">
              {WHITE_LV1_CHECKLIST.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => {
                    const next = [...checkResults];
                    next[idx] = !next[idx];
                    setCheckResults(next);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                    checkResults[idx] ? "border-status-complete/30 bg-status-complete/5" : "border-border"
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${checkResults[idx] ? "bg-status-complete text-white" : "bg-muted"}`}>
                    {checkResults[idx] && <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-foreground">{item.title}</p>
                    {item.mandatory && <span className="text-[9px] text-destructive">필수 항목</span>}
                  </div>
                </button>
              ))}
            </div>
            <button onClick={handleChecklistSubmit} className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]">
              결과 확인
            </button>
          </div>
        </div>
      )}

      {/* 7. 오늘 얻는 가치 */}
      <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-base">💎</span>
          <span className="text-sm font-bold text-primary">오늘 얻는 가치</span>
        </div>
        <div className="space-y-1">
          {WHITE_LV1_VALUE.map((v, i) => (
            <p key={i} className="text-sm text-foreground">· {v}</p>
          ))}
        </div>
      </div>

      {/* 8. 초보자 대체 동작 */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">초보자 대체 동작</span>
        </div>
        <div className="space-y-2">
          {BEGINNER_ALTERNATIVES.map((alt, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/30 p-2.5">
              <span className="text-xs font-bold text-primary">{alt.original}</span>
              <span className="text-xs text-muted-foreground">→</span>
              <div>
                <p className="text-xs font-bold text-foreground">{alt.alt}</p>
                <p className="text-[10px] text-muted-foreground">{alt.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 9. 코치 포인트 */}
      <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4 text-accent-foreground" />
          <span className="text-sm font-bold text-accent-foreground">코치 포인트</span>
        </div>
        <div className="space-y-1.5">
          {COACH_POINTS.map((point, i) => (
            <p key={i} className="text-xs text-foreground">👁️ {point}</p>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className={`rounded-xl p-3 text-center text-sm font-bold ${
        status === "레벨업 완료" ? "bg-status-complete/10 text-status-complete"
        : status === "레벨업 심사 가능" ? "bg-primary text-primary-foreground"
        : status === "보완 필요" ? "bg-status-pending/10 text-status-pending"
        : status === "코치 확인 필요" ? "bg-destructive/10 text-destructive"
        : "bg-muted text-muted-foreground"
      }`}>
        {status === "진행중" ? "🥊 현재 진행 중" : status}
      </div>
    </div>
  );
};

/* ─── Other Level Detail View (kept) ──────────────────── */
const LevelDetailView = ({
  level, state, onBack,
}: {
  level: WhiteLevelDetail; state: LevelState; onBack: () => void;
}) => {
  const sectionItems = [
    { icon: Target, label: "오늘의 목적", content: level.sections.purpose },
    { icon: Zap, label: "무엇을 하게 되나요", content: level.sections.whatToDo },
    { icon: Star, label: "왜 중요한가", content: level.sections.whyImportant },
    { icon: CheckCircle2, label: "완료 조건", content: level.sections.completionCondition },
  ];

  return (
    <div className="animate-slide-up space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-primary active:scale-95">
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </button>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/5 to-accent/10 p-8 text-center">
        <span className="text-5xl">🥊</span>
        <p className="mt-2 text-xs text-muted-foreground">{level.illustrationTitle}</p>
      </div>
      <div>
        <span className="text-xs font-bold text-primary">{level.levelLabel}</span>
        <h2 className="text-xl font-bold text-foreground">{level.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{level.shortGoal}</p>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-card border border-border p-3">
          <Clock className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">소요 시간</p>
            <p className="text-sm font-bold text-foreground">{level.duration}</p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-card border border-border p-3">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">보상</p>
            <p className="text-sm font-bold text-primary">+{level.xpReward} XP</p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {sectionItems.map(({ icon: Icon, label, content }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold text-foreground">{label}</span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{content}</p>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-base">💎</span>
          <span className="text-sm font-bold text-primary">오늘 얻는 가치</span>
        </div>
        <p className="text-sm leading-relaxed text-foreground">{level.valueGained}</p>
      </div>
      <div className={`rounded-xl p-3 text-center text-sm font-bold ${
        state === "complete" ? "bg-primary/10 text-primary"
        : state === "active" ? "bg-primary text-primary-foreground"
        : "bg-muted text-muted-foreground"
      }`}>
        {state === "complete" ? "✅ 완료됨" : state === "active" ? "🥊 현재 진행 중" : "🔒 잠김"}
      </div>
    </div>
  );
};

export default WhiteLeagueTab;
