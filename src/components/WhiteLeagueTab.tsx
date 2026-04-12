import { useState } from "react";
import { whiteLevels, WhiteLevelDetail } from "@/data/whiteLevelData";
import {
  WHITE_LV1_META, WHITE_LV1_SESSION, WHITE_LV1_CHECKLIST,
  WHITE_LV1_PURPOSE, WHITE_LV1_VALUE, XP_RULES,
  PROMOTION_METRICS, RECOMMENDED_PATHS, BEGINNER_ALTERNATIVES,
  COACH_POINTS, WHITE_LV1_LEARNING,
  type SessionBlock, type ChecklistItem,
} from "@/data/whiteLevel1Data";
import {
  WHITE_LV2_META, WHITE_LV2_SESSION, WHITE_LV2_CHECKLIST,
  WHITE_LV2_PURPOSE, WHITE_LV2_VALUE, WHITE_LV2_XP_RULES,
  WHITE_LV2_PROMOTION_METRICS, WHITE_LV2_RECOMMENDED_PATHS,
  WHITE_LV2_BEGINNER_ALTS, WHITE_LV2_COACH_POINTS,
  WHITE_LV2_LEARNING,
} from "@/data/whiteLevel2Data";
import { ALL_LEVELS, getLevelById, type UnifiedLevel } from "@/data/allLevelsData";
import { getChecklistForLevel } from "@/data/levelRuleEngine";
import { useLocalProgress } from "@/hooks/useLocalProgress";
import SessionRunner from "@/components/SessionRunner";
import {
  CheckCircle2, Lock, ChevronRight, ChevronDown, Clock, Zap, Target,
  ArrowLeft, Star, Shield, Info, Dumbbell, Eye, Award, Play,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import whiteLv1Hero from "@/assets/white-lv1-hero.jpg";

type LevelState = "complete" | "active" | "locked";
type DetailView = null | { league: string; level: number };

const INTENSITY_STYLE: Record<string, string> = {
  "가볍게": "bg-status-complete/10 text-status-complete",
  "보통": "bg-primary/10 text-primary",
  "조금 힘듦": "bg-status-pending/10 text-status-pending",
};

const LEAGUE_CONFIG = [
  { id: "white", label: "화이트 리그", emoji: "⚪", levels: 10 },
  { id: "blue", label: "블루 리그", emoji: "🔵", levels: 10 },
  { id: "red", label: "레드 리그", emoji: "🔴", levels: 10 },
  { id: "black", label: "블랙 리그", emoji: "⚫", levels: 10 },
];

const WhiteLeagueTab = () => {
  const { progress } = useAuth();
  const [detailView, setDetailView] = useState<DetailView>(null);
  const [expandedLeague, setExpandedLeague] = useState<string | null>(null);

  const currentRank = progress?.current_rank || "white";
  const currentLevel = progress?.current_level || 1;
  const RANK_ORDER = ["white", "blue", "red", "black"];
  const currentGlobal = RANK_ORDER.indexOf(currentRank) * 10 + currentLevel;

  const getGlobalLevel = (league: string, level: number) => RANK_ORDER.indexOf(league) * 10 + level;

  const getLevelState = (league: string, level: number): LevelState => {
    const g = getGlobalLevel(league, level);
    if (g < currentGlobal) return "complete";
    if (g === currentGlobal) return "active";
    return "locked";
  };

  // Auto-expand current league
  const activeLeague = expandedLeague ?? currentRank;

  if (detailView) {
    return <UnifiedLevelDetailView league={detailView.league} levelNum={detailView.level} onBack={() => setDetailView(null)} />;
  }

  return (
    <div className="space-y-4">
      {/* League accordions */}
      {LEAGUE_CONFIG.map(lc => {
        const isExpanded = activeLeague === lc.id;
        const leagueLevels = ALL_LEVELS.filter(l => l.league === lc.id);
        const completedInLeague = leagueLevels.filter(l => getLevelState(lc.id, l.levelInLeague) === "complete").length;

        return (
          <div key={lc.id} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedLeague(isExpanded && expandedLeague !== null ? null : lc.id)}
              className="flex w-full items-center justify-between p-4 text-left active:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{lc.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{lc.label}</p>
                  <p className="text-[10px] text-muted-foreground">{completedInLeague}/{lc.levels} 완료</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(completedInLeague / lc.levels) * 100}%` }} />
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-border px-3 pb-3 space-y-2">
                {leagueLevels.map((ul, idx) => {
                  const state = getLevelState(lc.id, ul.levelInLeague);
                  const isLocked = state === "locked";
                  const isBoss = ul.levelInLeague === 10;

                  return (
                    <button
                      key={ul.globalLevel}
                      onClick={() => !isLocked && setDetailView({ league: lc.id, level: ul.levelInLeague })}
                      disabled={isLocked}
                      className={`group w-full rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                        state === "complete" ? "border-primary/20 bg-card"
                        : state === "active" ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border bg-muted/30 opacity-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          state === "complete" ? "bg-primary/10 text-primary"
                          : state === "active" ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                        }`}>
                          {state === "complete" ? <CheckCircle2 className="h-4 w-4" />
                            : state === "locked" ? <Lock className="h-3.5 w-3.5" />
                            : ul.levelInLeague}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-muted-foreground">Lv.{ul.globalLevel}</span>
                            {isBoss && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold text-accent-foreground">리그 승격</span>}
                          </div>
                          <p className={`text-xs font-bold leading-tight ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                            {ul.title}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">50분</span>
                          <span className="text-[10px] font-bold text-primary">+100XP</span>
                        </div>
                        {!isLocked && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   Unified Level Detail View — 40레벨 3탭 구조
   배우기 / 수업실행 / 심사
   ═══════════════════════════════════════════════════════ */
const UnifiedLevelDetailView = ({ league, levelNum, onBack }: { league: string; levelNum: number; onBack: () => void }) => {
  const ul = getLevelById(league, levelNum);
  const { metrics, status, canAttemptChecklist, submitChecklist } = useLocalProgress();
  const [activeSection, setActiveSection] = useState<"learn" | "session" | "check">("learn");
  const [showChecklist, setShowChecklist] = useState(false);
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);
  const [showSession, setShowSession] = useState(false);

  if (!ul) return <div className="p-4 text-center text-muted-foreground">레벨 데이터를 불러올 수 없습니다</div>;

  const checklist = getChecklistForLevel(`${league}-${levelNum}`);
  const [checkResults, setCheckResults] = useState<boolean[]>(checklist.map(() => false));

  // Use whiteLevel1/2 detailed session data if available, else use routineA
  const isWhiteLv1 = league === "white" && levelNum === 1;
  const isWhiteLv2 = league === "white" && levelNum === 2;
  const sessionBlocks = isWhiteLv1 ? WHITE_LV1_SESSION : isWhiteLv2 ? WHITE_LV2_SESSION : null;
  const xpRules = isWhiteLv1 ? XP_RULES : isWhiteLv2 ? WHITE_LV2_XP_RULES : null;
  const learning = isWhiteLv1 ? WHITE_LV1_LEARNING : isWhiteLv2 ? WHITE_LV2_LEARNING : null;
  const purpose = isWhiteLv1 ? WHITE_LV1_PURPOSE : isWhiteLv2 ? WHITE_LV2_PURPOSE : null;
  const value = isWhiteLv1 ? WHITE_LV1_VALUE : isWhiteLv2 ? WHITE_LV2_VALUE : null;
  const coachPoints = isWhiteLv1 ? COACH_POINTS : isWhiteLv2 ? WHITE_LV2_COACH_POINTS : null;
  const beginnerAlts = isWhiteLv1 ? BEGINNER_ALTERNATIVES : isWhiteLv2 ? WHITE_LV2_BEGINNER_ALTS : null;
  const recPaths = isWhiteLv1 ? RECOMMENDED_PATHS : isWhiteLv2 ? WHITE_LV2_RECOMMENDED_PATHS : null;

  const handleChecklistSubmit = () => {
    const passed = submitChecklist(checkResults);
    if (passed) {
      toast.success(`🎉 체크테스트 통과!`);
    } else {
      toast("보완 포인트를 확인하고 다시 도전하세요");
    }
    setShowChecklist(false);
  };

  if (showSession && sessionBlocks) {
    return (
      <div className="animate-slide-up space-y-4">
        <button onClick={() => setShowSession(false)} className="flex items-center gap-1.5 text-sm font-bold text-primary active:scale-95">
          <ArrowLeft className="h-4 w-4" /> 돌아가기
        </button>
        <SessionRunner blocks={sessionBlocks} levelLabel={`${league.charAt(0).toUpperCase()}${league.slice(1)} Lv.${levelNum}`} onComplete={() => setShowSession(false)} />
      </div>
    );
  }

  return (
    <div className="animate-slide-up space-y-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-primary active:scale-95">
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </button>

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-2xl shadow-md">
        {isWhiteLv1 ? (
          <img src={whiteLv1Hero} alt={ul.title} className="h-44 w-full object-cover" width={800} height={512} />
        ) : (
          <div className="flex h-44 items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
            <span className="text-6xl">🥊</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <span className="mb-1 inline-block rounded-full bg-card/90 px-2.5 py-0.5 text-[10px] font-bold text-primary backdrop-blur-sm">
            Lv.{ul.globalLevel}
          </span>
          <h2 className="text-xl font-bold text-white">{ul.title}</h2>
          <p className="text-xs text-white/80">{ul.shortGoal}</p>
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Clock className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">소요 시간</p>
            <p className="text-sm font-bold text-foreground">50분</p>
          </div>
        </div>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Zap className="h-4 w-4 text-primary" />
          <div>
            <p className="text-[10px] text-muted-foreground">보상</p>
            <p className="text-sm font-bold text-primary">+100 XP</p>
          </div>
        </div>
      </div>

      {/* Section tabs — 3탭 구조 */}
      <div className="flex gap-1 rounded-2xl bg-secondary p-1">
        {([
          { key: "learn" as const, label: "📖 배우기" },
          { key: "session" as const, label: "🥊 수업실행" },
          { key: "check" as const, label: "✅ 심사" },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              activeSection === tab.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ 배우기 Section ═══ */}
      {activeSection === "learn" && (
        <>
          {/* Learning modules from unified data */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">학습 모듈</span>
            </div>
            <div className="space-y-3">
              {(learning || ul.learningModules).map((mod, i) => (
                <div key={i} className="rounded-xl border border-border p-3">
                  <p className="mb-1 text-xs font-bold text-foreground">{mod.title}</p>
                  <div className="space-y-0.5">
                    {mod.keyPoints.map((kp, j) => (
                      <p key={j} className="text-[10px] text-muted-foreground">· {kp}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">오늘의 목적</span>
            </div>
            <div className="space-y-2">
              {(purpose || [ul.shortGoal]).map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</div>
                  <p className="text-sm text-foreground">{p}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Value */}
          <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-base">💎</span>
              <span className="text-sm font-bold text-primary">오늘 얻는 가치</span>
            </div>
            <div className="space-y-1">
              {(value || [ul.valueGained]).map((v, i) => <p key={i} className="text-sm text-foreground">· {v}</p>)}
            </div>
          </div>

          {/* Beginner alts (if available) */}
          {beginnerAlts && beginnerAlts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">초보자 대체 동작</span>
              </div>
              <div className="space-y-2">
                {beginnerAlts.map((alt, i) => (
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
          )}

          {/* Coach Points */}
          {(coachPoints || ul.coachTags.length > 0) && (
            <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4 text-accent-foreground" />
                <span className="text-sm font-bold text-accent-foreground">코치 포인트</span>
              </div>
              <div className="space-y-1.5">
                {(coachPoints || ul.coachTags).map((point, i) => <p key={i} className="text-xs text-foreground">👁️ {point}</p>)}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ 수업 실행 Section ═══ */}
      {activeSection === "session" && (
        <>
          {/* Routine blocks from unified data */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">50분 수업 구성</span>
              </div>
              {sessionBlocks && (
                <button
                  onClick={() => setShowSession(true)}
                  className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-all active:scale-95"
                >
                  <Play className="h-3 w-3" /> 수업 시작
                </button>
              )}
            </div>

            {/* Show detailed session blocks if available, otherwise show routine blocks */}
            {sessionBlocks ? (
              <div className="space-y-2">
                {sessionBlocks.map(block => {
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
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">루틴 A</p>
                {ul.routineA.map((block, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5">
                    <span className="text-lg">{block.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{block.title}</p>
                      <p className="text-[10px] text-muted-foreground">{block.durationMin}분 · {block.drills.slice(0, 2).join(", ")}</p>
                    </div>
                  </div>
                ))}
                {ul.routineB.length > 0 && (
                  <>
                    <p className="text-xs text-muted-foreground mt-3 mb-2">루틴 B</p>
                    {ul.routineB.map((block, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5">
                        <span className="text-lg">{block.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">{block.title}</p>
                          <p className="text-[10px] text-muted-foreground">{block.durationMin}분 · {block.drills.slice(0, 2).join(", ")}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* XP rules (if available) */}
          {xpRules && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">XP 규칙</span>
              </div>
              <div className="space-y-1.5">
                {xpRules.map(rule => (
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
          )}
        </>
      )}

      {/* ═══ 심사 Section ═══ */}
      {activeSection === "check" && (
        <>
          {/* 레벨업 조건 */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                {ul.levelInLeague === 10 ? "리그 승격 심사" : `레벨업 조건 (Lv.${ul.globalLevel} → Lv.${ul.globalLevel + 1})`}
              </span>
            </div>
            <div className="space-y-2">
              {[
                { emoji: "⚡", label: "XP", met: metrics.xp },
                { emoji: "🥊", label: "인정 세션", met: metrics.sessions },
                { emoji: "📅", label: "인정 출석일", met: metrics.days },
                { emoji: "⏱️", label: "훈련 시간", met: metrics.minutes },
              ].map(m => {
                const done = m.met && m.met.current >= m.met.target;
                return (
                  <div key={m.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{m.emoji}</span>
                      <span className="text-xs text-foreground">{m.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${done ? "text-status-complete" : "text-muted-foreground"}`}>
                        {m.met?.current ?? 0}/{m.met?.target ?? 0}
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
                <span className="text-xs font-bold text-muted-foreground">{checklist.length}개 중 {ul.progressionConfig.checklistPassCount}개 이상</span>
              </div>
            </div>
            {recPaths && (
              <div className="mt-3 flex gap-2">
                {recPaths.map(path => (
                  <div key={path.label} className="flex-1 rounded-xl bg-muted/30 p-2.5 text-center">
                    <p className="text-[10px] font-bold text-muted-foreground">{path.label}</p>
                    <p className="text-xs font-bold text-foreground">{path.frequency}</p>
                    <p className="text-[10px] text-muted-foreground">{path.duration} · {path.sessions}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checklist */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-sm font-bold text-foreground">체크테스트</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{checklist.length}개 중 {ul.progressionConfig.checklistPassCount}개 이상 통과</span>
            </div>
            <div className="space-y-2">
              {checklist.map(item => (
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
                      {item.details.map((d, di) => <p key={di} className="text-[10px] text-muted-foreground">· {d}</p>)}
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
        </>
      )}

      {/* Checklist Modal */}
      {showChecklist && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm" onClick={() => setShowChecklist(false)}>
          <div className="w-full max-w-lg animate-slide-up rounded-t-3xl border-t border-border bg-card p-6 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-bold text-foreground">✅ 체크테스트 — Lv.{ul.globalLevel}</h3>
            <div className="space-y-3">
              {checklist.map((item, idx) => (
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
    </div>
  );
};

export default WhiteLeagueTab;
