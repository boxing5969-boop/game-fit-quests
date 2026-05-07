import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarCheck,
  ChevronLeft,
  Flame,
  Medal,
  Target,
  Users,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useChallengeLeaderboard,
  useChallengeList,
  useJoinChallenge,
  useSubmitChallengeCheckin,
} from "@/hooks/useChallenges";
import {
  CHALLENGE_GOAL_LABEL,
  type ChallengeRow,
  type ChallengeTeamSide,
} from "@/services/challengeService";

/**
 * /challenges — 21일 챌린지 MVP.
 *
 * 리스트 + 참여 + 일일 체크인 + 리더보드 한 페이지에 통합.
 * 체중 경쟁 제거 · 출석·연속성·복귀 참여로 점수화.
 */
const ChallengesPage = () => {
  const navigate = useNavigate();
  const listQ = useChallengeList();

  const [activeId, setActiveId] = useState<string | null>(null);

  const rows: ChallengeRow[] =
    listQ.data && listQ.data.success ? listQ.data.rows : [];
  const mine = rows.find((r) => r.is_joined && r.status !== "ended") ?? null;

  return (
    <AppPage
      header={
        <PageHeader
          title="21일 챌린지"
          subtitle="시즌 · 더 파이터"
          leftAction={
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="돌아가기"
              className="rounded-full bg-secondary p-2 active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div className="space-y-4 pt-2">
        {/* Hero — 더 파이터 시즌 */}
        <section className="rounded-2xl border border-yellow-500/40 bg-gradient-to-b from-yellow-500/10 via-emerald-400/5 to-transparent p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-yellow-400">
              SEASON
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
              CHALLENGE · 같이 21일
            </p>
          </div>
          <h2 className="mt-1.5 text-display-sm leading-tight text-foreground">
            <span className="text-yellow-400">더 파이터</span> 시즌
          </h2>
          <p className="mt-0.5 text-[13px] font-bold text-muted-foreground">
            혼자보다 함께
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            체중을 경쟁하지 않습니다. 출석·기록·복귀 참여로 점수가 쌓여요.
            꾸준함이 진짜 점수입니다.
          </p>
        </section>

        {/* 내 참여 챌린지 */}
        {mine && (
          <section>
            <p className="mb-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              내 챌린지
            </p>
            <MyChallengeCard
              row={mine}
              onOpenLeaderboard={() => setActiveId(mine.id)}
            />
          </section>
        )}

        {/* 리더보드 */}
        {activeId && <LeaderboardSection challengeId={activeId} />}

        {/* 공개 리스트 */}
        <section>
          <p className="mb-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
            진행 중인 챌린지
          </p>
          {listQ.isLoading && (
            <p className="text-center text-[12px] text-muted-foreground py-6">
              불러오는 중...
            </p>
          )}
          {!listQ.isLoading && rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-emerald-400/30 bg-emerald-400/5 p-6 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-500">
                <Users className="h-5 w-5" />
              </div>
              <p className="mt-2 text-[13px] font-bold text-foreground">
                <span className="text-yellow-400">더 파이터</span> 시즌 챌린지가 곧 열립니다
              </p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                지점 또는 목표별 챌린지가 열리면 여기에 표시돼요.
                <br />
                먼저 오늘의 습관 체크부터 챙겨볼까요?
              </p>
              <Button
                variant="outline"
                onClick={() => navigate("/diet")}
                className="mt-3 h-9 rounded-xl text-[12px]"
              >
                오늘 미션 먼저 하기
              </Button>
            </div>
          )}
          <ul className="space-y-2">
            {rows
              .filter((r) => !r.is_joined || r.status === "ended")
              .map((r) => (
                <li key={r.id} data-tutorial-target="first-challenge-card">
                  <ChallengeCard
                    row={r}
                    onOpenLeaderboard={() => setActiveId(r.id)}
                  />
                </li>
              ))}
          </ul>
        </section>

        <p className="pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          응원과 꾸준함 중심 · 상위권만 보상받지 않아요 · 몸무게 공개 없음
        </p>
      </div>
    </AppPage>
  );
};

// ───────────────────────────────────────────────────────────────────────
const MyChallengeCard = ({
  row,
  onOpenLeaderboard,
}: {
  row: ChallengeRow;
  onOpenLeaderboard: () => void;
}) => {
  const checkin = useSubmitChallengeCheckin();
  const [status, setStatus] = useState<string | null>(null);

  const { endDate, currentDay, pctComplete } = useMemo(() => {
    const start = new Date(row.start_date);
    const end = new Date(start);
    end.setDate(end.getDate() + row.duration_days);
    const today = new Date();
    const diffDays = Math.floor(
      (today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
    );
    const cur = Math.max(0, Math.min(row.duration_days, diffDays + 1));
    return {
      endDate: end.toISOString().slice(0, 10),
      currentDay: cur,
      pctComplete: Math.max(
        0,
        Math.min(100, Math.round((cur / row.duration_days) * 100)),
      ),
    };
  }, [row.start_date, row.duration_days]);

  const handleCheckin = async () => {
    const res = await checkin.mutateAsync({
      challengeId: row.id,
      kind: "daily",
      points: 1,
    });
    if (res.success) {
      setStatus(
        res.already_done_today
          ? "오늘은 이미 체크인했어요"
          : `오늘 체크인 완료 · 연속 ${res.current_streak ?? 1}일째`,
      );
    }
  };

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-primary">
          참여 중 · {CHALLENGE_GOAL_LABEL[row.goal]}
        </p>
      </div>
      <h3 className="mt-1 text-[16px] font-extrabold leading-tight text-foreground">
        {row.title}
      </h3>

      {/* 진행률 링 + 일수 */}
      <div className="mt-3 flex items-center gap-3">
        <ProgressRing pct={pctComplete} label={`${currentDay}`} />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] font-bold text-foreground">
            Day {currentDay} <span className="text-muted-foreground font-normal">/ {row.duration_days}</span>
          </p>
          <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
            {row.start_date} ~ {endDate}
            <br />
            참여 {row.participant_count}명 · 오늘도 체크인 한 번이면 충분해요
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          onClick={handleCheckin}
          disabled={checkin.isPending}
          className="h-10 flex-1 rounded-xl font-bold"
          aria-label="오늘의 챌린지 체크인"
        >
          <CalendarCheck className="mr-1 h-4 w-4" />
          오늘 체크인
        </Button>
        <Button
          variant="outline"
          onClick={onOpenLeaderboard}
          className="h-10 rounded-xl"
          aria-label="챌린지 순위 보기"
        >
          <Medal className="mr-1 h-4 w-4" />
          순위
        </Button>
      </div>

      {status && (
        <p className="mt-2 text-center text-[11.5px] font-bold text-emerald-500">
          {status}
        </p>
      )}
    </div>
  );
};

/** 진행률 링 — SVG 기반 · 가운데 숫자 · mint accent. */
const ProgressRing = ({
  pct,
  label,
  size = 56,
  stroke = 5,
}: {
  pct: number;
  label: string;
  size?: number;
  stroke?: number;
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`진행률 ${pct}%`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--primary))"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 500ms ease-out" }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="number-font text-[13px] font-extrabold text-foreground">
          {label}
        </span>
      </div>
    </div>
  );
};

const ChallengeCard = ({
  row,
  onOpenLeaderboard,
}: {
  row: ChallengeRow;
  onOpenLeaderboard: () => void;
}) => {
  const join = useJoinChallenge();
  const [team, setTeam] = useState<ChallengeTeamSide>("none");
  const [invite, setInvite] = useState("");
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleJoin = async () => {
    setMsg(null);
    const res = await join.mutateAsync({
      challengeId: row.id,
      teamSide: team,
      inviteCode: row.invite_code ? invite.trim().toLowerCase() : null,
    });
    if (!res.success) {
      const errMsg = "error" in res ? res.error : "참여 실패";
      setMsg(
        errMsg === "invalid_invite_code" ? "초대 코드가 맞지 않아요" : "참여 실패",
      );
    } else {
      setMsg("참여 완료! 오늘 체크인도 잊지 마세요.");
      setOpen(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Flame className="h-4 w-4 text-primary" />
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {CHALLENGE_GOAL_LABEL[row.goal]}
        </span>
        <span
          className={cn(
            "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold",
            row.status === "active"
              ? "bg-emerald-400/15 text-emerald-500"
              : row.status === "upcoming"
                ? "bg-sky-400/15 text-sky-500"
                : "bg-muted text-muted-foreground",
          )}
        >
          {row.status === "active"
            ? "진행 중"
            : row.status === "upcoming"
              ? "시작 전"
              : "종료"}
        </span>
      </div>
      <h3 className="mt-1.5 text-[14.5px] font-extrabold leading-tight text-foreground">
        {row.title}
      </h3>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        {row.start_date} · {row.duration_days}일
        {row.branch_name ? ` · ${row.branch_name}` : " · 전체 공개"}
        <span className="ml-1 inline-flex items-center gap-0.5">
          <Users className="h-3 w-3" /> {row.participant_count}
        </span>
      </p>

      {row.is_joined && row.status === "ended" ? (
        <p className="mt-2 text-[11px] font-bold text-muted-foreground">
          완주 기록 남음 — 수고하셨어요.
        </p>
      ) : !open ? (
        <div className="mt-3 flex gap-2">
          <Button
            onClick={() => setOpen(true)}
            disabled={row.status === "ended"}
            className="h-9 flex-1 rounded-xl text-[12.5px]"
          >
            참여하기
          </Button>
          <Button
            variant="outline"
            onClick={onOpenLeaderboard}
            className="h-9 rounded-xl text-[12.5px]"
          >
            순위
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="flex gap-1.5">
            {(["red", "blue", "none"] as ChallengeTeamSide[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTeam(t)}
                className={cn(
                  "flex-1 rounded-lg border px-2 py-1.5 text-[11.5px] font-bold transition-all",
                  t === team
                    ? t === "red"
                      ? "border-primary bg-primary/10 text-primary"
                      : t === "blue"
                        ? "border-sky-400 bg-sky-400/10 text-sky-500"
                        : "border-foreground bg-muted text-foreground"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {t === "red" ? "레드팀" : t === "blue" ? "블루팀" : "개인 참여"}
              </button>
            ))}
          </div>
          {row.invite_code && (
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="초대 코드 입력"
              className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-9 rounded-xl text-[11.5px]"
            >
              취소
            </Button>
            <Button
              onClick={handleJoin}
              disabled={join.isPending}
              className="h-9 flex-1 rounded-xl text-[11.5px] font-bold"
            >
              확인
            </Button>
          </div>
          {msg && (
            <p className="text-center text-[11px] text-muted-foreground">{msg}</p>
          )}
        </div>
      )}
    </div>
  );
};

const LeaderboardSection = ({ challengeId }: { challengeId: string }) => {
  const q = useChallengeLeaderboard(challengeId);
  const data = q.data && q.data.success ? q.data : null;
  if (!data) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        리더보드 · 출석·연속·복귀 기반
      </p>

      <div className="grid grid-cols-2 gap-2">
        <TeamBar label="RED" points={data.team_red_points} tone="red" />
        <TeamBar label="BLUE" points={data.team_blue_points} tone="blue" />
      </div>

      <ul className="mt-3 space-y-1">
        {data.rows.slice(0, 20).map((r, i) => (
          <li
            key={r.user_id}
            className="flex items-center justify-between rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="number-font w-5 text-right font-extrabold text-muted-foreground">
                {i + 1}
              </span>
              <span className="truncate font-bold text-foreground">
                {r.member_name ?? "익명"}
              </span>
              {r.team_side !== "none" && (
                <span
                  className={cn(
                    "rounded px-1 text-[9px] font-black",
                    r.team_side === "red"
                      ? "bg-primary/15 text-primary"
                      : "bg-sky-400/15 text-sky-500",
                  )}
                >
                  {r.team_side.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11.5px]">
              <span className="number-font font-bold text-foreground">{r.total_points}점</span>
              {r.current_streak > 0 && (
                <span className="inline-flex items-center gap-0.5 text-primary">
                  <Flame className="h-3 w-3" />
                  {r.current_streak}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-center text-[10.5px] leading-relaxed text-muted-foreground">
        상위 20명만 표시. 꾸준히 참여한 모두가 완주자입니다.
      </p>
    </section>
  );
};

const TeamBar = ({
  label,
  points,
  tone,
}: {
  label: string;
  points: number;
  tone: "red" | "blue";
}) => (
  <div
    className={cn(
      "rounded-xl border p-3",
      tone === "red"
        ? "border-primary/30 bg-primary/5"
        : "border-sky-400/30 bg-sky-400/5",
    )}
  >
    <p
      className={cn(
        "text-[10px] font-black uppercase tracking-[0.2em]",
        tone === "red" ? "text-primary" : "text-sky-500",
      )}
    >
      TEAM {label}
    </p>
    <p className="mt-0.5 number-font text-[18px] font-extrabold text-foreground">
      {points.toLocaleString()}
      <span className="ml-1 text-[11px] font-bold text-muted-foreground">점</span>
    </p>
  </div>
);

export default ChallengesPage;
