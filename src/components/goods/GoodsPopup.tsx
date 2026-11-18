/**
 * 🧥 홈 팝업 — 153 플리스 집업 원가 판매 안내 (2026-11-18 대표님 「마이복서 153 에 폴리스집업 팝업창하나띄워죠
 *   사람들이 잘 모르는거같아서 오늘하루동안 뜨지않게하기 버튼도 넣어주고」).
 *
 *   · 대상: 로그인한 분 · 신청을 받는 중(기간 안 · 켜짐 · 선착순이 남음) · 아직 신청 전(결제 전 · 결제 완료 · 받음이 하나도 없음).
 *     홈 안내 카드(GoodsNudgeCard)와 같은 서버 값 · 같은 캐시를 읽는다 — 결제 전 안내는 그 카드가 한다.
 *   · 「오늘 하루 보지 않기」 = 이 기기 · 이 계정에서 한국 날짜가 바뀔 때까지 안 뜬다(localStorage).
 *     「닫기」(바깥 누르기 · Esc 포함) = 이번에 앱을 연 동안만 안 뜬다(sessionStorage) — 다음에 앱을 열면 다시.
 *     「자세히 보고 신청하기」(사진 눌러도) = 오늘은 다시 안 띄우고 상세페이지(/goods/fleece)로.
 *   · 다른 창(환영 편지 · 로그인 정보 안내 · 타이틀매치 팝업 · 오늘 도전 · 시트)이 떠 있으면 닫힐 때까지 기다렸다가 띄운다 —
 *     두 겹으로 쌓이지 않게(타이틀매치 팝업과 같은 방법). 그 팝업(1.8초)이 먼저 자리 잡게 조금 늦게(2.6초) 처음 본다.
 *   · 선착순이 다 차거나 마감이 지나면 저절로 안 뜬다 · 서버 함수가 없거나 실패하면 조용히 안 뜬다.
 *   · 미리 보기 /home?goodspop=1 — 이미 신청했거나 오늘 닫은 계정도 한 번 띄운다(운영진 확인용 · 신청을 받는 중일 때만).
 *   · 글은 상세페이지(public/goods/fleece/index.html)에 있는 사실만 — 브랜드 기준(153-brand) 금칙 · 긴 줄표 없이.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { leaveApp } from "@/lib/docCache";
import {
  GOODS_FLEECE_PATH,
  GOODS_FLEECE_SLUG,
  GOODS_POPUP_TIMING,
  ddayLabel,
  deadlineLabel,
  goodsPopupSessionKey,
  goodsPopupTodayKey,
  hasGoodsSample,
  isAccepting,
  listPriceOf,
  printColorsText,
  shortBranch,
  shouldShowGoodsPopup,
  won,
  type GoodsCampaign,
} from "@/lib/goodsPreorder";
import { getGoodsCampaign, getGoodsMyPage } from "@/services/goodsService";

/** 저장이 막힌 기기(사생활 보호 모드 등)에서도 이번에 앱을 연 동안은 다시 안 뜨게 */
const closedThisRun = new Set<string>();

const remembered = (kind: "local" | "session", key: string): boolean => {
  if (closedThisRun.has(key)) return true;
  try {
    return (kind === "local" ? window.localStorage : window.sessionStorage).getItem(key) === "1";
  } catch {
    return false;
  }
};
const remember = (kind: "local" | "session", key: string) => {
  closedThisRun.add(key);
  try {
    (kind === "local" ? window.localStorage : window.sessionStorage).setItem(key, "1");
  } catch {
    /* 저장이 막혀도 이번 창은 닫힌다 */
  }
};

/**
 * 다른 창이 떠 있나 — aria 표시가 있는 창 + 표시가 없는 전체 화면 층
 * (TitleMatchInvitePopup 과 같은 기준 — 로그인 정보 바꾸기 안내 · 계정 연결 · 환영 편지 · 스플래시는 'fixed inset-0' 층에 z-index 를 준다)
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

/** '남은 44벌' · (아직 하나도 안 나갔으면) '선착순 50벌' · 제한이 없으면 '' */
const stockShort = (c: GoodsCampaign): string => {
  if (c.stock_limit == null) return "";
  const left = c.stock_left == null ? c.stock_limit : Math.max(0, c.stock_left);
  return left >= c.stock_limit ? `선착순 ${c.stock_limit}벌` : `남은 ${left}벌`;
};

const GoodsPopup = () => {
  const { user, profile } = useAuth();
  const { onboardingDone } = useOnboardingState();
  const [params] = useSearchParams();
  const preview = params.get("goodspop") === "1";
  const userId = user?.id ?? null;

  // 홈 안내 카드(GoodsNudgeCard)와 같은 캐시 — 홈을 열 때 서버를 한 번만 부른다
  const { data } = useQuery({
    queryKey: ["goods-nudge", GOODS_FLEECE_SLUG, userId],
    queryFn: async () => {
      const [campaign, mine] = await Promise.all([getGoodsCampaign(GOODS_FLEECE_SLUG), getGoodsMyPage(GOODS_FLEECE_SLUG)]);
      return { campaign, mine };
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  const c = data?.campaign ?? null;
  const want =
    !!userId && onboardingDone && !!c && (preview ? isAccepting(c) : shouldShowGoodsPopup(c, data?.mine?.orders));

  const [open, setOpen] = useState(false);
  // 한 번 띄운 뒤에는(닫았거나 아직 열려 있거나) 같은 화면에서 다시 띄우지 않는다 — 서버 값을 다시 읽어도
  const shownRef = useRef(false);

  useEffect(() => {
    if (!want || !userId || shownRef.current) return;
    if (
      !preview &&
      (remembered("local", goodsPopupTodayKey(GOODS_FLEECE_SLUG, userId)) ||
        remembered("session", goodsPopupSessionKey(GOODS_FLEECE_SLUG, userId)))
    )
      return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      // 다른 창이 떠 있으면 닫힐 때까지 기다린다(약 1분 · 그래도 떠 있으면 이번엔 안 띄운다)
      if (otherOverlayOpen()) {
        tries += 1;
        if (tries < GOODS_POPUP_TIMING.waitTries) timer = setTimeout(tick, GOODS_POPUP_TIMING.waitMs);
        return;
      }
      shownRef.current = true;
      setOpen(true);
    };
    timer = setTimeout(tick, GOODS_POPUP_TIMING.firstCheckMs);
    return () => clearTimeout(timer);
  }, [want, userId, preview]);

  /** 닫기 · 바깥 누르기 · Esc — 이번에 앱을 연 동안만 */
  const closeForNow = useCallback(() => {
    if (userId) remember("session", goodsPopupSessionKey(GOODS_FLEECE_SLUG, userId));
    setOpen(false);
  }, [userId]);
  /** 오늘 하루 보지 않기 — 한국 날짜가 바뀔 때까지 */
  const hideToday = useCallback(() => {
    if (userId) remember("local", goodsPopupTodayKey(GOODS_FLEECE_SLUG, userId));
    setOpen(false);
  }, [userId]);
  useModalDismiss(open, closeForNow);

  if (!open || !c) return null;

  // 같은 탭에서 정적 상세페이지로 — 홈 카드와 같은 길(뒤로가기 흰 화면 막기 · src/lib/docCache.ts)
  const openDetail = () => {
    hideToday();
    void leaveApp(`${GOODS_FLEECE_PATH}/?from=app`);
  };

  const branch = profile?.branch_name ?? null;
  const myBranch = branch && c.branches.includes(branch) ? shortBranch(branch) : null;
  const colors = printColorsText(c);
  const listPrice = listPriceOf(c);
  const stock = stockShort(c);
  const points = [
    "브랜드 제품과 같은 원단 · 봉제",
    colors ? `인쇄 색 ${colors} 중 고르기` : null,
    hasGoodsSample(branch) ? `${shortBranch(branch)}에서 사이즈별 샘플 입어 보기` : null,
    // 앱에서 바로 내는 게 아니라는 것 — 카드 · 계좌이체는 상세페이지(360px 에서 한 줄에 들어가게 뺐다)
    `결제는 신청 뒤 ${myBranch ? `${myBranch} 데스크` : "다니는 지점 데스크"}에서`,
  ].filter((x): x is string => !!x);

  return createPortal(
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center bg-black/60 px-5 py-6 backdrop-blur-[2px]"
      onClick={closeForNow}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="goods-popup-heading"
        className="flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-card shadow-elev-3 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <button
            type="button"
            onClick={openDetail}
            aria-label={`${c.title} 자세히 보기`}
            className="relative block w-full bg-secondary"
          >
            <img
              src="/goods/fleece/img/gym-bag.webp?v=2"
              alt="플리스 집업을 입고 샌드백을 치는 모습, 등판에 BOXER 153 BOXING GYM 흰색 인쇄"
              width={952}
              height={1280}
              className="aspect-[16/10] w-full object-cover object-[50%_38%]"
            />
            <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-micro font-bold text-white">
              연말 원가 판매 · {ddayLabel(c)}
            </span>
            <span className="absolute bottom-2 right-3 text-micro text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
              AI 예시 이미지
            </span>
          </button>

          <div className="px-5 pb-4 pt-4">
            <p className="text-label font-bold text-primary">{c.title}</p>
            <h2 id="goods-popup-heading" className="mt-1 text-heading font-black leading-snug text-foreground">
              싸게 만든 옷이 아니라,
              <br />
              153이 남기지 않는 옷이에요
            </h2>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
              {listPrice != null && (
                <s className="text-label text-muted-foreground tabular-nums">{won(listPrice)}</s>
              )}
              <span className="text-title font-black tabular-nums text-foreground">{won(c.price)}</span>
              <span className="rounded-full bg-reward/15 px-2.5 py-0.5 text-micro font-bold text-reward">153 이익 0원</span>
            </div>

            <ul className="mt-3 space-y-1.5" aria-label="한눈에 보기">
              {points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-label text-foreground [text-wrap:pretty]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} aria-hidden="true" />
                  <span className="min-w-0">{p}</span>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={openDetail}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98]"
            >
              자세히 보고 신청하기
            </button>
            <p className="mt-2 text-center text-micro text-muted-foreground">
              신청 마감 {deadlineLabel(c.closes_at)}
              {stock ? ` · ${stock}` : ""}
            </p>
          </div>
        </div>

        <div className="grid shrink-0 grid-cols-2 border-t border-border">
          <button
            type="button"
            onClick={hideToday}
            className="h-12 text-label font-bold text-muted-foreground transition-colors active:bg-secondary"
          >
            오늘 하루 보지 않기
          </button>
          <button
            type="button"
            onClick={closeForNow}
            className="h-12 border-l border-border text-label font-bold text-foreground transition-colors active:bg-secondary"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default GoodsPopup;
