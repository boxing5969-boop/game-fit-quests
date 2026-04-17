import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FlaskConical, Map, Dumbbell, ShieldCheck, Play, ChevronDown, Lock, CheckCircle2, HelpCircle } from "lucide-react";
import { LEAGUE_SUMMARIES, FULL_VALUE_MAP } from "@/data/valueMapData";
import { EXERCISE_REASONS } from "@/data/exerciseReasonsData";
import { SAFETY_BLOCKS } from "@/data/safetyCheckData";
import { GUIDE_CARDS } from "@/data/whiteLevel1Data";
import { useAuth } from "@/contexts/AuthContext";

type GuideTab = "program" | "science" | "valuemap" | "exercise" | "safety" | "whitefaq";

const TABS: { id: GuideTab; label: string; icon: typeof BookOpen }[] = [
  { id: "program", label: "프로그램", icon: BookOpen },
  { id: "whitefaq", label: "화이트 FAQ", icon: HelpCircle },
  { id: "science", label: "과학설계", icon: FlaskConical },
  { id: "valuemap", label: "가치맵", icon: Map },
  { id: "exercise", label: "왜 하나요", icon: Dumbbell },
  { id: "safety", label: "안전", icon: ShieldCheck },
];

const GuidePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<GuideTab>("program");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <h1 className="mb-4 text-2xl text-foreground">📖 가이드</h1>

      {/* Tab switcher */}
      <div className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-secondary p-1 no-scrollbar">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold transition-all ${
                activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden min-[400px]:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === "program" && <ProgramTab />}
      {activeTab === "whitefaq" && (
        <div className="space-y-3 animate-slide-up">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs text-foreground leading-relaxed">
              프로그램에 대해 자주 묻는 질문을 모았습니다. 오늘 도전, 코치 백업, 1~40 전체 경로에 대한 설명을 확인하세요.
            </p>
          </div>
          {WHITE_FAQ.map((item, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <p className="mb-2 text-sm font-bold text-foreground">❓ {item.q}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      )}
      {activeTab === "science" && <ScienceTab />}
      {activeTab === "valuemap" && <ValueMapTab />}
      {activeTab === "exercise" && <ExerciseTab />}
      {activeTab === "safety" && <SafetyTab />}

      <button
        onClick={() => navigate("/onboarding")}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 py-4 text-sm font-bold text-primary transition-all active:scale-[0.98]"
      >
        <Play className="h-4 w-4" /> 온보딩 다시 보기
      </button>
    </div>
  );
};

/* ═══════════ 1. 프로그램 소개 (updated with guide cards) ═══════════ */
const ProgramTab = () => (
  <div className="space-y-4 animate-slide-up">
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-5 border border-primary/20">
      <h2 className="mb-2 text-lg font-bold text-foreground">
        153랭크업
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        1~40레벨로 구성된 복싱 성장 시스템입니다.
        <br />4개 리그를 통과하며 습관, 기본기, 실전, 코칭 역량까지 단계적으로 성장합니다.
      </p>
    </div>

    {/* New Guide Cards */}
    {GUIDE_CARDS.map(card => (
      <div key={card.id} className={`rounded-2xl border p-4 shadow-sm ${
        card.accent ? "border-primary/30 bg-primary/5" : "border-border bg-card"
      }`}>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">{card.emoji}</span>
          <h3 className="text-sm font-bold text-foreground">{card.title}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{card.body}</p>
      </div>
    ))}

    {/* Existing league summaries */}
    {LEAGUE_SUMMARIES.map(league => (
      <div key={league.rank} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-lg">{league.emoji}</span>
          <div>
            <p className="text-sm font-bold text-foreground">{league.label}</p>
            <p className="text-[10px] text-muted-foreground">{league.levels}</p>
          </div>
        </div>
        <p className="mb-2 text-xs font-bold text-primary">{league.theme}</p>
        <p className="mb-3 text-xs text-muted-foreground leading-relaxed">{league.description}</p>
        <div className="flex flex-wrap gap-1">
          {league.completionValues.map(v => (
            <span key={v} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{v}</span>
          ))}
        </div>
      </div>
    ))}
  </div>
);

/* ═══════════ White FAQ Tab ═══════════ */
const WHITE_FAQ = [
  { q: "White는 왜 쉽게 시작하나요?", a: "화이트는 운동 습관과 기본 리듬을 만드는 단계입니다. 너무 어려우면 포기하기 쉽기 때문에, 쉽지만 의미 있는 성취를 느낄 수 있도록 설계되었습니다." },
  { q: "White Lv.1에서 왜 잽을 배우나요?", a: "너무 지루하지 않도록 Lv.1부터 잽을 포함합니다. 첫 잽 경험은 복싱 정체성과 자신감을 만들어줍니다." },
  { q: "사다리 훈련은 왜 넣나요?", a: "사다리 훈련은 체력 메인보다 발놀림, 리듬, 협응을 위한 훈련입니다. 복싱에서 스텝과 리듬은 기본기의 핵심입니다." },
  { q: "주간 처방은 어떻게 정해지나요?", a: "최근 7일간 인정 세션 수를 기준으로 라이트/기본/빠른 경로 중 하나를 자동 추천합니다. 주간 활동량과 반복은 여러 날에 나누어 쌓는 것이 중요합니다." },
  { q: "짧게 쉬운 복귀도 가치가 있는 이유", a: "짧은 복귀 세션도 다시 리듬을 잡는 데 도움이 됩니다. 완벽한 50분보다 10분이라도 다시 시작하는 것이 더 중요합니다." },
  { q: "왜 이 프로그램은 필수인가요?", a: "153복싱짐의 핵심 전략 프로그램입니다. 모든 회원이 체계적으로 성장할 수 있도록 설계되어 있으며, 수동 기록보다 훨씬 편리하고 공정합니다." },
  { q: "왜 오늘 도전이 더 좋은 보상을 받나요?", a: "오늘 도전은 회원의 적극적인 참여를 장려합니다. 레벨업 진행은 동일하지만, 오늘 도전 시 보너스 XP와 연속 기록 등 추가 보상을 제공합니다." },
  { q: "왜 코치 백업 모드가 있나요?", a: "모든 회원이 프로그램에 빠짐없이 참여하도록 보장합니다. 오늘 도전을 하지 않은 회원도 코치가 빠르게 확인하여 진행도를 기록합니다." },
  { q: "왜 화이트 1~3은 쉬우면서도 반복적인가요?", a: "초기 단계는 운동 습관 형성이 가장 중요합니다. 쉽지만 반복을 통해 기초체력과 자세를 자연스럽게 몸에 익히는 구간입니다." },
  { q: "왜 레벨업은 공정하게 같고, 보너스는 다를 수 있나요?", a: "레벨업 조건(XP, 세션, 출석)은 오늘 도전이든 코치 백업이든 동일합니다. 하지만 적극적으로 참여하는 회원에게 추가 보너스를 제공하여 자발적 참여 문화를 만듭니다." },
  { q: "왜 1~40 전체가 연결된 성장 경로인가요?", a: "화이트부터 블랙까지 40레벨은 기초체력 → 기본기 → 실전 → 코칭 역량으로 이어지는 하나의 완전한 성장 경로입니다. 각 레벨은 이전 레벨의 기반 위에 쌓입니다." },
];

/* ═══════════ 2. 과학적 설계 ═══════════ */
const SCIENCE_CARDS = [
  {
    emoji: "🏃", title: "주간 활동량", stat: "150~300분",
    description: "WHO 권고: 중간 강도 유산소 활동을 주당 150~300분 수행하면 건강 효과가 큽니다.",
    tip: "짧은 활동도 누적됩니다. 10분씩 나눠도 OK!",
  },
  {
    emoji: "💪", title: "근력운동 일수", stat: "주 2회 이상",
    description: "ACSM 권고: 주요 근육군을 포함한 근력운동을 주 2회 이상 수행합니다.",
    tip: "하체 서킷, 코어 운동이 여기에 포함됩니다.",
  },
  {
    emoji: "📊", title: "운동 강도", stat: "RPE 3~7",
    description: "중간 강도(RPE 3~4)는 대화 가능, 고강도(RPE 5~7)는 몇 마디 후 숨 고르기.",
    tip: "초보자는 RPE 3~4부터 시작하세요.",
  },
  {
    emoji: "🔄", title: "회복과 지속성", stat: "점진적 증가",
    description: "급격한 증가보다 점진적으로 늘리는 것이 부상 없이 오래 운동하는 비결입니다.",
    tip: "매주 10% 이내로 운동량을 늘리세요.",
  },
];

const ScienceTab = () => (
  <div className="space-y-3 animate-slide-up">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs text-foreground leading-relaxed">
        이 앱은 WHO·CDC·ACSM 권고를 참고해 활동량, 강도, 근력, 회복 균형을 설명합니다.
        공식 인증 또는 의료 서비스가 아닙니다. 꾸준한 반복과 여러 날에 걸친 훈련을 중요하게 봅니다.
      </p>
    </div>
    {SCIENCE_CARDS.map(card => (
      <div key={card.title} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xl">{card.emoji}</span>
          <div>
            <p className="text-sm font-bold text-foreground">{card.title}</p>
            <p className="text-xs font-bold text-primary">{card.stat}</p>
          </div>
        </div>
        <p className="mb-2 text-xs text-muted-foreground leading-relaxed">{card.description}</p>
        <div className="rounded-xl bg-primary/5 px-3 py-2">
          <p className="text-[11px] text-primary">💡 {card.tip}</p>
        </div>
      </div>
    ))}
  </div>
);

/* ═══════════ 3. 가치맵 ═══════════ */
const RANK_EMOJI: Record<string, string> = { white: "⚪", blue: "🔵", red: "🔴", black: "⚫" };
const RANK_LABEL: Record<string, string> = { white: "화이트", blue: "블루", red: "레드", black: "블랙" };

const ValueMapTab = () => {
  const { progress } = useAuth();
  const [expandedLeague, setExpandedLeague] = useState<string | null>("white");
  const currentRank = progress?.current_rank || "white";
  const currentLevel = progress?.current_level || 1;
  const RANK_ORDER = ["white", "blue", "red", "black"];
  const currentGlobal = RANK_ORDER.indexOf(currentRank) * 10 + currentLevel;
  const leagues = ["white", "blue", "red", "black"] as const;

  return (
    <div className="space-y-3 animate-slide-up">
      {leagues.map(league => {
        const levels = FULL_VALUE_MAP.filter(l => l.league === league);
        const isExpanded = expandedLeague === league;
        return (
          <div key={league} className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <button onClick={() => setExpandedLeague(isExpanded ? null : league)} className="flex w-full items-center justify-between p-4 text-left active:bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="text-lg">{RANK_EMOJI[league]}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{RANK_LABEL[league]} 리그</p>
                  <p className="text-[10px] text-muted-foreground">Lv {levels[0].level}~{levels[levels.length - 1].level}</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </button>
            {isExpanded && (
              <div className="border-t border-border px-3 pb-3">
                {levels.map(lv => {
                  const isComplete = lv.level < currentGlobal;
                  const isCurrent = lv.level === currentGlobal;
                  const isLocked = lv.level > currentGlobal;
                  return (
                    <div key={lv.level} className={`mt-2 rounded-xl p-3 transition-all ${isCurrent ? "border border-primary/30 bg-primary/5" : isComplete ? "bg-muted/30" : "bg-muted/10 opacity-60"}`}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isComplete ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : isLocked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <div className="h-3.5 w-3.5 rounded-full bg-primary animate-pulse" />}
                          <span className="text-[10px] font-bold text-muted-foreground">Lv.{lv.level}</span>
                        </div>
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent-foreground">🔓 {lv.unlockedBenefit}</span>
                      </div>
                      <p className="text-xs font-bold text-foreground">{lv.shortValueTitle}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{lv.valueDescription}</p>
                    </div>
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

/* ═══════════ 4. 왜 이 운동을 하나요? ═══════════ */
const ExerciseTab = () => (
  <div className="space-y-3 animate-slide-up">
    {EXERCISE_REASONS.map(ex => (
      <div key={ex.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-2xl">{ex.emoji}</span>
          <h3 className="text-sm font-bold text-foreground">{ex.name}</h3>
        </div>
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-bold text-primary">왜 하나요?</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{ex.whyDoIt}</p>
        </div>
        <div className="mb-3">
          <p className="mb-1 text-[10px] font-bold text-primary">무엇이 좋아지나요?</p>
          <div className="flex flex-wrap gap-1">
            {ex.whatImproves.map(tag => (
              <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{tag}</span>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-accent/5 border border-accent/10 px-3 py-2">
          <p className="text-[10px] font-bold text-accent-foreground mb-0.5">✅ 초보자 체크포인트</p>
          <p className="text-[11px] text-muted-foreground">{ex.beginnerCheckpoint}</p>
        </div>
      </div>
    ))}
  </div>
);

/* ═══════════ 5. 안전 가이드 ═══════════ */
const severityStyles = {
  info: "border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-950/20",
  warning: "border-yellow-200 bg-yellow-50 dark:border-yellow-900/30 dark:bg-yellow-950/20",
  danger: "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20",
};

const SafetyTab = () => (
  <div className="space-y-3 animate-slide-up">
    <p className="text-xs text-muted-foreground mb-1">안전하게 시작하고 오래 운동하기 위한 가이드입니다.</p>
    {SAFETY_BLOCKS.map(block => (
      <div key={block.id} className={`rounded-2xl border p-4 ${severityStyles[block.severity]}`}>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-lg">{block.emoji}</span>
          <h3 className="text-sm font-bold text-foreground">{block.title}</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{block.description}</p>
      </div>
    ))}
  </div>
);

export default GuidePage;
