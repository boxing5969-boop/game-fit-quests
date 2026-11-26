/**
 * 레벨업 안내 — 언제 띄울지 · 기록 (2026-11-27 · 옛 오삼 5단계 가이드 · 환영 모달 · 7일 캠프 자리)
 *
 *   저절로: 회원(지도진 · 관리자 · 마스터 빼고) · 홈에서 · 계정에 한 번(서버 member_guides — 다른 폰에서도 다시 안 뜬다).
 *           다른 창(편지 · 비밀번호 바꾸기 · 운동 마무리 등)이 떠 있으면 닫힐 때까지 기다린다(1분까지 · 그 뒤엔 다음 접속).
 *   다시 보기: openLevelGuide() — 설정 · 내정보 · 홈 레벨 카드 ? · 주소 ?guide=level(운영진 미리 보기)
 *   편지(WelcomeLetter)와 순서: 이 화면이 GuideGate 를 알려 준다 — 안내를 띄운 접속에는 편지를 다음 접속으로 미룬다.
 *   끝까지 보면 홈 「다음 레벨까지」 카드로 스크롤해 잠깐 테두리를 밝힌다(안내에서 본 그 카드).
 */
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffProfile } from "@/lib/staffDisplay";
import {
  LEVEL_GUIDE,
  LEVEL_GUIDE_OPEN_EVENT,
  guideDue,
  guideLocalKey,
  guideSessionKey,
  isGuideAudience,
  isHomePath,
  isMasterProgress,
  parseGuideStatus,
  setGuideGate,
  wantsGuideFromUrl,
  type GuideStatus,
} from "@/lib/levelGuide";
import { GUIDE_STATUS_KEY, markGuide, useGuideStatus } from "@/services/levelGuideService";
import LevelGuideSheet, { type GuideCloseResult } from "./LevelGuideSheet";

const lsGet = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const ssGet = (k: string) => {
  try {
    return window.sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const store = (s: "local" | "session", k: string) => {
  try {
    (s === "local" ? window.localStorage : window.sessionStorage).setItem(k, "1");
  } catch {
    /* 저장이 막힌 기기 — 서버 기록이 정본 */
  }
};

/** 다른 창이 화면을 덮고 있나 — 스크롤 잠금 · 대화창 · 화면을 덮는 높은 층 */
function otherOverlayOpen(): boolean {
  if (typeof document === "undefined") return false;
  if (document.body.style.overflow === "hidden") return true;
  if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')) return true;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>(".fixed.inset-0"))) {
    if (el.closest("[data-level-guide]")) continue;
    const cs = window.getComputedStyle(el);
    if (cs.pointerEvents === "none" || cs.visibility === "hidden" || cs.display === "none") continue;
    const z = Number(cs.zIndex);
    if (!Number.isFinite(z) || z < 60) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return true;
  }
  return false;
}

const LevelGuideHost = () => {
  const { user, profile, progress, role, realRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const uid = user?.id ?? null;

  const isAdmin = realRole === "super_admin" || realRole === "admin" || role === "super_admin" || role === "admin";
  const isStaff = !isAdmin && (isStaffProfile(profile) || role === "coach" || role === "branch_manager");
  // 회원인지 알려면 프로필과 레벨 기록이 있어야 한다 (마스터는 띄우지 않는다)
  const loading = !!uid && !isAdmin && !isStaff && (!profile || !progress);
  const audience = !loading && isGuideAudience({ signedIn: !!uid, isAdmin, isStaff, isMaster: isMasterProgress(progress) });

  const statusQ = useGuideStatus(uid, LEVEL_GUIDE, audience);
  const status: GuideStatus | null | "error" = statusQ.isError ? "error" : (statusQ.data ?? null);
  const [shownThisSession, setShownThisSession] = useState(false);
  useEffect(() => {
    setShownThisSession(!!uid && ssGet(guideSessionKey(uid)) === "1");
  }, [uid]);
  const localSeen = !!uid && lsGet(guideLocalKey(uid)) === "1";
  const due = guideDue({ audience, status, localSeen, shownThisSession });

  const [open, setOpen] = useState(false);
  const name = profile ? ((profile.nickname || profile.name || "").trim() || null) : null;

  // 편지와 순서 — WelcomeLetter 가 이 값을 보고 기다린다
  useLayoutEffect(() => {
    if (open) return setGuideGate("showing");
    if (!uid || isAdmin || isStaff) return setGuideGate("idle");
    if (loading) return setGuideGate("checking");
    if (!audience) return setGuideGate("idle");
    if (shownThisSession) return setGuideGate("shown");
    if (status === null) return setGuideGate("checking");
    setGuideGate(due ? "due" : "clear");
  }, [open, uid, isAdmin, isStaff, loading, audience, shownThisSession, status, due]);
  useEffect(() => () => setGuideGate("idle"), []);

  // 저절로 — 홈에서, 다른 창이 없을 때 (1.2초 뒤 · 덮여 있으면 1.5초마다 다시 · 1분까지)
  useEffect(() => {
    if (open || !due || !isHomePath(location.pathname)) return;
    let tries = 0;
    let t = 0;
    const tick = () => {
      if (otherOverlayOpen()) {
        tries += 1;
        if (tries < 40) t = window.setTimeout(tick, 1500);
        return;
      }
      setOpen(true);
    };
    t = window.setTimeout(tick, 1200);
    return () => window.clearTimeout(t);
  }, [open, due, location.pathname]);

  // 다시 보기 — 설정 · 내정보 · 레벨 카드 ?
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(LEVEL_GUIDE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(LEVEL_GUIDE_OPEN_EVENT, onOpen);
  }, []);

  // 주소 ?guide=level — 열고 주소에서는 지운다(새로고침에 다시 뜨지 않게)
  useEffect(() => {
    if (!wantsGuideFromUrl(location.search)) return;
    setOpen(true);
    const p = new URLSearchParams(location.search);
    p.delete("guide");
    const search = p.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true, state: location.state });
  }, [location.search, location.pathname, location.hash, location.state, navigate]);

  // 열면 기록 (회원만 — 운영진 미리 보기는 남기지 않는다)
  useEffect(() => {
    if (!open || !audience || !uid) return;
    void markGuide(LEVEL_GUIDE, "open", 0);
    store("local", guideLocalKey(uid));
    store("session", guideSessionKey(uid));
  }, [open, audience, uid]);

  const focusLevelCard = useCallback(() => {
    const find = () => document.querySelector<HTMLElement>('section[aria-label="다음 레벨까지"]');
    const shine = () => {
      const el = find();
      if (!el) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary/60");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-primary/60"), 2400);
    };
    if (isHomePath(location.pathname)) window.setTimeout(shine, 350);
    else {
      navigate("/home");
      window.setTimeout(shine, 900);
    }
  }, [location.pathname, navigate]);

  const handleClose = useCallback(
    (r: GuideCloseResult) => {
      setOpen(false);
      if (audience && uid) {
        void markGuide(LEVEL_GUIDE, r.finished ? "done" : "skip", r.step);
        setShownThisSession(true);
        qc.setQueryData<GuideStatus>([...GUIDE_STATUS_KEY, uid, LEVEL_GUIDE], (s) => {
          const base = s ?? parseGuideStatus(null);
          return { ...base, seen: true, done: base.done || r.finished, skipped: base.skipped || !r.finished, maxStep: Math.max(base.maxStep, r.step) };
        });
      }
      if (r.finished) focusLevelCard();
    },
    [audience, uid, qc, focusLevelCard],
  );

  return <LevelGuideSheet open={open} name={name} onClose={handleClose} />;
};

export default LevelGuideHost;
