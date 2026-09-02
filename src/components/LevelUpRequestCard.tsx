// 레벨 진행 카드 — 출석 기반 자동 승급 (2026-09-02 개편).
//
// 얼굴 인식 출석이 레벨당 3회 쌓이면:
//   · 1~9레벨  → 자동 승급 (+50XP, 💎+10). 회원이 누를 버튼이 없다.
//   · 10레벨   → 코치 승인함에 자동 신청 (승급은 코치의 approve_level_review 만 가능)
// 이 카드는 그 진행을 보여주기만 한다. 신청 버튼은 폐지됐다.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLevelVideos, youtubeThumb, parseVideoTitle } from "@/hooks/useLevelVideos";

interface Cycle {
  sessions: number; days: number; minutes: number;
  reqSessions: number; reqDays: number; reqMinutes: number; meets: boolean;
}

const Bar = ({ label, cur, req, unit }: { label: string; cur: number; req: number; unit: string }) => {
  const pct = Math.min(100, Math.round((cur / Math.max(1, req)) * 100));
  const done = cur >= req;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{label}</span>
        <span className={done ? "font-bold text-status-complete" : "text-muted-foreground"}>
          {cur}/{req}{unit}{done ? " ✓" : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${done ? "bg-status-complete" : "bg-primary"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const LevelUpRequestCard = () => {
  const { user, progress } = useAuth();
  const navigate = useNavigate();

  const { data: cycle } = useQuery({
    queryKey: ["level-cycle", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as Cycle;
    },
  });

  // 현재 레벨 심사 상태 — 10레벨 자동 신청(pending)·보완 요청 표시용
  const { data: statusNow } = useQuery({
    queryKey: ["my-level-status", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: mp } = await supabase
        .from("member_progress")
        .select("current_rank, current_level")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!mp) return null;
      const m = mp as { current_rank: string; current_level: number };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("level_status")
        .select("status")
        .eq("user_id", user!.id)
        .eq("rank_name", m.current_rank)
        .eq("level_number", m.current_level)
        .maybeSingle();
      return (data?.status as string) ?? null;
    },
  });

  // 다음 레벨에서 배울 동작 미리보기 — 커리큘럼 영상(missions)이 있으면 2개까지
  const league = progress?.current_rank ?? "white";
  const nextLevel = Math.min(10, (progress?.current_level ?? 1) + 1);
  const { data: nextVideos = [] } = useLevelVideos(league, nextLevel);

  if (!cycle) return null;
  const isPending = statusNow === "pending";
  const isRevision = statusNow === "revision_requested";
  const isBossLevel = (progress?.current_level ?? 1) === 10;
  const previews = nextVideos.filter((v) => !!youtubeThumb(v.videoUrl)).slice(0, 2);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
      <p className="mb-1 text-sm font-black text-foreground">레벨업까지</p>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        {isBossLevel
          ? "보스 레벨! 출석 3회를 채우면 자동으로 승급 심사에 올라가고, 코치님이 승인하면 다음 리그로 갑니다."
          : "입구에서 얼굴 인식하면 출석이 자동으로 쌓여요. 출석 3회마다 자동으로 다음 레벨! (10레벨은 코치님 승인)"}
      </p>
      <Bar label="이번 레벨 출석" cur={cycle.sessions} req={cycle.reqSessions} unit="회" />

      {isRevision && (
        <p className="mt-3 rounded-lg bg-status-pending/10 px-3 py-2 text-[11px] font-semibold text-status-pending">
          ✏️ 코치님이 보완을 요청했어요. 더 연습하고 출석하면 자동으로 다시 심사에 올라갑니다.
        </p>
      )}

      {isPending ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-status-pending/10 py-3 text-sm font-bold text-status-pending">
          ⏳ 승급 심사 대기중 — 코치님 승인만 남았어요
        </div>
      ) : cycle.meets ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 text-sm font-bold text-primary">
          🥊 출석 3회 달성 — 자동으로 처리 중이에요!
        </div>
      ) : null}

      {/* 다음 레벨 미리보기 — 영상으로 다음에 배울 동작을 미리 본다 */}
      {!isBossLevel && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
            다음 레벨({nextLevel})에서 배울 동작
          </p>
          {previews.length > 0 ? (
            <div className="flex gap-2">
              {previews.map((v) => (
                <a
                  key={v.id}
                  href={v.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 flex-1 overflow-hidden rounded-xl border border-border active:scale-[0.98]"
                >
                  <div className="bg-black" style={{ aspectRatio: "16/9" }}>
                    <img src={youtubeThumb(v.videoUrl) ?? ""} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </div>
                  <p className="truncate px-2 py-1.5 text-[11px] font-bold text-foreground">
                    {parseVideoTitle(v.title).name}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-[11.5px] text-muted-foreground">
              이 레벨의 커리큘럼 영상이 준비 중이에요 — 라이브러리에서 내 리그 영상을 미리 봐도 좋아요.
            </p>
          )}
          <button
            onClick={() => navigate("/library")}
            className="mt-2 w-full rounded-xl bg-primary/10 py-2.5 text-center text-[12px] font-black text-primary active:opacity-80"
          >
            🌍 월드 복싱 라이브러리에서 더 보기 →
          </button>
        </div>
      )}

      <button onClick={() => navigate("/routines")} className="mt-2 w-full text-center text-[11px] font-semibold text-primary active:opacity-70">
        추천 수업 루틴 보기 →
      </button>
    </div>
  );
};

export default LevelUpRequestCard;
