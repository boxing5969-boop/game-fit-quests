// 레벨업까지 — 훈련 탭 첫 화면(오늘의 코스 아래)과 레벨 자세히 보기 '심사' 탭이 같이 쓴다.
// (2026-10-28 리디자인) 주인공 = '몇 번 더' 한 줄 · 막대 하나 · 숫자 한 줄 · 세는 규칙은 ? 안에.
//
// 얼굴 인식 출석이 리그 요건(화이트3·블루5·레드8·블랙20회)만큼 쌓이면 (판정은 서버 get_level_cycle_progress.meets):
//   · 화이트·블루 1~9레벨 → 자동 승급. 회원이 누를 버튼이 없다.
//   · 레드·블랙          → 승급 심사함에 자동 신청 (출석만으로는 절대 안 올라간다)
//   · 10레벨             → 코치 승인함에 자동 신청 (승급은 코치의 approve_level_review 만 가능)
//   · 블랙               → 레벨마다 최소 45일 연한까지 채워야 한다
//   · 화이트 레벨 10(타이틀매치 신청 흐름, 2026-10-14) → 출석 막대 대신 '타이틀미션 · 심사 신청' — 회원이 파트너와 연습한 뒤
//     타이틀매치 화면에서 지점장님께 심사를 신청하고, 지점장님이 영상으로 심사한다 (도전 3번).
// '다른 날'은 출석(하루 한 번만 센다)과 같은 숫자라 따로 쓰지 않는다. 서버 reqMinutes 는 늘 0 이라 훈련 분도 없다.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CircleHelp, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLevelVideos, youtubeThumb, parseVideoTitle } from "@/hooks/useLevelVideos";
import { isTitleFlowFor, titleMatchLink } from "@/lib/titleMatchChallenge";
import { useLevelupRules } from "@/hooks/useLevelupRules";
import { authorityLabel } from "@/lib/levelAuthority";
import { toGlobalLevel } from "@/lib/rankLabels";
import { RANK_LABELS } from "@/data/sharedConstants";

interface Cycle {
  sessions: number; days: number; minutes: number;
  /** 승급 진행량 내림값 (출석 1회 = 1, 운동시간 보너스 포함) — 판정(meets)과 같은 숫자 */
  progressFloor?: number;
  reqSessions: number; reqDays: number; reqMinutes: number; meets: boolean;
  // 리그별 차등 요건 — 화이트3 / 블루5 / 레드8 / 블랙20회, 블랙은 레벨당 최소 45일 체류
  reqMinDays?: number; elapsedDays?: number; rank?: string;
  /** 이 리그가 출석만으로 올라가는지 (화이트·블루) — 서버 level_auto_advances */
  autoAdvances?: boolean;
  // 패스트 트랙 직행권 — 1 이상이면 타이틀매치를 통과할 때 다음 리그의 1레벨이 아니라
  // 그 리그의 타이틀매치로 바로 간다 (오래 다니신 회원 예우, 2026-09-17 대표님 결정)
  fastTrackGates?: number;
}

const RANK_ORDER = ["white", "blue", "red", "black"];

interface Props {
  /** 타이틀매치 신청 단추 — 훈련 탭 첫 화면은 오늘의 코스에 같은 단추가 있어 끈다 */
  titleButton?: boolean;
  /** 다음 레벨에서 배울 동작 미리보기 칸 (심사 탭) */
  preview?: boolean;
}

const LevelUpRequestCard = ({ titleButton = true, preview = false }: Props) => {
  const { user, progress, profile } = useAuth();
  const navigate = useNavigate();
  const [ruleOpen, setRuleOpen] = useState(false);

  const league = progress?.current_rank ?? "white";
  const level = progress?.current_level ?? 1;

  // 훈련 탭 첫 화면 '오늘의 코스'와 같은 캐시 (같은 키)
  const { data: cycle } = useQuery({
    queryKey: ["level-cycle", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as Cycle;
    },
  });

  // 지금 레벨 심사 상태 — 10레벨 자동 신청(pending)·보완 요청 표시용 (오늘의 코스와 같은 키)
  const { data: reviewStatus } = useQuery({
    queryKey: ["my-level-status", user?.id, league, level],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("level_status").select("status")
        .eq("user_id", user!.id).eq("rank_name", league).eq("level_number", level)
        .maybeSingle();
      return (data?.status as string) ?? null;
    },
  });

  // 다음 레벨에서 배울 동작 미리보기 — 커리큘럼 영상(missions)이 있으면 2개까지
  const nextLevel = Math.min(10, level + 1);
  // 미리보기를 안 그리는 곳(훈련 탭 첫 화면)에서는 레벨 0 = 읽지 않음
  const { data: nextVideos = [] } = useLevelVideos(league, preview ? nextLevel : 0);
  // 10레벨 승인 주체 — DB 규칙(get_levelup_rules)이 정본 (화이트·블루 = 지점장·관장님, 2026-10-14)
  const { data: levelupRules } = useLevelupRules();

  if (!cycle) return null;

  const isBoss = level >= 10;
  const isPending = reviewStatus === "pending";
  const isRevision = reviewStatus === "revision_requested";
  // 화이트 타이틀매치 = 회원 신청 · 지점장 영상 심사 — 시범 지점(선릉역점)부터, 다른 지점은 예전처럼 코치님 승인 (2026-10-14)
  const isTitleFlow = isBoss && isTitleFlowFor(league, profile?.branch_name);
  // 레드·블랙은 출석을 채워도 코치 승인이 있어야 올라간다
  const approvalOnly = cycle.autoAdvances === false || cycle.rank === "red" || cycle.rank === "black";
  // 출석을 채우면 '심사'가 열린다 (자동 승급이 아니다)
  const needsReview = approvalOnly || isBoss;
  const gates = cycle.fastTrackGates ?? 0;
  const isFastTrack = gates > 0 && isBoss;

  const req = Math.max(1, cycle.reqSessions);
  const cur = cycle.progressFloor ?? cycle.sessions;
  const visitsLeft = Math.max(0, req - cur);
  const minDays = cycle.reqMinDays ?? 0;
  const elapsed = cycle.elapsedDays ?? 0;
  const daysLeft = Math.max(0, minDays - elapsed);

  const nextRank = RANK_ORDER[RANK_ORDER.indexOf(league) + 1];
  const nextLabel = isBoss
    ? nextRank
      ? `${RANK_LABELS[nextRank]} 리그까지`
      : "마스터 로드까지"
    : `레벨 ${toGlobalLevel(league, level) + 1}까지`;

  const hero = isTitleFlow
    ? "타이틀매치만 남았어요"
    : isPending
      ? "승인을 기다려요"
      : isRevision
        ? "보완 요청이 왔어요"
        : cycle.meets
          ? needsReview
            ? "승급 심사가 열렸어요"
            : "다음 출석 때 올라가요"
          : visitsLeft > 0
            ? needsReview
              ? `${visitsLeft}번 더 오면 심사가 열려요`
              : `${visitsLeft}번 더 오면 돼요`
            : daysLeft > 0
              ? `${daysLeft}일 더 지나면 돼요`
              : "거의 다 왔어요";
  const heroTone = cycle.meets || isTitleFlow ? "text-reward" : isPending || isRevision ? "text-status-pending" : "text-foreground";

  // 막대 하나 — 출석과 연한 중 덜 찬 쪽
  const pct = (c: number, r: number) => Math.min(100, Math.round((c / Math.max(1, r)) * 100));
  const barPct = Math.min(pct(cur, req), minDays > 0 ? pct(elapsed, minDays) : 100);
  const barDone = cycle.meets || barPct >= 100;
  const numbers = `출석 ${cur}/${req}회${minDays > 0 ? ` · 연한 ${elapsed}/${minDays}일` : ""}`;

  const nextName = nextRank ? `${RANK_LABELS[nextRank]} 리그` : "마스터 로드";
  const who = authorityLabel(levelupRules, league, 10);
  // 화이트·블루 10레벨은 도착하자마자 심사에 올라간다 (auto_advance_from_attendance) — 레드·블랙은 출석을 채워야
  const rule = isTitleFlow
    ? "레벨 10은 타이틀매치 — 파트너와 타이틀미션을 연습하고 지점장님께 심사를 신청해요. 지점장님이 영상으로 봐요 (도전 3번)"
    : isBoss
      ? approvalOnly
        ? `레벨 10은 출석 ${req}회를 채우면 승급 심사에 올라가요${minDays > 0 ? ` (최소 ${minDays}일)` : ""}. ${who}이 승인하면 ${nextName}로 가요`
        : `레벨 10은 승급 심사예요. ${who}이 직접 보고 승인하면 ${nextName}로 가요`
      : approvalOnly
        ? `${RANK_LABELS[league] ?? ""} 리그부터는 출석 ${req}회를 채우면 승급 심사가 열리고, ${authorityLabel(levelupRules, league, level)}이 직접 보고 승급해요${
            minDays > 0 ? ` · 레벨마다 최소 ${minDays}일` : ""
          }`
        : `입구 얼굴 인식으로 출석이 쌓여요. 출석 ${req}회를 채우면 자동으로 다음 레벨로 올라가요`;
  const fastTrackRule = isFastTrack
    ? `패스트 트랙 — 타이틀매치를 통과하면 ${nextName}의 1레벨이 아니라 그 리그의 타이틀매치로 바로 가요. 심사 항목은 똑같이 보여 드려야 해요`
    : null;

  const previews = preview && !isBoss ? nextVideos.filter((v) => !!youtubeThumb(v.videoUrl)).slice(0, 2) : [];

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-label font-bold text-muted-foreground">{nextLabel}</p>
          <button
            type="button"
            onClick={() => setRuleOpen((v) => !v)}
            aria-expanded={ruleOpen}
            aria-label="레벨업 규칙 보기"
            className="-m-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          >
            <CircleHelp className="h-5 w-5" />
          </button>
        </div>
        <p className={`break-keep text-title leading-tight ${heroTone}`}>{hero}</p>

        {isTitleFlow ? (
          titleButton && (
            <button
              type="button"
              onClick={() => navigate(titleMatchLink(league))}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-body font-bold text-primary-foreground active:scale-[0.98]"
            >
              <Trophy className="h-4 w-4" /> 타이틀미션 · 심사 신청
            </button>
          )
        ) : (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${barDone ? "bg-status-complete" : "bg-primary"}`}
                style={{ width: `${barPct}%` }}
              />
            </div>
            {/* 회색 줄은 하나 — 보완 요청이면 숫자 대신 할 일 */}
            <p className="mt-2 text-label text-muted-foreground">
              {isRevision ? "더 연습하고 출석하면 다시 심사에 올라가요" : numbers}
            </p>
          </>
        )}

        {isFastTrack && (
          <p className="mt-3 text-label font-bold text-reward">⚡ 패스트 트랙 · 직행권 {gates}장</p>
        )}

        {ruleOpen && (
          <div className="mt-3 space-y-1.5 rounded-xl bg-muted/50 px-3 py-2.5 text-label text-foreground">
            <p>{rule}</p>
            {fastTrackRule && <p>{fastTrackRule}</p>}
          </div>
        )}
      </div>

      {/* 다음 레벨에서 배울 동작 — 영상이 있을 때만 (없으면 칸을 그리지 않는다) */}
      {previews.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
          <p className="text-heading text-foreground">레벨 {toGlobalLevel(league, nextLevel)}에서 배울 동작</p>
          <div className="mt-3 flex gap-2">
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
                <p className="truncate px-2 py-1.5 text-label font-bold text-foreground">
                  {parseVideoTitle(v.title).name}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default LevelUpRequestCard;
