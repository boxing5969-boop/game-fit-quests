/**
 * 153마인드셋 — 시각화 훈련 첫 화면 (2026-10-19 전면 개편)
 *
 * 대표님: "시각화 훈련 지금은 퀄리티가 안 좋은 것 같아. 성공한 시각화 프로그램·앱을 벤치마킹해서 경쟁이 될 정도로 업그레이드하고
 *          차별화 기능도 만들자."
 *
 *   · 이번 주 목표(3번) 고리 · 연속 일수 · 총 시간 · 또렷함 변화 — 계정에 남는 기록(get_my_mindset_stats)
 *   · 오늘의 추천 — 시간대 · 오늘 했는지 · 153 PB 기록
 *   · 세션 8개(운동 전 · 기술 · 스파링 · 153 PB · 다시 일어서기 · 호흡 · 운동 후 · 미래의 나)
 *   · 내 목표 한 문장 · 나의 한마디 — 대본에 들어간다
 *   튜토리얼(Day 4) 표식: mindset-session-picker · mindset-intro · mindset-session-list · mindset-session-card
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Flame, Play, Timer } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import MyBoxerVisualizationSession from "@/features/myboxer-visualization/MyBoxerVisualizationSession";
import {
  CATEGORY_LABEL,
  MIND_SESSIONS,
  recommendSession,
  type MindCategory,
  type MindSession,
} from "@/features/myboxer-visualization/visualizationContent";
import { estimateMinutes, type MindVars } from "@/features/myboxer-visualization/useMindPlayer";
import { useMindsetStats, useSaveMindsetProfile } from "@/services/mindsetService";
import { fetchTest153Summary } from "@/services/test153Service";

const CATEGORY_ORDER: MindCategory[] = ["pre", "skill", "fight", "pb", "reset", "breath", "recover", "future"];
const CUE_PRESETS = ["가드 업", "한 번 더", "숨부터", "내 리듬", "끝까지"];
const WEEK_GOAL = 3;

/** 18분 42초 (목소리로 읽기 좋게 — 0.1초는 뺀다) */
const spokenTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m}분 ${s}초` : `${m}분`;
};

const MyBoxerVisualizationPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [active, setActive] = useState<MindSession | null>(null);
  const { data: stats } = useMindsetStats();

  const { data: pbSummary } = useQuery({
    queryKey: ["test153", "summary", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: () => fetchTest153Summary(),
  });

  const vars: MindVars = useMemo(() => {
    // 완주한 기록만 PB — 오픈에서 시간 초과로 못 끝낸 기록보다 스타터 완주 기록을 쓴다 (2026-10-19 검수)
    const open = pbSummary?.best.open;
    const starter = pbSummary?.best.starter;
    const best = open?.finished ? open : starter?.finished ? starter : null;
    return {
      goal: stats?.goal ?? null,
      cue: stats?.cue ?? null,
      pb: best ? spokenTime(best.score_ms) : null,
      pbGoal: best ? spokenTime(best.score_ms - 1000) : null,
      division: best ? (best === open ? "오픈" : "스타터") : null,
    };
  }, [pbSummary, stats?.goal, stats?.cue]);

  // 바로 들어온 경우(새 창 · 링크)에는 홈으로 — 앱 밖으로 나가지 않게 (SearchPage 와 같은 방식)
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  const pick = useMemo(
    () =>
      recommendSession({
        hour: new Date().getHours(),
        hasPb: !!vars.pb,
        doneToday: !!stats?.done_today,
        lastIds: (stats?.recent ?? []).map((r) => r.session_id),
      }),
    [vars.pb, stats?.done_today, stats?.recent],
  );

  if (active) {
    return <MyBoxerVisualizationSession key={active.id} session={active} vars={vars} onClose={() => setActive(null)} />;
  }

  const week = stats?.week_count ?? 0;
  const R = 30;
  const C = 2 * Math.PI * R;

  return (
    <div
      data-tour="mindset-session-picker"
      className="relative min-h-dvh w-full overflow-hidden text-amber-50"
      style={{ background: "linear-gradient(180deg, #070b1a 0%, #0c1328 55%, #070b1a 100%)" }}
    >
      {/* 빛 번짐은 화면 크기 칸 안에서만 — 바깥 상자가 옆·위로 밀린 채 굳지 않게 (2026-10-19 검수) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className="absolute -top-36 left-1/2 h-[440px] w-[440px] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, #fdb85c 0%, transparent 70%)" }}
        />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 mx-auto w-full max-w-md space-y-6 px-5 pb-28 pt-6"
      >
        {/* 머리 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="뒤로"
            className="rounded-full border border-amber-200/15 bg-black/30 p-2 text-amber-100/70 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.45em] text-amber-300/70">MYBOXER 153</p>
            <h1 className="text-[26px] font-black leading-tight">153마인드셋</h1>
          </div>
        </div>

        <div data-tour="mindset-intro" className="rounded-2xl border-l-2 border-amber-400/70 bg-amber-500/5 px-4 py-3">
          <p className="text-[13px] font-bold leading-relaxed text-amber-50/90">
            눈을 감고 귀로 듣는 복서의 시각화 훈련.
            <br />
            머릿속에서 먼저 한 라운드 — 몸은 그 길을 기억합니다.
          </p>
        </div>

        {/* 이번 주 */}
        <div className="flex items-center gap-4 rounded-3xl border border-amber-200/10 bg-black/30 p-4">
          <div className="relative h-[76px] w-[76px] shrink-0">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 76 76" aria-hidden>
              <circle cx="38" cy="38" r={R} fill="none" stroke="rgba(253,230,138,0.12)" strokeWidth="6" />
              <circle
                cx="38"
                cy="38"
                r={R}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - Math.min(1, week / WEEK_GOAL))}
                style={{ transition: "stroke-dashoffset 0.8s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-black tabular-nums leading-none">
                {week}
                <span className="text-[11px] text-amber-200/50">/{WEEK_GOAL}</span>
              </span>
              <span className="text-[9px] font-bold text-amber-200/55">이번 주</span>
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="text-[13.5px] font-bold">
              {week >= WEEK_GOAL ? "이번 주 목표 달성! 잘하고 있어요" : `일주일에 ${WEEK_GOAL}번이면 충분해요`}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-amber-200/65">
              {(stats?.streak ?? 0) >= 2 && (
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  {stats!.streak}일 연속
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" />총 {stats?.total_minutes ?? 0}분 · {stats?.total_sessions ?? 0}번
              </span>
              {stats && stats.rated >= 6 && stats.vivid_first > 0 && (
                <span>
                  또렷함 {stats.vivid_first.toFixed(1)} → {stats.vivid_recent.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 오늘의 추천 */}
        <button
          type="button"
          onClick={() => setActive(pick)}
          className="group relative w-full overflow-hidden rounded-3xl p-5 text-left active:scale-[0.99]"
          style={{ background: `linear-gradient(135deg, ${pick.tint[0]}33 0%, ${pick.tint[1]}26 60%, rgba(0,0,0,0.35) 100%)` }}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-60 blur-2xl"
            style={{ background: `radial-gradient(circle, ${pick.tint[0]} 0%, transparent 70%)` }}
            aria-hidden
          />
          <p className="relative text-[11.5px] font-black tracking-wide text-amber-200/85">오늘의 추천</p>
          <h2 className="relative mt-1.5 text-[22px] font-black leading-tight">{pick.title}</h2>
          <p className="relative mt-1 text-[12.5px] leading-relaxed text-amber-50/80">{pick.tagline}</p>
          <div className="relative mt-4 flex items-center justify-between">
            <span className="text-[11.5px] text-amber-200/65">
              약 {estimateMinutes(pick.variants?.[0]?.cues ?? pick.cues, vars)}분 · {CATEGORY_LABEL[pick.category]}
            </span>
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full text-[#1a1206] shadow-[0_0_20px_rgba(253,184,92,0.4)]"
              style={{ background: "linear-gradient(135deg, #fde68a, #f59e0b)" }}
            >
              <Play className="ml-0.5 h-5 w-5" />
            </span>
          </div>
        </button>

        {/* 세션 목록 */}
        <div data-tour="mindset-session-list" className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const list = MIND_SESSIONS.filter((m) => m.category === cat);
            if (!list.length) return null;
            return (
              <div key={cat} className="space-y-2">
                <p className="px-1 text-[12px] font-black text-amber-200/60">{CATEGORY_LABEL[cat]}</p>
                {list.map((m) => (
                  <SessionCard
                    key={m.id}
                    session={m}
                    vars={vars}
                    count={stats?.by_session?.[m.id] ?? 0}
                    tour={m.id === "myboxer-153-returned-person"}
                    onOpen={() => setActive(m)}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* 기록을 불러온 뒤에 그린다 — 빈 칸으로 먼저 열려서 저장된 목표를 지우지 않게 (2026-10-19 검수) */}
        {stats && <GoalCard key={`${stats.goal ?? ""}|${stats.cue ?? ""}`} goal={stats.goal ?? null} cue={stats.cue ?? null} />}

        <p className="pb-2 text-center text-[11px] leading-relaxed text-amber-200/45">
          이어폰을 끼고, 눈을 감고 들으면 가장 좋아요.
          <br />
          기록은 내 계정에 남고 나만 볼 수 있어요.
        </p>
      </motion.section>
    </div>
  );
};

function SessionCard({
  session,
  vars,
  count,
  tour,
  onOpen,
}: {
  session: MindSession;
  vars: MindVars;
  count: number;
  tour: boolean;
  onOpen: () => void;
}) {
  const lengths = session.variants
    ? session.variants.map((v) => `${estimateMinutes(v.cues, vars)}분`).join(" · ")
    : `${estimateMinutes(session.cues, vars)}분`;
  return (
    <button
      type="button"
      data-tour={tour ? "mindset-session-card" : undefined}
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-amber-200/10 bg-black/30 p-3.5 text-left transition-colors active:scale-[0.99]"
    >
      <span
        className="h-12 w-12 shrink-0 rounded-2xl"
        style={{
          background: `radial-gradient(circle at 35% 30%, #fff7e6 0%, ${session.tint[0]} 45%, ${session.tint[1]} 100%)`,
          boxShadow: `0 0 18px ${session.tint[0]}55`,
        }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-black">{session.title}</span>
        <span className="mt-0.5 block text-[11.5px] leading-snug text-amber-100/60">{session.tagline}</span>
        <span className="mt-1 block text-[11px] text-amber-200/50">
          {lengths}
          {count > 0 ? ` · ${count}번 했어요` : ""}
        </span>
      </span>
      <Play className="h-4 w-4 shrink-0 text-amber-300/70" />
    </button>
  );
}

function GoalCard({ goal, cue }: { goal: string | null; cue: string | null }) {
  const save = useSaveMindsetProfile();
  const [g, setG] = useState(goal ?? "");
  const [c, setC] = useState(cue ?? "");
  const [editing, setEditing] = useState(!goal && !cue);
  const dirty = g.trim() !== (goal ?? "") || c.trim() !== (cue ?? "");

  const onSave = async () => {
    const res = await save.mutateAsync({ goal: g, cue: c });
    if (res.synced) toast.success("저장했어요. 다음 세션부터 대본에 들어가요");
    else toast("이 기기에 먼저 저장했어요. 인터넷이 되면 계정에도 올라가요");
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setG(goal ?? "");
          setC(cue ?? "");
          setEditing(true);
        }}
        className="w-full rounded-3xl border border-amber-200/10 bg-black/30 p-4 text-left active:scale-[0.99]"
      >
        <p className="text-[12px] font-black text-amber-200/60">내 목표 · 나의 한마디</p>
        <p className="mt-1.5 text-[15px] font-black leading-snug">{goal || "목표를 적어 주세요"}</p>
        {cue && <p className="mt-1 text-[12.5px] font-bold text-amber-300">“{cue}”</p>}
        <p className="mt-2 text-[11px] text-amber-200/45">눌러서 바꾸기 · 세션 대본에 이 말이 들어가요</p>
      </button>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-amber-200/15 bg-black/35 p-4">
      <div>
        <p className="text-[13px] font-bold">내 목표 한 문장</p>
        <p className="text-[11px] text-amber-200/55">세션 중에 이 문장을 읽어 줘요</p>
        <input
          value={g}
          onChange={(e) => setG(e.target.value.slice(0, 60))}
          placeholder="예) 올해 안에 블루리그 가기"
          className="mt-2 h-11 w-full rounded-xl border border-amber-200/15 bg-black/40 px-3 text-[14px] text-amber-50 placeholder:text-amber-200/30 focus:border-amber-300/60 focus:outline-none"
        />
      </div>
      <div>
        <p className="text-[13px] font-bold">나의 한마디</p>
        <p className="text-[11px] text-amber-200/55">힘들 때 꺼내는 짧은 말 — 세션 끝에 마음에 새겨요</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CUE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setC(p)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-bold",
                c === p ? "border-amber-300/70 bg-amber-400/15 text-amber-50" : "border-amber-200/10 text-amber-100/60",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={c}
          onChange={(e) => setC(e.target.value.slice(0, 20))}
          placeholder="직접 적어도 돼요 (20자)"
          className="mt-2 h-10 w-full rounded-xl border border-amber-200/15 bg-black/40 px-3 text-[13px] text-amber-50 placeholder:text-amber-200/30 focus:border-amber-300/60 focus:outline-none"
        />
      </div>
      <div className="flex gap-2">
        {(goal || cue) && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-11 flex-1 rounded-xl border border-amber-200/15 text-[13px] font-bold text-amber-100/70"
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={save.isPending || (!dirty && !!(goal || cue))}
          className="flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-xl text-[14px] font-black text-[#1a1206] disabled:opacity-50"
          style={{ background: "linear-gradient(90deg, #fbbf24, #f59e0b)" }}
        >
          <Check className="h-4 w-4" />
          저장
        </button>
      </div>
    </div>
  );
}

export default MyBoxerVisualizationPage;
