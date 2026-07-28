// 🥊 오늘의 코스 — 훈련 탭 첫 화면.
// 오삼 코치가 오늘 할 일을 1·2·3 순서로 알려준다. 완료한 건 체크, 지금 할 건 강조.
// 회원이 원하면 "코스 접기"로 숨길 수 있다(기기에 기억).
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  QrCode, Play, Dumbbell, Trophy, Clock, ChevronRight, ChevronDown, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLevelVideos, useWatchedVideos, parseVideoTitle, youtubeThumb, youtubeId } from "@/hooks/useLevelVideos";
import { toast } from "sonner";
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

const CoachTodayCard = ({ league, levelNumber, levelTitle, onStartSession, onOpenDetail, onOpenVideos }: Props) => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [playing, setPlaying] = useState<{ id: string; url: string; title: string } | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COURSE_KEY) === "1");
  const { data: videos = [] } = useLevelVideos(league, levelNumber);
  const { watched, toggle, countFor } = useWatchedVideos();

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      localStorage.setItem(COURSE_KEY, v ? "0" : "1");
      return !v;
    });
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

  const { data: checkedInToday } = useQuery({
    queryKey: ["today-checkin", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      // method='qr' 만 인정 — 브로제이 출입(method='broj')은 라이브보드 표시용이고
      // XP 는 앱에서 QR 을 찍어야 지급되므로 1번 스텝 완료로 치지 않는다.
      const { data } = await supabase
        .from("attendance_logs").select("id")
        .eq("user_id", user!.id).eq("is_duplicate", false).eq("method", "qr")
        .gte("checked_in_at", start.toISOString()).limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  const { data: todaySession } = useQuery({
    queryKey: ["today-session-done", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("activity_sessions").select("id")
        .eq("user_id", user!.id).eq("status", "completed")
        .gte("started_at", start.toISOString()).limit(1);
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

  const requestReview = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.rpc as any)("request_level_review", {});
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-level-status"] });
      toast.success("레벨업 신청 완료 — 코치님 승인을 기다려주세요! 🎉");
    },
    onError: (e: any) => toast.error(e?.message || "신청 실패"),
  });

  const doneCount = countFor(videos.map((v) => v.id));
  const nextVideo = useMemo(() => videos.find((v) => !watched[v.id]) ?? null, [videos, watched]);
  const videoDone = videos.length > 0 && doneCount >= videos.length;
  const isPending = reviewStatus === "pending";
  const canLevelUp = !!cycle?.meets;

  // ── 오늘의 코스 3단계 ──
  const steps = [
    {
      n: 1,
      title: "체육관에서 QR 체크인",
      desc: "체크인해야 오늘 훈련이 기록돼요",
      icon: QrCode,
      done: !!checkedInToday,
      action: null as null | (() => void),
      actionLabel: "홈 화면 QR 버튼에서 스캔",
    },
    {
      n: 2,
      title: videos.length > 0 ? `오늘의 영상 보기 (${doneCount}/${videos.length})` : "오늘의 영상 보기",
      desc: nextVideo ? parseVideoTitle(nextVideo.title).name : "이번 레벨 영상을 모두 봤어요",
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

  const bar = (cur: number, req: number) => Math.min(100, Math.round((cur / Math.max(1, req)) * 100));
  const c = cycle;

  return (
    <div className="space-y-3">
      {/* ── 오삼 코치 헤더 ── */}
      <div className="overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-b from-primary/10 to-card shadow-elev-1">
        <div className="flex items-center gap-3 p-4">
          <img
            src="/assets/mascot/osami_smile.png"
            alt="오삼 코치"
            className="h-12 w-12 shrink-0 object-contain"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-wide text-primary">오삼 코치</p>
            <p className="text-[15px] font-black leading-tight text-foreground">
              {isPending ? "심사 신청 완료! 조금만 기다려요"
                : canLevelUp ? "조건 달성! 레벨업 신청하세요 🎉"
                : currentStep ? `오늘은 ${currentStep.n}번부터 하면 돼요`
                : "오늘 코스 완료! 잘하셨어요 👏"}
            </p>
          </div>
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "코스 펼치기" : "코스 접기"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`} />
          </button>
        </div>

        {/* ── 오늘의 코스 1·2·3 ── */}
        {!collapsed && (
          <div className="space-y-2 px-4 pb-4">
            {steps.map((s) => {
              const isCurrent = currentStep?.n === s.n && !isPending && !canLevelUp;
              const Icon = s.icon;
              return (
                <div
                  key={s.n}
                  className={`rounded-2xl border p-3 transition-all ${
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
                      <p className={`text-[13px] font-black ${s.done ? "text-status-complete" : "text-foreground"}`}>
                        {s.title}
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
              <button
                onClick={() => requestReview.mutate()}
                disabled={requestReview.isPending}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-reward py-3.5 text-[13px] font-black text-reward-foreground shadow-elev-1 active:scale-[0.98] disabled:opacity-60"
              >
                <Trophy className="h-4 w-4" /> 레벨업 신청하기
              </button>
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
    </div>
  );
};

export default CoachTodayCard;
