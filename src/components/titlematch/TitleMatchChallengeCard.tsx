/**
 * 🏆 타이틀미션 — 타이틀매치 화면에서 영상 위에 붙는 '이렇게 도전해요' 카드 (2026-10-14 대표님).
 *
 *   ① 파트너를 구한다 ② 파트너와 타이틀미션을 연습한다 ③ 지점장님에게 심사를 신청한다
 *   심사 기준: 완벽한 자세로 3번 연속 성공 → 똑같은 동작 3회 미트 받아주기 · 지점장 영상 촬영 · 도전 3번 · 3번 모두 아쉬우면 7일 뒤
 *
 * 아래쪽 버튼·상태는 서버 상태(get_title_match_state)로만 정한다 — 신청 전 / 신청함 / 도전 중 / 7일 잠금 / 통과.
 * 레벨 10 전이어도 같은 리그면 카드를 보여 준다 (미리 알고 준비하도록) — 버튼만 잠겨 있다.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Loader2, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { useCancelTitleMatch, useRequestTitleMatch, useTitleMatchState } from "@/hooks/useTitleMatchChallenge";
import {
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_RETRY_DAYS,
  TITLE_MISSION_STEPS,
  attemptsLeft,
  attemptsUsed,
  formatKoMonthDay,
  memberPhase,
  nextLeagueKo,
  openChallenge,
  reviewerLabel,
  titleMissionRules,
} from "@/lib/titleMatchChallenge";
import TitleAttemptList, { AttemptDots } from "./TitleAttemptList";
import { toGlobalLevel } from "@/lib/rankLabels";

interface Props {
  /** 지금 보는 칸의 리그 — 회원의 리그와 같을 때만 그린다 (화면에서 거른다) */
  league: string;
  /** 회원의 리그 안 레벨 (서버 값이 오기 전 안내용) */
  level: number;
}

const LEAGUE_ORDER = ["white", "blue", "red", "black"];

const TitleMatchChallengeCard = ({ league, level }: Props) => {
  const navigate = useNavigate();
  const { refreshProgress } = useAuth();
  const { data: state, isLoading } = useTitleMatchState();
  const request = useRequestTitleMatch();
  const cancel = useCancelTitleMatch();

  // 다른 기기에서 지점장님이 합격 처리해 이미 다음 리그면 — 이 화면의 진행 정보가 옛것이다.
  // 통과로 보여 주고 내 진행 정보를 다시 읽는다 (그러면 화면이 다음 리그 칸으로 바뀐다).
  const movedOn = !!state && LEAGUE_ORDER.indexOf(state.rank) > LEAGUE_ORDER.indexOf(league);
  useEffect(() => {
    if (movedOn) void refreshProgress();
  }, [movedOn, refreshProgress]);

  const phase = movedOn ? "cleared" : memberPhase(state);
  const max = state?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const days = state?.retryDays ?? DEFAULT_RETRY_DAYS;
  const who = reviewerLabel(state?.authority ?? "manager");
  const open = openChallenge(state);
  const lastChallenge = state?.challenge ?? null;
  const rules = titleMissionRules(max, days).map((r) => r.replace("지점장님", who));

  const onRequest = () =>
    request.mutate(undefined, {
      onSuccess: () => toast.success(`신청했어요! ${who}께 알림이 갔어요 🥊`, { description: "심사 날짜는 체육관에서 함께 정해요." }),
      onError: (e) => toast.error((e as Error)?.message || "신청하지 못했어요"),
    });
  const onCancel = () =>
    cancel.mutate(undefined, {
      onSuccess: () => toast("신청을 취소했어요", { description: "준비되면 다시 신청하세요." }),
      onError: (e) => toast.error((e as Error)?.message || "취소하지 못했어요"),
    });

  return (
    <section
      aria-labelledby="title-mission-heading"
      className="mt-4 overflow-hidden rounded-2xl bg-card shadow-elev-1 ring-1 ring-border/60"
    >
      <div className="border-b border-border/60 bg-reward/10 px-4 py-3">
        <p className="text-[12px] font-bold text-reward">🏆 타이틀미션</p>
        <h3 id="title-mission-heading" className="text-[16px] font-black leading-snug text-foreground">
          이렇게 도전해요
        </h3>
      </div>

      {/* ① ② ③ — 대표님 원문 */}
      <ol className="space-y-3 px-4 pt-4">
        {TITLE_MISSION_STEPS.map((s) => (
          <li key={s.n} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-black text-primary-foreground">
              {s.n}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-black leading-snug text-foreground">
                {s.n === 3 ? `${who}께 심사를 신청해요` : s.title}
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-muted-foreground">{s.desc}</span>
              {s.n === 1 && (
                <button
                  type="button"
                  onClick={() => navigate("/myboxer/community")}
                  className="mt-1.5 inline-flex h-8 items-center gap-1 rounded-full bg-secondary px-3 text-[12px] font-bold text-foreground transition-transform active:scale-95"
                >
                  <Users className="h-3.5 w-3.5" /> 커뮤니티에서 파트너 찾기 <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </span>
          </li>
        ))}
      </ol>

      {/* 심사 기준 */}
      <div className="mx-4 mt-4 rounded-xl bg-secondary/70 p-3.5">
        <p className="text-[12.5px] font-black text-foreground">심사 기준</p>
        <ul className="mt-1.5 space-y-1">
          {rules.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12.5px] leading-snug text-foreground">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-reward" />
              <span className="min-w-0">{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 지금 내 상태 · 신청 */}
      <div className="px-4 pb-4 pt-4" aria-live="polite">
        {isLoading ? (
          <div className="h-12 w-full animate-pulse rounded-2xl bg-muted" aria-label="불러오는 중" />
        ) : phase === "ready" ? (
          <button
            type="button"
            onClick={onRequest}
            disabled={request.isPending}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-primary text-[15px] font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {request.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "🙋"} {who}께 심사 신청
          </button>
        ) : phase === "requested" || phase === "challenging" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-primary/10 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-[14px] font-black text-primary">
                  {phase === "requested" ? "✅ 신청 완료" : `도전 중 · 남은 기회 ${attemptsLeft(state)}번`}
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  {phase === "requested"
                    ? `${who}이 심사 날짜를 잡아 드려요 · 파트너와 함께 오세요`
                    : `${who}과 다시 도전해요 · 파트너와 한 번 더 맞춰 봐요`}
                </span>
              </span>
              <AttemptDots attempts={open?.attempts ?? []} max={max} />
            </div>
            <TitleAttemptList attempts={open?.attempts ?? []} max={max} />
            {phase === "requested" && open?.requestedBySelf && attemptsUsed(open) === 0 && (
              <button
                type="button"
                onClick={onCancel}
                disabled={cancel.isPending}
                className="mx-auto block text-[12px] font-bold text-muted-foreground underline underline-offset-2 disabled:opacity-60"
              >
                신청 취소
              </button>
            )}
          </div>
        ) : phase === "locked" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3">
              <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block text-[14px] font-black text-foreground">
                  {formatKoMonthDay(state?.retryAt)}부터 다시 신청할 수 있어요
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                  도전 {max}번이 끝났어요. 파트너와 더 연습하면 다음엔 꼭 넘어요!
                </span>
              </span>
            </div>
            <TitleAttemptList attempts={lastChallenge?.attempts ?? []} max={max} />
          </div>
        ) : phase === "cleared" ? (
          <p className="rounded-2xl bg-status-complete/10 px-4 py-3 text-center text-[14px] font-black text-status-complete">
            🎉 통과! {nextLeagueKo(league)} 리그로 올라갔어요
          </p>
        ) : (
          <p className="rounded-2xl bg-muted px-4 py-3 text-center text-[13px] font-bold text-muted-foreground">
            레벨 {toGlobalLevel(league, 10)}이 되면 여기서 신청할 수 있어요 · 지금 레벨 {toGlobalLevel(state?.rank ?? league, state?.level ?? level)}
          </p>
        )}
      </div>
    </section>
  );
};

export default TitleMatchChallengeCard;
