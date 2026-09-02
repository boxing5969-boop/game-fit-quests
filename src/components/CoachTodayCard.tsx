// 🥊 오늘의 코스 — 훈련 탭 첫 화면.
// 오삼 코치가 오늘 할 일을 1·2·3 순서로 알려준다. 완료한 건 체크, 지금 할 건 강조.
// 회원이 원하면 "코스 접기"로 숨길 수 있다(기기에 기억).
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScanFace, Play, Dumbbell, Trophy, Clock, ChevronRight, ChevronDown, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLevelVideos, useWatchedVideos, parseVideoTitle, youtubeId } from "@/hooks/useLevelVideos";
import { RANK_LABELS } from "@/data/sharedConstants";

interface Cycle {
  sessions: number; days: number; minutes: number;
  reqSessions: number; reqDays: number; reqMinutes: number; meets: boolean;
}

interface Props {
  league: string;
  levelNumber: number;
  levelTitle: string;
  onStartSession: () => void;
  onOpenDetail: () => void;
  onOpenVideos: () => void;
}

const COURSE_KEY = "153_course_collapsed";

// 홈 화면과 같은 QR 스캐너를 재사용한다(새로 만들지 않는다).
// QR 체크인은 폐지 — 출석은 입구 얼굴 인식으로 자동 기록된다 (2026-09-02).

// KST 자정 (기기 타임존과 무관) — 해외폰에서도 '오늘' 판정이 체육관 기준과 일치해야 한다.
const kstDayStartIso = () => {
  const kstMs = Date.now() + 9 * 3600 * 1000;
  return new Date(Math.floor(kstMs / 86400000) * 86400000 - 9 * 3600 * 1000).toISOString();
};

const safeGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* 프라이빗 모드 등 */ } };

const CoachTodayCard = ({ league, levelNumber, levelTitle, onStartSession, onOpenDetail, onOpenVideos }: Props) => {
  const { user } = useAuth();
  const [playing, setPlaying] = useState<{ id: string; url: string; title: string } | null>(null);
  const [collapsed, setCollapsed] = useState(() => safeGet(COURSE_KEY) === "1");
  const { data: videos = [], isFetched: videosFetched } = useLevelVideos(league, levelNumber);
  const { watched, toggle, countFor } = useWatchedVideos();

  const toggleCollapsed = () => {
    safeSet(COURSE_KEY, collapsed ? "0" : "1");
    setCollapsed((v) => !v);
  };

  const { data: cycle } = useQuery({
    queryKey: ["level-cycle", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async (): Promise<Cycle> => {
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as Cycle;
    },
  });

  const { data: checkedInToday, isFetched: checkinFetched } = useQuery({
    queryKey: ["today-checkin", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnMount: "always", // 홈에서 QR 찍고 넘어와도 즉시 최신 (탭 재진입 시 항상 재조회)
    queryFn: async () => {
      // 출석은 수단을 가리지 않는다 — 얼굴 인식(broj)이 정식 출석이다 (2026-09-02 개편).
      const { data } = await supabase
        .from("attendance_logs").select("id")
        .eq("user_id", user!.id).eq("is_duplicate", false)
        .gte("checked_in_at", kstDayStartIso()).limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  // 브로제이(얼굴인식) 출입 — 문을 통과하면 QR 없이도 "도착"으로 인정해 표시한다.
  // XP 는 여기서 주지 않는다. QR 을 찍어야 받는다(checkedInToday).
  const { data: arrivedAt } = useQuery({
    queryKey: ["today-arrival", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnMount: "always", // 홈에서 QR 찍고 넘어와도 즉시 최신 (탭 재진입 시 항상 재조회)
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from("attendance_logs").select("checked_in_at")
        .eq("user_id", user!.id).eq("method", "broj")
        .gte("checked_in_at", kstDayStartIso())
        .order("checked_in_at", { ascending: true }).limit(1);
      return data?.[0]?.checked_in_at ?? null;
    },
  });

  const { data: todaySession, isFetched: sessionFetched } = useQuery({
    queryKey: ["today-session-done", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnMount: "always", // 홈에서 QR 찍고 넘어와도 즉시 최신 (탭 재진입 시 항상 재조회)
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_sessions").select("id")
        .eq("user_id", user!.id).eq("status", "completed")
        .gte("started_at", kstDayStartIso()).limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  const { data: reviewStatus } = useQuery({
    queryKey: ["my-level-status", user?.id, league, levelNumber],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("level_status").select("status")
        .eq("user_id", user!.id).eq("rank_name", league).eq("level_number", levelNumber)
        .maybeSingle();
      return (data?.status as string) ?? null;
    },
  });

  const doneCount = countFor(videos.map((v) => v.id));
  const nextVideo = useMemo(() => videos.find((v) => !watched[v.id]) ?? null, [videos, watched]);
  // 영상이 없는 레벨(블루·레드·블랙 다수)은 2번 스텝을 완료로 간주 — 교착 방지.
  // videosFetched 전에는 미완료로 두어 로딩 플래시를 막는다.
  const videoDone = videosFetched && (videos.length === 0 || doneCount >= videos.length);
  const isPending = reviewStatus === "pending";
  const canLevelUp = !!cycle?.meets;

  // 브로제이 도착 시각 (오후 7:12 형태)
  const arrivalLabel = arrivedAt
    ? new Date(arrivedAt).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit" })
    : null;

  // ── 오늘의 코스 3단계 ──
  const steps = [
    {
      n: 1,
      title: "체육관 도착 (자동 출석)",
      desc: checkedInToday
        ? (arrivalLabel ? `${arrivalLabel} 입장 · 출석 완료` : "출석 완료")
        : "입구에서 얼굴 인식하면 자동으로 출석돼요",
      icon: ScanFace,
      done: !!checkedInToday,
      action: null as null | (() => void),
      actionLabel: "",
    },
    {
      n: 2,
      title: videos.length > 0 ? `오늘의 영상 보기 (${doneCount}/${videos.length})` : "오늘의 영상 보기",
      desc: nextVideo
        ? parseVideoTitle(nextVideo.title).name
        : videos.length === 0
          ? "이 레벨은 영상 없이 진행해요"
          : "이번 레벨 영상을 모두 봤어요",
      icon: Play,
      done: videoDone,
      action: () => (nextVideo ? setPlaying({ id: nextVideo.id, url: nextVideo.videoUrl, title: nextVideo.title }) : onOpenVideos()),
      actionLabel: "영상 보기",
    },
    {
      n: 3,
      title: "50분 수업하기",
      desc: "영상에서 본 동작을 몸으로 익혀요",
      icon: Dumbbell,
      done: !!todaySession,
      action: onStartSession,
      actionLabel: "수업 시작",
    },
  ];
  const currentStep = steps.find((s) => !s.done) ?? null;
  const doneSteps = steps.filter((s) => s.done).length;

  // 상황별 오삼 코치 표정 + 한마디 (듀오링고식 말풍선)
  const coach = isPending
    ? { face: "osami_shy", line: "심사 신청 완료! 조금만 기다려요" }
    : canLevelUp
      ? { face: "osami_victory", line: "출석 다 채웠어요! 곧 자동 처리돼요" }
      : !currentStep
        ? { face: "osami_happy", line: "오늘 코스 완료! 잘하셨어요" }
        : doneSteps === 0
          ? { face: "osami_smile", line: "오늘도 시작해볼까요? 1번부터예요" }
          : doneSteps === steps.length - 1
            ? { face: "osami_determined", line: `${currentStep.n}번만 하면 오늘 끝이에요` }
            : { face: "osami_determined", line: `잘하고 있어요! 다음은 ${currentStep.n}번이에요` };

  // ── 캐릭터 모션 ──
  // 등장(emote-enter 0.7s) → 끝나면 상시 대기(emote-idle 무한). 표정이 바뀌면 다시 등장.
  // 오늘 코스를 방금 다 끝냈으면 축하 펀치를 한 번 친다.
  const coachFace = coach.face;
  const [entered, setEntered] = useState(false);
  const prevDone = useRef(doneSteps);
  const [cheer, setCheer] = useState(false);

  useEffect(() => {
    setEntered(false);
    const t = setTimeout(() => setEntered(true), 700);
    return () => clearTimeout(t);
  }, [coachFace]);

  const queriesReady = checkinFetched && videosFetched && sessionFetched;
  useEffect(() => {
    // 콜드 로드(이미 완료한 날 재접속)에서는 축하 펀치를 치지 않는다 —
    // 쿼리가 다 도착하기 전 doneSteps 0→3 점프는 '방금 완료'가 아니다.
    if (!queriesReady) {
      prevDone.current = doneSteps;
      return;
    }
    if (doneSteps > prevDone.current && doneSteps === steps.length) {
      setCheer(true);
      const t = setTimeout(() => setCheer(false), 700);
      prevDone.current = doneSteps;
      return () => clearTimeout(t);
    }
    prevDone.current = doneSteps;
    setCheer(false);
  }, [doneSteps, steps.length, queriesReady]);

  // 바깥 span = 등장 → 주기적 점프(또는 축하 펀치). 안쪽 img = 상시 둥실.
  const coachMotion = cheer
    ? "animate-emote-punch"
    : entered
      ? "animate-coach-hop"
      : "animate-emote-enter";

  const bar = (cur: number, req: number) => Math.min(100, Math.round((cur / Math.max(1, req)) * 100));
  const c = cycle;

  return (
    <div className="space-y-3">
      {/* ── 오삼 코치 헤더 (말풍선) ── */}
      <div className="overflow-hidden rounded-3xl border-2 border-primary/30 bg-card shadow-elev-1">
        <button
          onClick={toggleCollapsed}
          aria-label={collapsed ? "오늘의 코스 펼치기" : "오늘의 코스 접기"}
          aria-expanded={!collapsed}
          className="flex w-full items-start gap-2.5 p-4 text-left active:scale-[0.99]"
        >
          {/* key 를 표정에 걸어 표정이 바뀌면 등장 모션을 다시 재생한다 */}
          <span key={coachFace} className={`shrink-0 ${coachMotion}`}>
            <img
              src={`/assets/mascot/${coachFace}.png`}
              alt=""
              aria-hidden="true"
              className={`object-contain ${entered && !cheer ? "animate-coach-float" : ""} ${collapsed ? "h-10 w-10" : "h-[72px] w-[72px]"}`}
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          </span>
          {/* 말풍선 — 왼쪽에 꼬리. 캐릭터가 뛰어든 뒤 0.28s 후 톡 열린다 */}
          <div
            key={`${coachFace}-bubble`}
            className="animate-coach-bubble relative min-w-0 flex-1 rounded-2xl border border-border bg-muted/40 px-3 py-2.5"
          >
            <span className="absolute -left-[5px] top-5 h-2.5 w-2.5 rotate-45 border-b border-l border-border bg-muted/40" />
            <p className="text-[11px] font-black tracking-wide text-primary">오삼 코치</p>
            <p className="mt-0.5 text-[15px] font-black leading-snug text-foreground">{coach.line}</p>
          </div>
          <ChevronDown
            className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${collapsed ? "" : "rotate-180"}`}
          />
        </button>

        {/* ── 오늘의 코스 1·2·3 ── */}
        {!collapsed && (
          <div className="space-y-2 px-4 pb-4">
            {/* 오늘 진행도 */}
            <div className="mb-1 flex items-center gap-2.5">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-status-complete transition-all duration-500"
                  style={{ width: `${(doneSteps / steps.length) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-black text-muted-foreground">{doneSteps}/{steps.length}</span>
            </div>
            {steps.map((s) => {
              const isCurrent = currentStep?.n === s.n; // 심사 대기·레벨업 가능 중에도 일일 코스 버튼은 유지
              const Icon = s.icon;
              return (
                <div
                  key={s.n}
                  style={{ animationDelay: `${0.34 + s.n * 0.07}s` }}
                  className={`animate-coach-step rounded-2xl border p-3 transition-colors ${
                    s.done
                      ? "border-status-complete/30 bg-status-complete/5"
                      : isCurrent
                        ? "border-primary bg-card shadow-elev-1"
                        : "border-border bg-card opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                        s.done
                          ? "bg-status-complete text-white"
                          : isCurrent
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s.done ? <CheckCircle2 className="h-5 w-5" /> : s.n}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`flex items-center gap-1.5 text-[13px] font-black ${s.done ? "text-status-complete" : "text-foreground"}`}>
                        {s.title}
                        {/* 얼굴인식으로 이미 들어온 상태 — QR 만 남았다는 표시 */}
                        {s.n === 1 && !!arrivalLabel && !s.done && (
                          <span className="rounded-full bg-status-complete/15 px-1.5 py-0.5 text-[10px] font-black text-status-complete">
                            도착 확인
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.desc}</p>
                    </div>
                    <Icon className={`h-4 w-4 shrink-0 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                  </div>

                  {/* 지금 할 단계만 큰 버튼 노출 */}
                  {isCurrent && (
                    s.action ? (
                      <button
                        onClick={s.action}
                        className="mt-2.5 w-full rounded-xl bg-primary py-3 text-[13px] font-black text-primary-foreground transition-all active:scale-[0.98]"
                      >
                        {s.actionLabel}
                      </button>
                    ) : (
                      <p className="mt-2.5 rounded-xl bg-primary/10 py-2.5 text-center text-[12px] font-bold text-primary">
                        {s.actionLabel}
                      </p>
                    )
                  )}
                </div>
              );
            })}

            {/* 레벨업 신청 / 대기 */}
            {isPending ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-status-pending/10 py-3.5 text-[13px] font-bold text-status-pending">
                <Clock className="h-4 w-4" /> 코치님 승인 대기 중
              </div>
            ) : canLevelUp ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-reward/10 py-3.5 text-[13px] font-black text-reward">
                <Trophy className="h-4 w-4" /> 출석 3회 달성 — 자동으로 처리 중이에요!
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* ── 레벨업까지 ── */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-foreground">🏆 레벨업까지</p>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
            {RANK_LABELS[league] || league} Lv.{levelNumber}{levelTitle ? ` · ${levelTitle}` : ""}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "출석", cur: c?.sessions ?? 0, req: c?.reqSessions ?? 3, unit: "회" },
            { label: "다른 날", cur: c?.days ?? 0, req: c?.reqDays ?? 3, unit: "일" },
            { label: "훈련", cur: c?.minutes ?? 0, req: c?.reqMinutes ?? 180, unit: "분" },
          ].map((m) => {
            const done = m.cur >= m.req;
            return (
              <div key={m.label} className="rounded-xl bg-muted/30 p-2.5 text-center">
                <p className={`number-font text-base font-black ${done ? "text-status-complete" : "text-foreground"}`}>
                  {m.cur}
                  <span className="text-[10px] text-muted-foreground">/{m.req}{m.unit}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{m.label}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${done ? "bg-status-complete" : "bg-primary"}`}
                    style={{ width: `${bar(m.cur, m.req)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          조건을 채우면 코치님이 자세를 확인하고 승인해요
        </p>
      </div>

      {/* ── 상세보기 ── */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-all active:scale-[0.99]"
      >
        <span>
          <span className="block text-sm font-black text-foreground">📚 훈련 상세 보기</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            영상 전체 · 교육 그림 · 50분 수업 구성 · 심사 기준
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </button>

      {/* 영상 재생 모달 */}
      {playing && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 p-4" onClick={() => setPlaying(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            {youtubeId(playing.url) ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId(playing.url)}?autoplay=1&rel=0&playsinline=1`}
                title={playing.title}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full rounded-2xl bg-black"
              />
            ) : (
              <video src={playing.url} controls autoPlay playsInline className="aspect-video w-full rounded-2xl bg-black" />
            )}
            <button
              type="button"
              onClick={() => { toggle(playing.id); setPlaying(null); }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground active:scale-[0.98]"
            >
              <CheckCircle2 className="h-4 w-4" /> 따라했어요
            </button>
          </div>
        </div>
      )}

      {/* QR 체크인 — 홈 화면과 같은 스캐너·같은 qr-checkin 경로를 그대로 쓴다.
          XP 지급·중복 판정은 전부 Edge Function 이 하고, 여기서는 결과만 반영한다. */}
    </div>
  );
};

export default CoachTodayCard;
