/**
 * 🥊 붕대 감기 집 연습 미션 카드 (2026-10-13 대표님: 신규 회원에게 '집에서 연습해 보기' 미션).
 *
 *   · home — 홈 첫 화면. 화이트 리그 레벨 1~3 회원(지도진 제외)에게만, 미션을 다 채우기 전까지 보인다. '나중에' = 2주 접기.
 *   · page — 붕대 감기 화면 안. 누구에게나 보이고, 다 채운 뒤에도 기록을 보여 준다.
 *   목표 일수·보상 숫자는 서버가 돌려준 값만 쓴다 (hooks/useHandWrap → DB 함수가 정본).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import GlyphTile from "@/components/icons/GlyphTile";
import { useAuth } from "@/contexts/AuthContext";
import { useHandWrapPractice, useLogHandWrapPractice } from "@/hooks/useHandWrap";
import { isManagerRole } from "@/lib/rankLabels";
import { isStaffProfile } from "@/lib/staffDisplay";
import { cn } from "@/lib/utils";

const HIDE_KEY = "153handwrap:card-hidden-until";
const HIDE_DAYS = 14;
/** 홈 카드를 보여 줄 신규 구간 — 화이트 리그 레벨 1~3 */
const HOME_MAX_LEVEL = 3;
/** 이보다 목표 일수가 많으면 칸 대신 막대 하나로 */
const MAX_SEGMENTS = 10;

const readHidden = (key: string): boolean => {
  try {
    const until = Number(window.localStorage.getItem(key));
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
};

const failText = (e: unknown): string =>
  (e as Error)?.message === "not_authenticated"
    ? "로그인이 필요해요"
    : "기록하지 못했어요 · 잠시 후 다시 눌러 주세요";

interface Props {
  variant: "home" | "page";
  className?: string;
}

const HandWrapPracticeCard = ({ variant, className }: Props) => {
  const navigate = useNavigate();
  const { user, role, profile, progress } = useAuth();
  const home = variant === "home";
  // 지도진은 역할(role)이 member 여도 profiles.is_staff 로 가린다 (홈 화면과 같은 판정)
  const eligible =
    !home ||
    (!isManagerRole(role) &&
      !isStaffProfile(profile) &&
      progress?.current_rank === "white" &&
      (progress?.current_level ?? 1) <= HOME_MAX_LEVEL);
  // '나중에'는 계정마다 — 같은 기기의 다른 회원에게까지 숨겨지지 않게
  const hideKey = `${HIDE_KEY}:${user?.id ?? "guest"}`;
  const [hidden, setHidden] = useState(() => home && readHidden(hideKey));
  const { data, isLoading, isError, refetch, isRefetching } = useHandWrapPractice(eligible && !hidden);
  const log = useLogHandWrapPractice();
  // 이번 화면에서 막 다 채웠으면 홈에서도 축하 상태를 보여 준다 (다음에 열 때는 숨김)
  const [justDone, setJustDone] = useState(false);

  if (!eligible || hidden) return null;

  const shell = cn("rounded-2xl bg-card p-4 shadow-elev-1", !home && "ring-1 ring-border/60", className);

  if (isLoading) {
    return home ? null : (
      <div className={shell} aria-busy="true" aria-label="집 연습 기록 불러오는 중">
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-muted" />
        <div className="mt-3 h-11 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (isError || !data) {
    return home ? null : (
      <div className={cn(shell, "text-center")}>
        <p className="text-[14px] font-bold text-foreground">집 연습 기록을 불러오지 못했어요</p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="mt-3 inline-flex h-10 items-center gap-1.5 rounded-full bg-secondary px-4 text-[13px] font-bold text-foreground active:scale-95 disabled:opacity-50"
        >
          <RotateCcw className={cn("h-4 w-4", isRefetching && "animate-spin")} /> 다시 시도
        </button>
      </div>
    );
  }

  const { days, goal, reward, today, rewarded } = data;
  // 미션이 꺼져 있으면(목표 0) 아무것도 안 보인다
  if (goal <= 0) return null;
  const reached = days >= goal;
  // 목표를 채웠는데 보상이 아직이면(목표·보상 숫자를 나중에 바꾼 경우 등) 받기 버튼을 보여 준다 — 서버가 그때 준다
  const claimable = reached && !rewarded && reward > 0;
  const complete = rewarded || (reached && reward <= 0);
  if (home && complete && !justDone) return null;

  const filled = Math.min(days, goal);

  const hideForNow = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(hideKey, String(Date.now() + HIDE_DAYS * 86_400_000));
    } catch {
      /* 저장 못 해도 이번 화면에서는 접힌다 */
    }
  };

  const press = () => {
    if (log.isPending || (today && !claimable)) return;
    log.mutate(undefined, {
      onSuccess: (r) => {
        if (r.granted) {
          setJustDone(true);
          toast.success(`🎉 집 연습 ${r.goal}일 완료! +${r.reward.toLocaleString()} 챔피언 머니를 받았어요`);
        } else if (r.alreadyToday) {
          toast("오늘은 이미 기록했어요 · 내일 또 감아 봐요");
        } else if (r.days >= r.goal) {
          toast.success(`${r.goal}일 다 채웠어요! 수업 때 코치님께 보여 주세요`);
        } else {
          toast.success(`좋아요! ${r.days}/${r.goal}일 — 내일도 한 번 감아 봐요`);
        }
      },
      onError: (e) => toast.error(failText(e)),
    });
  };

  const message = complete
    ? `${goal}일 다 채웠어요! 다음 수업 때 코치님 앞에서 혼자 감아 보여 주세요.`
    : claimable
      ? `${goal}일 다 채웠어요! 아래 버튼을 눌러 +${reward.toLocaleString()} 챔피언 머니를 받아 가세요.`
      : `집에서 혼자 감아 본 날 눌러 주세요 (하루 한 번)${reward > 0 ? ` · ${goal}일 채우면 +${reward.toLocaleString()} 챔피언 머니` : ""}`;

  return (
    <section aria-label="붕대 감기 집 연습 미션" className={shell}>
      <div className="flex items-start gap-3">
        <GlyphTile name="handwrap" size={44} />
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-bold leading-snug text-foreground">
            {complete ? "🎉 붕대 감기 집 연습 완료" : "붕대 감기 집 연습"}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{message}</p>
        </div>
      </div>

      {/* 며칠 채웠나 */}
      <div className="mt-3 flex items-center gap-1.5" role="img" aria-label={`${goal}일 중 ${filled}일 완료`}>
        {goal <= MAX_SEGMENTS ? (
          Array.from({ length: goal }, (_, i) => (
            <span key={i} className={cn("h-2 flex-1 rounded-full", i < filled ? "bg-primary" : "bg-secondary")} />
          ))
        ) : (
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${(filled / goal) * 100}%` }} />
          </span>
        )}
        <span className="ml-1.5 shrink-0 text-[12.5px] font-black tabular-nums text-foreground">
          {filled}/{goal}일
        </span>
      </div>

      {!complete && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={press}
            disabled={(today && !claimable) || log.isPending}
            className={cn(
              "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold transition-transform active:scale-[0.98] disabled:active:scale-100",
              today && !claimable ? "bg-secondary text-muted-foreground" : "bg-primary text-primary-foreground disabled:opacity-60",
            )}
          >
            {log.isPending ? (
              "기록 중…"
            ) : claimable ? (
              "보상 받기"
            ) : today ? (
              <>
                <Check className="h-4 w-4" strokeWidth={2.6} /> 오늘 완료 · 내일 또
              </>
            ) : (
              "오늘 감아 봤어요"
            )}
          </button>
          {home && (
            <>
              <button
                type="button"
                onClick={() => navigate("/handwrap")}
                className="h-11 shrink-0 rounded-xl bg-secondary px-3 text-[13px] font-bold text-foreground transition-transform active:scale-[0.98]"
              >
                감는 법
              </button>
              <button
                type="button"
                onClick={hideForNow}
                className="h-11 shrink-0 rounded-xl px-2 text-[12.5px] font-semibold text-muted-foreground active:bg-secondary"
              >
                나중에
              </button>
            </>
          )}
        </div>
      )}

      {complete && home && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={hideForNow}
            className="h-9 rounded-full px-3 text-[12.5px] font-semibold text-muted-foreground active:bg-secondary"
          >
            닫기
          </button>
        </div>
      )}
    </section>
  );
};

export default HandWrapPracticeCard;
