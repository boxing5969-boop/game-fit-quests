/**
 * 마이복서153 — 감동편지 (Welcome / Promotion Letter).
 *
 * 말해보카의 "Welcome Letter" 처럼, 앱 경험 중간에 한 통의 손편지가 도착한다.
 * 오삼이 환영 모달(OsamiWelcomeModal · 첫 로그인 사용법 안내)과는 별개로,
 * "마음을 건드리는 편지" 하나를 정해진 순간에 단 1회 보여준다.
 *
 * 편지 종류 (총 4통):
 *   · welcome — 시작(화이트 리그)에 도착하는 환영 편지
 *   · blue/red/black — 각 리그 승급 시 도착하는 축하 편지
 *
 * 노출 규칙 (DB / RPC 호출 0, 전부 localStorage):
 *   · 웰컴: 온보딩+튜토리얼을 마친 회원에게 1회 (오삼 모달과 안 겹침).
 *   · 승급: 처음 마운트 시 현재 리그를 "기준선"으로 silent 저장 →
 *           이후 다음 앱 진입에서 리그가 올라가 있으면 그 리그 편지 1회.
 *           (기존 회원이 현재 리그 편지로 도배되지 않도록 기준선 초기화)
 *   · 마운트 시 1회만 결정 — 세션 중 승급은 LevelUpModal 이 담당,
 *     편지는 다음 진입에서 도착 (두 모달 동시 노출 방지).
 *   · 셋업 라우트(/, /onboarding 등)에서는 노출 안 함.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getTutorialCampState } from "@/features/tutorial-camp/tutorialCampStorage";

const RANK_ORDER = ["white", "blue", "red", "black"] as const;
type RankKey = (typeof RANK_ORDER)[number];
type LetterKey = "welcome" | "blue" | "red" | "black";

const WELCOME_KEY = "153_letter_welcome_v1";
const RANK_BASELINE_KEY = "153_letter_rank_baseline_v1";

const SETUP_ROUTES = ["/", "/onboarding", "/select-branch", "/waiting-approval"];
function isSetupPath(pathname: string): boolean {
  if (SETUP_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/live-board")) return true;
  return false;
}

interface Letter {
  eyebrow: string;
  title: (n: string) => string;
  body: (n: string) => string;
  sign: string;
  cta: string;
}

const LETTERS: Record<LetterKey, Letter> = {
  welcome: {
    eyebrow: "Welcome Letter",
    title: (n) => `첫 라운드를 앞둔\n${n}님께`,
    body: (n) => `지금, 더 단단해지고 싶은 마음이 있나요?
누군가는 그걸 목표라 부르고,
누군가는 그냥 '오기'라 부르죠.

뭐라 부르든,
링 위에 서기로 마음먹은 건
그 자체로 멋진 일입니다.

복싱은 상대를 이기는 운동처럼 보이지만,
사실은 매일의 나와 겨루는 일이에요.
어제보다 1초 더 버틴 스텝,
한 번 더 뻗은 잽,
그만두고 싶던 순간을 넘긴 오늘.

그 작은 승리들이 조용히 쌓이면
어느새 거울 앞에서
조금 다른 나를 마주하게 됩니다.

화이트 리그, 레벨 1.
${n}님의 153랭크업은 지금부터예요.

빠르지 않아도 괜찮아요.
오늘 한 걸음이면 충분합니다.

153복싱짐에서
${n}님만의 단단한 날들을 만들어 가시길.`,
    sign: "— 153 일동",
    cta: "오늘, 한 라운드 시작 🥊",
  },
  blue: {
    eyebrow: "Promotion Letter",
    title: (n) => `블루 리그에 오른\n${n}님께`,
    body: (n) => `화이트에서 블루로.
${n}님은 한 단계를 스스로 넘었습니다.

이건 운이 아니에요.
빠지고 싶던 날에도 글러브를 다시 낀,
${n}님의 꾸준함이 만든 결과입니다.

블루 리그는 '기본을 갖춘 사람'의 자리예요.
이제부터는 힘이 아니라 정확함,
속도가 아니라 호흡을 배우게 됩니다.

조금 더 어려워질 거예요.
그런데 그 어려움이
${n}님을 더 멋진 복서로 만들어 줍니다.

증명은 이미 끝났어요.
${n}님은, 해내는 사람입니다.

다음 라운드에서 또 뵐게요.`,
    sign: "— 153 일동",
    cta: "블루 리그, 계속 가기 →",
  },
  red: {
    eyebrow: "Promotion Letter",
    title: (n) => `레드 리그에 닿은\n${n}님께`,
    body: (n) => `화이트, 블루를 지나 레드.
여기까지 온 사람은 많지 않아요.

${n}님은 이제 '잘하는 사람'을 넘어
'단단한 사람'이 되어가고 있어요.

레드 리그에서는
기술보다 멘탈이 먼저 시험받습니다.
지친 순간에 한 번 더,
무너질 것 같은 순간에 한 발 더.

그 한 번, 한 발이
${n}님을 여기까지 데려왔어요.

자부심을 가져도 됩니다.
다만 그 자부심을 오만이 아니라
다음 라운드의 연료로 쓰세요.

블랙이, 멀지 않았어요.`,
    sign: "— 153 일동",
    cta: "레드 리그, 끝까지 →",
  },
  black: {
    eyebrow: "Promotion Letter",
    title: (n) => `블랙 리그에 선\n${n}님께`,
    body: (n) => `블랙 리그.
${n}님이 처음 글러브를 꼈던 날을
기억하시나요?

그때의 떨림, 어색했던 스텝,
숨이 차서 멈추고 싶던 순간들.

그 모든 걸 지나
${n}님은 지금 여기에 서 있습니다.

블랙은 끝이 아니라
'증명을 마친 사람'의 새 출발점이에요.
이제 ${n}님의 복싱은
누군가에게 길이 되어줄 수 있습니다.

먼 길을 와줘서 고맙습니다.
153은 ${n}님의 모든 라운드를
곁에서 지켜봐 왔어요.

당신은, 진짜 복서입니다.`,
    sign: "— 153 일동",
    cta: "여기까지 온 나에게 박수 🥊",
  },
};

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, val: string) {
  try {
    window.localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

type LetterProfile = {
  nickname?: string | null;
  name?: string | null;
  onboarding_done?: boolean | null;
  tutorial_completed?: boolean | null;
  tutorial_skipped?: boolean | null;
};

const WelcomeLetter = () => {
  const location = useLocation();
  const { user, profile, progress } = useAuth();

  const [activeKey, setActiveKey] = useState<LetterKey | null>(null);
  const [open, setOpen] = useState(false);
  const decidedRef = useRef(false);

  // 마운트 시 1회만 어떤 편지를 보여줄지 결정 (세션 중 승급은 LevelUpModal 담당)
  useEffect(() => {
    if (decidedRef.current) return;
    if (!user || !profile) return;
    if (isSetupPath(location.pathname)) return;

    // 튜토리얼·7일 스타터 캠프가 진행/대기 중이면 편지 보류 — 캠프 안내와 겹침 방지.
    // 캠프는 튜토리얼 5단계 완료 시 자동 시작되므로 끝나기 전엔 안 띄운다.
    // completed/skipped(종료) 또는 not_started(튜토리얼 건너뛰어 캠프 미진행) 진입에서만 도착.
    const campStatus = getTutorialCampState().status;
    if (campStatus === "active" || campStatus === "paused") return;

    const p = profile as unknown as LetterProfile;
    const rank = ((progress as unknown as { current_rank?: string } | null)?.current_rank ??
      "white") as RankKey;
    const rankIdx = Math.max(0, RANK_ORDER.indexOf(rank));

    decidedRef.current = true;

    // 1) 승급 편지 — 기준선과 비교
    const baseline = lsGet(RANK_BASELINE_KEY);
    if (baseline === null) {
      // 최초: 현재 리그를 기준선으로 silent 저장 (도배 방지)
      lsSet(RANK_BASELINE_KEY, rank);
    } else {
      const baseIdx = Math.max(0, RANK_ORDER.indexOf(baseline as RankKey));
      if (rankIdx > baseIdx && rankIdx >= 1) {
        setActiveKey(RANK_ORDER[rankIdx] as LetterKey);
        return; // 승급 편지가 웰컴보다 우선
      }
    }

    // 2) 웰컴 편지 — 온보딩+튜토리얼 마친 회원 1회
    const tutorialDone = !!(p.tutorial_completed || p.tutorial_skipped);
    if (!lsGet(WELCOME_KEY) && p.onboarding_done && tutorialDone) {
      setActiveKey("welcome");
    }
  }, [user, profile, progress, location.pathname]);

  // 결정되면 살짝 지연 후 등장 (스플래시/다른 모달 정리 후)
  useEffect(() => {
    if (!activeKey) return;
    const t = window.setTimeout(() => setOpen(true), 1000);
    return () => window.clearTimeout(t);
  }, [activeKey]);

  const handleClose = () => {
    if (activeKey === "welcome") {
      lsSet(WELCOME_KEY, "1");
    } else if (activeKey) {
      // 승급 편지 닫으면 기준선을 현재 리그로 올림
      lsSet(RANK_BASELINE_KEY, activeKey);
    }
    setOpen(false);
  };

  if (typeof document === "undefined" || !activeKey) return null;

  const letter = LETTERS[activeKey];
  const p = profile as unknown as LetterProfile;
  const name = (p?.nickname || p?.name || "복서").toString().trim() || "복서";

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[114] bg-black/80 backdrop-blur-md"
            onClick={handleClose}
          />

          {/* 편지 */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 220 }}
            className="fixed inset-0 z-[115] flex items-center justify-center px-4 py-8"
            onClick={handleClose}
          >
            <div
              className="relative max-h-[86vh] w-full max-w-sm overflow-y-auto rounded-3xl border border-amber-400/35 bg-gradient-to-b from-[#0d1530] via-[#0a1024] to-[#080d1e] p-7 text-amber-50 shadow-[0_24px_70px_rgba(0,0,0,0.65),0_0_40px_rgba(246,196,83,0.12)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 닫기 */}
              <button
                onClick={handleClose}
                className="absolute right-3 top-3 rounded-full bg-white/5 p-1.5 text-amber-200/60 transition hover:bg-white/10 hover:text-amber-200"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>

              {/* 헤더 — 편지 봉투 */}
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-500/10 shadow-[0_0_24px_rgba(246,196,83,0.25)]">
                  <Mail className="h-5 w-5 text-amber-300" />
                </div>
                <p className="mt-3 text-[10px] font-black uppercase tracking-[0.4em] text-amber-300">
                  {letter.eyebrow}
                </p>
              </div>

              {/* 제목 */}
              <h2 className="mt-4 whitespace-pre-line text-center text-[22px] font-black leading-[1.3] text-amber-50">
                {letter.title(name)}
              </h2>

              {/* 본문 */}
              <p className="mt-5 whitespace-pre-line text-center text-[13.5px] leading-[1.85] text-amber-100/80">
                {letter.body(name)}
              </p>

              {/* 서명 */}
              <p className="mt-6 text-right text-[13px] font-bold tracking-wide text-amber-300/90">
                {letter.sign}
              </p>

              {/* 구분선 */}
              <div className="my-5 h-px w-full bg-gradient-to-r from-transparent via-amber-400/25 to-transparent" />

              {/* CTA */}
              <button
                onClick={handleClose}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-3.5 text-[14px] font-black tracking-wide text-amber-950 transition hover:from-amber-400 hover:to-amber-300 active:scale-[0.98]"
              >
                {letter.cta}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default WelcomeLetter;
