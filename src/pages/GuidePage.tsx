import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, FlaskConical, Map, Dumbbell, ShieldCheck, Play, ChevronDown, ChevronRight, Lock, CheckCircle2, HelpCircle, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RANK_LABELS } from "@/data/sharedConstants";
import { LEAGUE_SUMMARIES, FULL_VALUE_MAP } from "@/data/valueMapData";
import { EXERCISE_REASONS } from "@/data/exerciseReasonsData";
import { SAFETY_BLOCKS } from "@/data/safetyCheckData";
import { GUIDE_CARDS } from "@/data/whiteLevel1Data";
import { useAuth } from "@/contexts/AuthContext";
import { useTutorialState } from "@/hooks/useTutorialState";

type GuideTab = "program" | "levelup" | "science" | "valuemap" | "exercise" | "safety" | "whitefaq";

const TABS: { id: GuideTab; label: string; icon: typeof BookOpen }[] = [
  { id: "program", label: "프로그램", icon: BookOpen },
  { id: "levelup", label: "승급 기준", icon: TrendingUp },
  { id: "whitefaq", label: "화이트 FAQ", icon: HelpCircle },
  { id: "science", label: "과학설계", icon: FlaskConical },
  { id: "valuemap", label: "가치맵", icon: Map },
  { id: "exercise", label: "왜 하나요", icon: Dumbbell },
  { id: "safety", label: "안전", icon: ShieldCheck },
];

const GuidePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<GuideTab>("program");

  // 64-L: 오삼 가이드 step 2 (마이복서153 알아보기) 진행 중이면
  //   6 탭 cascade 안내 — 다음 미클릭 탭에 amber pulse + '👆 클릭' 라벨.
  //   6 탭 모두 click 시 자동 advance (5초 체류 폴백 그대로 유지).
  const tutorial = useTutorialState();
  const isTutorialStep2 =
    tutorial.isEligible && tutorial.currentStep?.key === "discover_app";
  const [clickedTabs, setClickedTabs] = useState<Set<GuideTab>>(
    () => new Set(["program"]),
  );
  // 첫 진입 시 program 활성 상태이므로 미리 시작 탭 등록.
  useEffect(() => {
    if (!isTutorialStep2) return;
    if (clickedTabs.size >= TABS.length) {
      const t = window.setTimeout(() => {
        try {
          tutorial.advance();
        } catch {
          /* noop */
        }
      }, 600);
      return () => window.clearTimeout(t);
    }
  }, [isTutorialStep2, clickedTabs, tutorial]);

  // 다음 안내해야 할 미클릭 탭 — 첫 unclicked 탭만 highlight
  const nextUnclickedTab = isTutorialStep2
    ? TABS.find((t) => !clickedTabs.has(t.id))?.id
    : null;

  const handleTabClick = (id: GuideTab) => {
    setActiveTab(id);
    if (isTutorialStep2) {
      setClickedTabs((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  };

  return (
    <div className="light-surface min-h-screen mx-auto max-w-lg px-4 pb-24 pt-4">
      <h1 className="mb-4 text-2xl text-foreground">📖 가이드</h1>

      {/* 64-L: 튜토리얼 안내 카드 — step 2 진행 중일 때만 */}
      {isTutorialStep2 && (
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="text-base">👆</span>
          <span className="flex-1">
            아래 <span className="number-font">{TABS.length}</span>개 탭을 한 번씩 눌러보세요. 클릭{" "}
            <span className="number-font">{clickedTabs.size}</span> /{" "}
            <span className="number-font">{TABS.length}</span> 완료 시 자동 진행.
          </span>
        </div>
      )}

      {/* Tab switcher */}
      <div
        data-tour="guide-tab-switcher"
        className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-secondary p-1 no-scrollbar"
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isClicked = clickedTabs.has(tab.id);
          const isNextHint = isTutorialStep2 && nextUnclickedTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tour={`guide-tab-${tab.id}`}
              onClick={() => handleTabClick(tab.id)}
              className={`relative flex shrink-0 flex-1 items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-xs font-bold transition-all ${
                activeTab === tab.id ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
              } ${
                isNextHint
                  ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-secondary animate-pulse"
                  : ""
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden min-[400px]:inline">{tab.label}</span>
              {isNextHint && (
                <span className="absolute -top-1 -right-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-amber-950 shadow-md">
                  👆 클릭
                </span>
              )}
              {isTutorialStep2 && isClicked && (
                <span className="absolute -top-1 -right-1 text-emerald-500">
                  <CheckCircle2 className="h-3 w-3 fill-emerald-500/20" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "program" && <ProgramTab />}
      {activeTab === "levelup" && <LevelUpTab />}
      {activeTab === "whitefaq" && (
        <div className="space-y-3 animate-slide-up">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-xs text-foreground leading-relaxed">
              프로그램에 대해 자주 묻는 질문을 모았습니다. 오늘 도전, 코치 백업, 1~40 전체 경로에 대한 설명을 확인하세요.
            </p>
          </div>
          {WHITE_FAQ.map((item, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
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
        data-tour="guide-onboarding-replay"
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
    <div data-tutorial-target="guide-first-card" className="rounded-2xl bg-gradient-to-br from-primary/10 to-reward/10 p-5 border border-primary/20">
      <h2 className="mb-2 text-lg font-bold text-foreground">
        마이복서153
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        1~40레벨로 구성된 복싱 성장 시스템입니다.
        <br />4개 리그를 통과하며 습관, 기본기, 실전, 코칭 역량까지 단계적으로 성장합니다.
      </p>
    </div>

    {/* New Guide Cards */}
    {GUIDE_CARDS.map(card => (
      <div key={card.id} className={`rounded-2xl border p-4 shadow-elev-1 ${
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
      <div key={league.rank} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
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

/* ═══════════ 2. 승급 기준 ═══════════
   숫자는 전부 서버(get_levelup_rules)에서 받는다. 여기에 하드코딩하면
   서버 기준이 바뀔 때 또 어긋난다 — 이미 "레벨당 3회"가 세 군데 박혀
   블루 회원에게 틀린 숫자를 보여주던 문제가 있었다. */
interface LevelUpRule {
  rank: string;
  firstLevel: number;
  lastLevel: number;
  visitsPerLevel: number;
  minDaysPerLevel: number;
  autoAdvance: boolean;
  levelAuthority: "coach" | "manager" | "owner";
  titleAuthority: "coach" | "manager" | "owner";
}
interface MyCycle {
  sessions: number; reqSessions: number; rank?: string;
  /** 승급 진행도 (출석 1회 = 1.0, 운동시간 보너스 최대 1.25) — 홈 카드 막대와 같은 값 */
  progress?: number;
  reqMinDays?: number; elapsedDays?: number; meets: boolean;
  // 패스트 트랙 직행권 잔여 수 (get_level_cycle_progress)
  fastTrackGates?: number;
}

const WHO: Record<LevelUpRule["titleAuthority"], string> = {
  coach: "담당 코치님",
  manager: "지점장·관장님",
  owner: "관장님",
};

const LevelUpTab = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: rules = [] } = useQuery({
    queryKey: ["levelup-rules"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_levelup_rules", {});
      if (error) throw error;
      return (data || []) as LevelUpRule[];
    },
  });

  const { data: cycle } = useQuery({
    queryKey: ["level-cycle", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as MyCycle;
    },
  });

  const mine = rules.find((r) => r.rank === cycle?.rank);
  // 이번 레벨 진행도 — 홈 카드 막대와 같은 값(progress). 한 자리 내림: 판정은 floor 다.
  const cur = cycle ? Math.floor(Number(cycle.progress ?? cycle.sessions) * 10) / 10 : 0;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* 두 가지 길 */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <h2 className="mb-2 text-sm font-bold text-foreground">레벨이 오르는 길은 두 개입니다</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          하나는 <b className="text-foreground">출석</b>으로 저절로 오르는 길, 하나는
          <b className="text-foreground"> 코치님이 직접 보고</b> 올려주는 길입니다.
          어느 쪽이든 레벨업 조건은 모두에게 같습니다.
        </p>
      </div>

      {/* 레벨 40까지 얼마나 걸리나 — 상세 페이지 (2026-09-22) */}
      <button
        onClick={() => navigate("/guide/journey")}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-elev-1 transition-all active:scale-[0.99]"
      >
        <span className="text-xl">⏱</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">레벨 40까지 얼마나 걸릴까요?</span>
          <span className="block text-[11px] text-muted-foreground">내 출석 페이스로 계산한 예상 기간 · 리그별 필요 출석</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl border border-border bg-card p-3.5 shadow-elev-1">
          <p className="mb-1.5 text-xs font-bold text-primary">🚪 출석으로 저절로</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            입구에서 얼굴 인식만 하면 출석이 쌓입니다. 리그 요건만큼 모이면 다음 레벨로
            자동 승급됩니다. 누를 버튼도 없습니다.
          </p>
        </div>
        <div className="rounded-2xl border border-reward/30 bg-reward/5 p-3.5 shadow-elev-1">
          <p className="mb-1.5 text-xs font-bold text-reward-foreground">🥇 코치님 심사로</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">레벨 10·20·30·40</b>은 출석을 다 채워도 자동으로
            오르지 않습니다. 코치님이 직접 보고 승인해야 넘어갑니다.
          </p>
        </div>
      </div>

      {/* 내 기준 */}
      {cycle && mine && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
          <p className="mb-2 text-xs font-bold text-foreground">
            지금 회원님 기준 — {RANK_LABELS[mine.rank] || mine.rank} 리그
          </p>
          <div className="mb-2 flex items-end gap-1.5">
            <span className="number-font text-2xl font-bold text-primary">{cur.toLocaleString()}</span>
            <span className="number-font text-sm text-muted-foreground">/ {cycle.reqSessions}회</span>
            <span className="ml-1 pb-0.5 text-[11px] text-muted-foreground">이번 레벨 진행도</span>
          </div>
          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, (cur / Math.max(1, cycle.reqSessions)) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {mine.autoAdvance
              ? `이 리그는 출석 ${mine.visitsPerLevel}회를 채우면 자동으로 다음 레벨로 갑니다. 단, 레벨 ${mine.lastLevel}은 심사를 거칩니다.`
              : `이 리그는 출석을 채워도 자동으로 오르지 않습니다. ${mine.visitsPerLevel}회를 채우면 심사가 열리고, ${WHO[mine.levelAuthority]}이 보고 승급합니다.`}
            {(mine.minDaysPerLevel ?? 0) > 0 &&
              ` 그리고 레벨마다 최소 ${mine.minDaysPerLevel}일을 머물러야 합니다 — 출석을 몰아쳐도 건너뛸 수 없습니다.`}
          </p>
          {(cycle.fastTrackGates ?? 0) > 0 && (
            <p className="mt-2 rounded-lg border border-reward/30 bg-reward/5 px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-reward-foreground">
              ⚡ 회원님은 패스트 트랙입니다 — 남은 직행권 {cycle.fastTrackGates}장.
              타이틀매치를 통과하면 다음 리그의 타이틀매치로 바로 넘어갑니다.
            </p>
          )}
        </div>
      )}

      {/* 리그별 요건 */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-xs font-bold text-foreground">리그별 승급 요건</p>
        </div>
        {rules.map((r) => (
          <div key={r.rank} className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
            <div className="w-[68px] shrink-0">
              <p className="text-xs font-bold text-foreground">{RANK_LABELS[r.rank] || r.rank}</p>
              <p className="number-font text-[10px] text-muted-foreground">
                Lv {r.firstLevel}~{r.lastLevel}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground">
                한 레벨에 출석{" "}
                <b className="number-font text-primary">{r.visitsPerLevel}회</b>
                {(r.minDaysPerLevel ?? 0) > 0 && (
                  <>
                    {" + 레벨마다 "}
                    <b className="number-font text-primary">{r.minDaysPerLevel}일</b>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                {r.autoAdvance
                  ? `출석만 채우면 자동 승급 · 레벨 ${r.lastLevel}만 심사`
                  : "출석을 채우면 심사가 열립니다 · 전 레벨 심사"}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 타이틀매치 */}
      <div className="overflow-hidden rounded-2xl border border-reward/30 bg-card shadow-elev-1">
        <div className="border-b border-border bg-reward/5 px-4 py-2.5">
          <p className="text-xs font-bold text-reward-foreground">🥇 타이틀매치 — 리그를 넘는 네 개의 문</p>
        </div>
        <div className="px-4 py-3">
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            레벨 10·20·30·40은 다음 리그로 넘어가는 문입니다. 출석을 다 채워도 자동으로
            열리지 않고, <b className="text-foreground">직접 보여드리고 승인을 받아야</b> 넘어갑니다.
          </p>
          <div className="space-y-1.5">
            {rules.map((r) => (
              <div key={r.rank} className="flex items-center gap-2.5 rounded-lg bg-muted/30 px-3 py-2">
                <span className="number-font w-[52px] shrink-0 text-xs font-bold text-foreground">
                  레벨 {r.lastLevel}
                </span>
                <span className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                  {RANK_LABELS[r.rank] || r.rank} 마지막 관문
                </span>
                <span className="shrink-0 text-[11px] font-bold text-primary">{WHO[r.titleAuthority]}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
            위로 갈수록 승인하는 분이 달라집니다. 레벨 20을 넘으면 실제로 맞대는 스파링 구간이
            열리고, 레벨 30을 넘으면 다른 회원을 지도하는 리그에 들어가기 때문입니다.
          </p>
        </div>
      </div>

      {/* 패스트 트랙 — 오래 다니신 회원 */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
        <div className="border-b border-border px-4 py-2.5">
          <p className="text-xs font-bold text-foreground">⚡ 패스트 트랙 — 오래 다니신 회원</p>
        </div>
        <div className="px-4 py-3">
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            이미 오래 다니신 분께 1레벨부터 다시 밟게 하는 것은 맞지 않습니다. 그래서
            <b className="text-foreground"> 관문 직행권</b>을 드립니다. 타이틀매치를 통과하면
            다음 리그의 1레벨이 아니라 <b className="text-foreground">그 리그의 타이틀매치로 바로</b> 넘어갑니다.
          </p>
          <div className="space-y-1.5">
            {[
              { n: "직행권 2장", who: "누적 출석 80회 이상", what: "레벨 10 · 20 · 30 — 세 번의 도전" },
              { n: "직행권 1장", who: "재적 1년 이상 + 누적 출석 30회 이상", what: "레벨 10 · 20 — 두 번의 도전" },
            ].map((r) => (
              <div key={r.n} className="rounded-lg bg-muted/30 px-3 py-2">
                <p className="text-[11px] font-bold text-foreground">
                  {r.n} <span className="font-normal text-muted-foreground">— {r.who}</span>
                </p>
                <p className="mt-0.5 text-[10.5px] text-primary">{r.what}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
            기준을 <b className="text-foreground">기간이 아니라 출석</b>으로 잡은 이유가 있습니다.
            출석 80회는 정상 경로로 화이트(30회)와 블루(50회)를 통과하는 분량이라 그 자체가
            증명이 됩니다. 기간만 보면 129회 나오신 분이 82회 나오신 분보다 불리해지는
            역전이 생깁니다.
          </p>
          <p className="mt-2 rounded-lg bg-muted/40 px-2.5 py-2 text-[10.5px] font-semibold leading-relaxed text-foreground">
            직행권이 있어도 심사는 면제되지 않습니다. 타이틀매치 항목을 전부 보여주셔야 넘어가고,
            기준은 다른 회원과 완전히 같습니다.
          </p>
        </div>
      </div>

      {/* 심사에서 보는 것 */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <p className="mb-2 text-xs font-bold text-foreground">심사에서는 무엇을 보나요</p>
        <ul className="space-y-1.5">
          {[
            "그 레벨의 미션 동작을 하나씩 보여드립니다. 앱에서 미리 영상으로 볼 수 있습니다.",
            "항목을 전부 통과해야 승급됩니다. 하나라도 남으면 승인 버튼이 열리지 않습니다.",
            "부족한 항목이 있으면 '보완 요청'을 드립니다. 레벨이 내려가지는 않습니다.",
            "누가 어느 항목을 통과시켰는지 기록에 남습니다.",
          ].map((t, i) => (
            <li key={i} className="relative pl-3.5 text-[11px] leading-relaxed text-muted-foreground">
              <span className="absolute left-0 top-[7px] h-[3px] w-[3px] rounded-full bg-primary" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* 자주 묻는 것 */}
      <div className="space-y-2.5">
        {LEVELUP_FAQ.map((item, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
            <p className="mb-1.5 text-xs font-bold text-foreground">❓ {item.q}</p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{item.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const LEVELUP_FAQ = [
  {
    q: "오래 다녔는데 왜 바로 높은 레벨이 아닌가요?",
    a: "다닌 기간이 아니라 몸에 남은 기술로 기준을 잡습니다. 오래 다니신 분께는 앞 레벨을 건너뛰는 관문 직행권을 드리지만, 타이틀매치 자체는 똑같이 보십니다. 레벨을 올려드리는 것이 아니라 도전 기회를 앞으로 당겨드리는 것입니다.",
  },
  {
    q: "직행권을 쓰면 중간 레벨은 못 배우고 넘어가는 건가요?",
    a: "배울 내용이 사라지는 것은 아닙니다. 중간 레벨의 미션 영상은 앱에서 계속 볼 수 있고, 타이틀매치에서는 그 리그에서 쌓아야 할 동작을 통째로 확인합니다. 통과하지 못하면 보완 요청을 드리며, 레벨이 내려가지는 않습니다.",
  },
  {
    q: "출석을 몰아서 하면 빨리 올라가나요?",
    a: "화이트와 블루는 그렇습니다. 출석이 쌓인 만큼 레벨이 이어서 오릅니다. 레드부터는 출석만으로는 오르지 않고 반드시 심사를 거치며, 블랙은 레벨마다 최소 머무는 기간이 있어 몰아쳐도 건너뛸 수 없습니다.",
  },
  {
    q: "보완 요청을 받으면 떨어진 건가요?",
    a: "아닙니다. 레벨이 내려가지 않습니다. 부족한 항목만 더 연습해서 다시 보여주시면 됩니다. 그동안 통과한 항목은 그대로 남아 있습니다.",
  },
  {
    q: "심사는 따로 신청해야 하나요?",
    a: "아닙니다. 출석이 요건을 채우면 자동으로 심사함에 올라갑니다. 회원님이 누를 버튼은 없습니다.",
  },
  {
    q: "레벨이 오르면 무엇을 받나요?",
    a: "레벨이 오를 때마다 XP +50, 파이트 머니 +10이 들어옵니다. 리그를 넘으면 캐릭터에 쓸 수 있는 아이템이 함께 열립니다.",
  },
];

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
      <div key={card.title} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
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
          <div key={league} className="rounded-2xl border border-border bg-card shadow-elev-1 overflow-hidden">
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
                        <span className="rounded-full bg-reward/10 px-2 py-0.5 text-[9px] font-bold text-reward-foreground">🔓 {lv.unlockedBenefit}</span>
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
      <div key={ex.id} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
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
        <div className="rounded-xl bg-reward/5 border border-reward/10 px-3 py-2">
          <p className="text-[10px] font-bold text-reward-foreground mb-0.5">✅ 초보자 체크포인트</p>
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
