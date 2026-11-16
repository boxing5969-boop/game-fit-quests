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
//
// 홈 첫 화면 「다음 레벨까지」 (2026-11-16 대표님 「홈화면에 회원님들에게 다음 레벨로 가려면 얼마나 출석하면 될지?
// 또 어떤 미션을 달성하면 되는지 알려주자」) — 같은 카드에 `missions` 를 켜서 쓴다:
//   · 주인공 줄은 그대로('2번 더 오면 돼요') · 막대와 숫자 줄은 끈다(`bar={false}` — 바로 위 내 카드에 승급 막대가 있다)
//   · 그 아래 「미션」 칸 — 레벨 1~9 = 이번 레벨 미션 영상(누르면 바로 재생 → 따라했어요) · 레벨 10 = 타이틀미션 두 줄 + 타이틀매치 동작
//   · 타이틀매치 신청 흐름이면 지금 단계(신청 전 · 신청함 · 도전 중 · 다시 신청하는 날)로 말하고, 신청 단추는 신청할 수 있을 때만
//   · 맨 아래 한 줄 = 연습 화면(/missions?open=practice) 또는 타이틀매치 화면. 무엇을 보일지는 lib/nextLevelGuide.ts
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleHelp, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLevelVideos, useWatchedVideos, youtubeThumb, parseVideoTitle } from "@/hooks/useLevelVideos";
import { attemptsLeft, isTitleFlowFor, memberPhase, reviewerLabel, titleMatchLink } from "@/lib/titleMatchChallenge";
import { useTitleMatchState } from "@/hooks/useTitleMatchChallenge";
import { useLevelupRules } from "@/hooks/useLevelupRules";
import { authorityLabel } from "@/lib/levelAuthority";
import { toGlobalLevel } from "@/lib/rankLabels";
import { RANK_LABELS } from "@/data/sharedConstants";
import { missionGuide, titleFlowHero } from "@/lib/nextLevelGuide";
import type { LevelCardDemo } from "@/lib/nextLevelGuideSample";
import LevelMissionSection from "@/components/levelUp/LevelMissionSection";

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
  /** 막대 · 숫자 줄 — 홈 첫 화면은 바로 위 내 카드에 같은 막대(승급 진행도)가 있어 끈다 (같은 숫자는 한 화면에 한 번) */
  bar?: boolean;
  /** 「미션」 칸 + 맨 아래 연습 화면 가기 — 홈 첫 화면 「다음 레벨까지」 (2026-11-16) */
  missions?: boolean;
  /** 미션 영상이 아직 없는 레벨에서 대신 보일 목표 — 레벨 데이터(allLevelsData)를 이미 읽는 화면이 넘긴다 */
  levelGoal?: { title?: string | null; goal?: string | null } | null;
  /**
   * 예시(홈 ?lvdemo= — 운영진 미리 보기): 내 진행 상황 대신 지어낸 값으로 그린다. 출석 · 심사 단계는 서버를 부르지 않고,
   * 미션 영상 목록만 그 레벨의 실제 미션을 읽는다 (lib/nextLevelGuideSample.ts)
   */
  demo?: LevelCardDemo | null;
}

const HERO_TONE = { reward: "text-reward", pending: "text-status-pending", plain: "text-foreground" } as const;

const LevelUpRequestCard = ({
  titleButton = true,
  preview = false,
  bar = true,
  missions = false,
  levelGoal = null,
  demo = null,
}: Props) => {
  const { user, progress, profile } = useAuth();
  const navigate = useNavigate();
  const [ruleOpen, setRuleOpen] = useState(false);

  const league = demo?.league ?? progress?.current_rank ?? "white";
  const level = demo?.level ?? progress?.current_level ?? 1;
  // 타이틀매치 신청 흐름(회원 신청 · 지점장 영상 심사)이 열린 회원인가 — 시범 지점 화이트 (예시는 지어낸 값)
  const titleFlowOpen = demo ? demo.titleFlow : isTitleFlowFor(league, profile?.branch_name);

  // 훈련 탭 첫 화면 '오늘의 코스'와 같은 캐시 (같은 키)
  const { data: cycleData } = useQuery({
    queryKey: ["level-cycle", user?.id],
    enabled: !!user?.id && !demo,
    staleTime: 30_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_level_cycle_progress", {});
      if (error) throw error;
      return data as Cycle;
    },
  });

  // 지금 레벨 심사 상태 — 10레벨 자동 신청(pending)·보완 요청 표시용 (오늘의 코스와 같은 키)
  const { data: reviewData } = useQuery({
    queryKey: ["my-level-status", user?.id, league, level],
    enabled: !!user?.id && !demo,
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

  // 「미션」 칸(홈) — 이번 레벨 미션 영상 · '따라했어요' 표시 · 타이틀매치 신청 단계. 칸을 안 그리는 곳에서는 읽지 않는다(레벨 0 · enabled false)
  const { data: missionVideos = [], isSuccess: missionsReady } = useLevelVideos(league, missions ? level : 0);
  const { watched, toggle: toggleWatched } = useWatchedVideos();
  const { data: titleData, isLoading: titleDataLoading } = useTitleMatchState(
    null,
    missions && !demo && level >= 10 && titleFlowOpen,
  );

  // 예시면 서버 값 대신 지어낸 값
  const cycle: Cycle | undefined = demo ? demo.cycle : cycleData;
  const reviewStatus = demo ? demo.reviewStatus : reviewData;
  const titleState = demo ? demo.titleState : titleData;
  const titleStateLoading = demo ? false : titleDataLoading;

  if (!cycle) return null;

  const isBoss = level >= 10;
  const isPending = reviewStatus === "pending";
  const isRevision = reviewStatus === "revision_requested";
  // 화이트 타이틀매치 = 회원 신청 · 지점장 영상 심사 — 시범 지점(선릉역점)부터, 다른 지점은 예전처럼 코치님 승인 (2026-10-14)
  const isTitleFlow = isBoss && titleFlowOpen;
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

  // 홈 「미션」 칸이 켜진 타이틀매치 신청 흐름 — 지금 단계(신청 전 · 신청함 · 도전 중 · 다시 신청하는 날)로 말한다.
  // 서버 답이 오기 전에는 단계를 모르는 것으로(늘 맞는 말 '타이틀매치만 남았어요' · 신청 단추는 답이 온 뒤)
  const flow =
    missions && isTitleFlow
      ? titleFlowHero(titleStateLoading ? null : memberPhase(titleState), {
          attemptsLeft: attemptsLeft(titleState),
          retryAt: titleState?.retryAt ?? null,
          reviewer: reviewerLabel(titleState?.authority ?? "manager"),
        })
      : null;

  const baseHero = isTitleFlow
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
  const baseTone = cycle.meets || isTitleFlow ? "text-reward" : isPending || isRevision ? "text-status-pending" : "text-foreground";
  const hero = flow?.hero ?? baseHero;
  const heroTone = flow ? HERO_TONE[flow.tone] : baseTone;

  // 막대 하나 — 출석과 연한 중 덜 찬 쪽
  const pct = (c: number, r: number) => Math.min(100, Math.round((c / Math.max(1, r)) * 100));
  const barPct = Math.min(pct(cur, req), minDays > 0 ? pct(elapsed, minDays) : 100);
  const barDone = cycle.meets || barPct >= 100;
  const numbers = `출석 ${cur}/${req}회${minDays > 0 ? ` · 연한 ${elapsed}/${minDays}일` : ""}`;

  const nextName = nextRank ? `${RANK_LABELS[nextRank]} 리그` : "마스터 로드";
  const who = authorityLabel(levelupRules, league, 10);
  // 홈(미션 칸)의 회색 한 줄 — 신청 흐름이면 지금 단계의 다음 한 걸음, 그 밖의 레벨 10은 누가 보고 승인하는지 (자세한 규칙은 ? 안에).
  // 보완 요청이면 할 일 한 줄이 이미 있어 넣지 않는다 (회색 줄은 카드에 하나)
  const homeNote =
    flow?.note ?? (missions && isBoss && !isTitleFlow && !isRevision ? `${who}이 보고 승인하면 ${nextName}` : null);
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

  // 홈 「미션」 칸 — 영상 목록을 다 읽은 뒤에만 고른다(읽는 동안 목표 글이 잠깐 보였다 영상으로 바뀌지 않게 · 못 읽으면 칸 없이)
  const guide =
    missions && missionsReady
      ? missionGuide({ league, level, videos: missionVideos, watched, fallback: levelGoal, titleFlow: isTitleFlow })
      : null;
  // 「따라했어요」는 표시만 — 이미 표시된 것을 풀지 않는다
  const markDone = (id: string) => {
    if (!watched[id]) toggleWatched(id);
  };

  // 타이틀미션 · 심사 신청 단추 — 미션 칸이 켜져 있으면 지금 신청할 수 있는 회원에게만(신청함 · 도전 중 · 잠금은 아래 한 줄로)
  const titleButtonEl =
    isTitleFlow && titleButton && (!flow || flow.canRequest) ? (
      <button
        type="button"
        onClick={() => navigate(titleMatchLink(league))}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-body font-bold text-primary-foreground active:scale-[0.98]"
      >
        <Trophy className="h-4 w-4" /> 타이틀미션 · 심사 신청
      </button>
    ) : null;

  const body = (
    <>
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
        // 미션 칸이 켜져 있으면 단추는 미션 아래로 (타이틀미션 → 동작 → 신청 순서)
        !missions && titleButtonEl
      ) : bar ? (
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
      ) : isRevision ? (
        // 막대를 끈 곳(홈)에서도 보완 요청의 할 일 한 줄은 남긴다
        <p className="mt-2 text-label text-muted-foreground">더 연습하고 출석하면 다시 심사에 올라가요</p>
      ) : null}

      {homeNote && <p className="mt-2 break-keep text-label text-muted-foreground">{homeNote}</p>}

      {isFastTrack && (
        <p className="mt-3 text-label font-bold text-reward">⚡ 패스트 트랙 · 직행권 {gates}장</p>
      )}

      {ruleOpen && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-muted/50 px-3 py-2.5 text-label text-foreground">
          <p>{rule}</p>
          {fastTrackRule && <p>{fastTrackRule}</p>}
        </div>
      )}

      {guide && <LevelMissionSection guide={guide} videos={missionVideos} onDone={markDone} />}
      {missions && titleButtonEl}
    </>
  );

  return (
    <>
      {missions ? (
        <section aria-label="다음 레벨까지" className="overflow-hidden rounded-2xl border border-border bg-card shadow-elev-1">
          <div className="p-5">{body}</div>
          {/* 맨 아래 한 줄 — 신청 단추가 있을 때는 같은 곳으로 가는 줄을 또 두지 않는다 */}
          {guide && !titleButtonEl && (
            <button
              type="button"
              onClick={() => navigate(guide.link.to)}
              className="flex h-14 w-full items-center justify-between border-t border-border px-5 text-left text-body font-bold text-foreground active:bg-muted/30"
            >
              {guide.link.label} <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          )}
        </section>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">{body}</div>
      )}

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
