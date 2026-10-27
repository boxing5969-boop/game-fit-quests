/**
 * 🏆 레벨 10 회원 팝업 — "타이틀매치를 통해 다음 리그로" + '타이틀미션 보기' (2026-10-14 대표님).
 *
 *   · 대상: 타이틀매치 신청 흐름이 열린 리그(지금은 화이트)의 레벨 10 회원 · 아직 신청 전 · 3번 마감 잠금 아님.
 *     지도진(is_staff)·관리 계정은 띄우지 않는다. 판정은 서버 상태(get_title_match_state)의 canRequest 하나.
 *   · 하루 한 번 (한국 날짜 · 계정마다). '나중에'도 '타이틀미션 보기'도 오늘은 다시 안 띄운다.
 *   · 다른 창(환영 편지·로그인 정보 안내·오늘 도전·시트)이 떠 있으면 닫힐 때까지 기다렸다가 띄운다 — 창이 두 겹으로 쌓이지 않게.
 */
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { useTitleMatchState } from "@/hooks/useTitleMatchChallenge";
import { isManagerRole } from "@/lib/rankLabels";
import { isStaffProfile } from "@/lib/staffDisplay";
import {
  TITLE_MISSION_STEPS,
  invitePopupKey,
  isTitleFlowFor,
  leagueKo,
  nextLeagueKo,
  reviewerLabel,
  shouldShowInvite,
  titleMatchLink,
} from "@/lib/titleMatchChallenge";

const seenToday = (key: string): boolean => {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
const markSeen = (key: string) => {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* 저장이 막혀도 이번 창은 닫힌다 */
  }
};

/** 다른 창이 떠 있는 동안 기다리는 간격·횟수 (최대 약 1분) */
const WAIT_MS = 1500;
const WAIT_TRIES = 40;
/** 첫 확인 — 환영 편지(+1초)처럼 조금 늦게 뜨는 창이 먼저 자리 잡게 */
const FIRST_CHECK_MS = 1800;

/**
 * 다른 창이 떠 있나 — aria 표시가 있는 창 + 표시가 없는 전체 화면 층
 * (로그인 정보 바꾸기 안내·계정 연결·환영 편지·오삼이 환영 등은 'fixed inset-0' 층에 z-index 를 준다)
 */
const otherOverlayOpen = (): boolean => {
  if (document.querySelector('[aria-modal="true"], [role="dialog"], [role="alertdialog"]')) return true;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(".fixed.inset-0"))) {
    const z = Number.parseInt(window.getComputedStyle(el).zIndex, 10);
    if (!Number.isFinite(z) || z < 50) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
  }
  return false;
};

const TitleMatchInvitePopup = () => {
  const navigate = useNavigate();
  const { user, role, profile, progress } = useAuth();
  const rank = progress?.current_rank ?? "";
  const eligible =
    !!user?.id &&
    !isManagerRole(role) &&
    !isStaffProfile(profile) &&
    (progress?.current_level ?? 0) === 10 &&
    // 시범 지점(선릉역점)부터 — 서버도 다른 지점은 flowEnabled=false 로 답한다
    isTitleFlowFor(rank, profile?.branch_name);

  const { data: state } = useTitleMatchState(null, eligible);
  const key = user?.id ? invitePopupKey(user.id) : "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!eligible || !key || !shouldShowInvite(state) || seenToday(key)) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (otherOverlayOpen()) {
        tries += 1;
        if (tries < WAIT_TRIES) timer = setTimeout(tick, WAIT_MS);
        return;
      }
      setOpen(true);
    };
    timer = setTimeout(tick, FIRST_CHECK_MS);
    return () => clearTimeout(timer);
  }, [eligible, key, state]);

  const close = useCallback(() => {
    if (key) markSeen(key);
    setOpen(false);
  }, [key]);
  useModalDismiss(open, close);

  if (!open || !state) return null;

  const league = leagueKo(state.rank);
  const next = nextLeagueKo(state.rank);
  const who = reviewerLabel(state.authority);

  return createPortal(
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 px-5 py-8 backdrop-blur-[2px]"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="title-invite-heading"
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-elev-3 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pb-5 pt-7 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-reward/15 ring-4 ring-reward/10">
            <Trophy className="h-8 w-8 text-reward" strokeWidth={2.4} />
          </span>
          <p className="mt-4 text-label font-bold text-reward">{league} 리그 · 레벨 10 달성</p>
          <h2 id="title-invite-heading" className="mt-1 text-heading font-black leading-snug text-foreground">
            {league} 타이틀매치로
            <br />
            {next} 리그에 올라가요
          </h2>
          <p className="mt-2 text-label leading-relaxed text-muted-foreground">
            타이틀미션을 확인하고, 준비되면 {who}께 심사를 신청하세요.
          </p>
        </div>

        <ol className="mx-5 space-y-2 rounded-2xl bg-secondary/70 px-4 py-3.5" aria-label="타이틀미션 도전 순서">
          {TITLE_MISSION_STEPS.map((s) => (
            <li key={s.n} className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-label font-black text-primary-foreground">
                {s.n}
              </span>
              <span className="min-w-0 text-label font-bold text-foreground">
                {s.n === 3 ? `${who}께 심사를 신청해요` : s.title}
              </span>
            </li>
          ))}
        </ol>

        <div className="space-y-1.5 px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={() => {
              close();
              navigate(titleMatchLink(state.rank));
            }}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98]"
          >
            타이틀미션 보기
          </button>
          <button
            type="button"
            onClick={close}
            className="flex h-11 w-full items-center justify-center rounded-2xl text-label font-bold text-muted-foreground transition-transform active:scale-[0.98]"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TitleMatchInvitePopup;
