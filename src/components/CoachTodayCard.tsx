// 🥊 오삼 코치의 오늘 지시 — 훈련 탭의 기본(심플) 화면.
// 회원은 여기서 "지금 눌러야 할 버튼 하나"만 보면 된다.
// 상태 판정 순서(위가 우선):
//   ① 심사 신청됨 → 대기 안내
//   ② 3·3·3 충족 → 레벨업 신청하기
//   ③ 오늘 체크인 안 함 → QR 체크인
//   ④ 오늘 영상 안 봄 → 오늘의 영상 보기
//   ⑤ 그 외 → 오늘 수업 시작(50분)
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QrCode, Play, Dumbbell, Trophy, Clock, ChevronRight, CheckCircle2 } from "lucide-react";
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

const localToday = () => new Date().toLocaleDateString("en-CA");

const CoachTodayCard = ({ league, levelNumber, levelTitle, onStartSession, onOpenDetail, onOpenVideos }: Props) => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [playing, setPlaying] = useState<{ id: string; url: string; title: string } | null>(null);
  const { data: videos = [] } = useLevelVideos(league, levelNumber);
  const { watched, toggle, countFor } = useWatchedVideos();

  // 3·3·3 진행도
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

  // 오늘 체크인 여부
  const { data: checkedInToday } = useQuery({
    queryKey: ["today-checkin", user?.id],
    enabled: !!user?.id && !!profile?.branch_name,
    staleTime: 60_000,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("attendance_logs").select("id")
        .eq("user_id", user!.id).eq("is_duplicate", false)
        .gte("checked_in_at", start.toISOString()).limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  // 심사 신청 상태
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

  // ── 오늘의 지시 결정 ──
  const step = (() => {
    if (reviewStatus === "pending") return "waiting" as const;
    if (cycle?.meets) return "levelup" as const;
    if (!checkedInToday) return "checkin" as const;
    if (nextVideo) return "video" as const;
    return "session" as const;
  })();

  const COACH_LINE: Record<typeof step, { title: string; body: string }> = {
    waiting: { title: "심사 신청했어요! 조금만 기다려요", body: "코치님이 자세를 확인하고 승인하면 레벨이 올라갑니다. 그동안 가볍게 복습해요." },
    levelup: { title: "축하해요! 레벨업 신청할 수 있어요", body: "출석·훈련 조건을 모두 채웠어요. 아래 버튼을 눌러 코치님께 심사를 신청하세요." },
    checkin: { title: "오늘은 QR 체크인부터 해요", body: "체육관에 오면 QR을 찍어야 오늘 훈련이 기록돼요. 이게 레벨업의 시작이에요." },
    video: { title: "오늘 볼 영상이 있어요", body: "관장님 영상을 먼저 보고 따라 하면 수업이 훨씬 쉬워져요. 딱 하나만 보면 됩니다." },
    session: { title: "오늘 50분 수업을 시작해요", body: "체크인도 했고 영상도 봤어요. 이제 몸으로 익힐 차례예요. 시작 버튼만 누르면 됩니다." },
  };
  const line = COACH_LINE[step];

  const c = cycle;
  const bar = (cur: number, req: number) => Math.min(100, Math.round((cur / Math.max(1, req)) * 100));

  return (
    <div className="space-y-3">
      {/* ── 오삼 코치 지시 카드 ── */}
      <div className="overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-b from-primary/10 to-card shadow-elev-1">
        <div className="flex items-center gap-3 px-4 pt-4">
          <img
            src="/assets/mascot/osami_smile.png"
            alt="오삼 코치"
            className="h-12 w-12 shrink-0 object-contain"
            onError={(e) => { e.currentTarget.style.display = "none"; }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-wide text-primary">오삼 코치</p>
            <p className="text-[15px] font-black leading-tight text-foreground">{line.title}</p>
          </div>
        </div>
        <p className="px-4 pt-2 text-[12px] leading-relaxed text-muted-foreground">{line.body}</p>

        {/* 오늘 볼 영상 미리보기 */}
        {step === "video" && nextVideo && (
          <button
            type="button"
            onClick={() => setPlaying({ id: nextVideo.id, url: nextVideo.videoUrl, title: nextVideo.title })}
            className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-border bg-card p-2.5 text-left active:scale-[0.99]"
          >
            <span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
              {youtubeThumb(nextVideo.videoUrl) && (
                <img src={youtubeThumb(nextVideo.videoUrl)!} alt="" className="h-full w-full object-cover" />
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Play className="h-5 w-5 fill-white text-white" />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-black text-foreground">{parseVideoTitle(nextVideo.title).name}</span>
              <span className="mt-0.5 block text-[10px] text-muted-foreground">영상 {doneCount}/{videos.length} 완료</span>
            </span>
          </button>
        )}

        {/* 메인 액션 버튼 — 화면에 항상 이 버튼 하나가 정답 */}
        <div className="p-4 pt-3">
          {step === "waiting" ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-status-pending/10 py-4 text-sm font-bold text-status-pending">
              <Clock className="h-4 w-4" /> 코치님 승인 대기 중
            </div>
          ) : step === "levelup" ? (
            <button
              onClick={() => requestReview.mutate()}
              disabled={requestReview.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-reward py-4 text-sm font-black text-reward-foreground shadow-elev-1 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              <Trophy className="h-5 w-5" /> 레벨업 신청하기
            </button>
          ) : step === "checkin" ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-primary/10 py-4 text-sm font-black text-primary">
              <QrCode className="h-5 w-5" /> 홈 화면에서 QR 체크인 하기
            </div>
          ) : step === "video" ? (
            <button
              onClick={() => (nextVideo ? setPlaying({ id: nextVideo.id, url: nextVideo.videoUrl, title: nextVideo.title }) : onOpenVideos())}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-black text-primary-foreground shadow-elev-1 transition-all active:scale-[0.98]"
            >
              <Play className="h-5 w-5 fill-current" /> 오늘의 영상 보기
            </button>
          ) : (
            <button
              onClick={onStartSession}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-black text-primary-foreground shadow-elev-1 transition-all active:scale-[0.98]"
            >
              <Dumbbell className="h-5 w-5" /> 오늘 수업 시작 (50분)
            </button>
          )}
        </div>
      </div>

      {/* ── 레벨업까지 남은 것 — 3칸 진행바 ── */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-black text-foreground">🏆 레벨업까지</p>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-secondary-foreground">
            {RANK_LABELS[league] || league} Lv.{levelNumber} · {levelTitle}
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
          조건을 채우면 코치님이 자세를 확인하고 승인해요 · 영상 {doneCount}/{videos.length} 시청
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
