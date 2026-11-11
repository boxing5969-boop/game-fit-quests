/**
 * 153플레이 「복싱 음악」 — 체육관 자동재생 화면 (전체 화면)
 *
 * 2026-11-11 대표님: "체육관에 자동재생해놓을거야 광고도 없고 멈추지도 않게"
 *   · 고른 카테고리 곡을 섞어 끝까지 → 다시 섞어 끝없이(같은 가수 연달아 X).
 *   · 멈춤 감시(2초마다, lib/gymMusicQueue watchdogAction): 저절로 멈추면 다시 재생 → 같은 곡 다시 받기 → 다음 곡.
 *     못 트는 곡(삭제 · 퍼가기 막힘 · 나이 제한)은 바로 건너뛰고, 연달아 실패하면(인터넷 끊김) 점점 길게 기다렸다가 다시.
 *   · 화면 꺼짐 방지(Wake Lock) — 화면이 꺼지면 휴대폰 · 태블릿이 소리를 멈추기 때문.
 *   · 광고: 유튜브가 붙이는 것이라 앱이 끌 수 없다. 이 기기 브라우저에 유튜브 프리미엄으로 로그인해 두면 나오지 않는다
 *     — 그래서 youtube-nocookie 가 아니라 www.youtube.com 플레이어를 쓴다(로그인 쿠키가 있어야 프리미엄이 적용됨).
 *   · 영상 위를 눌러 실수로 멈추지 않게 플레이어는 누르기를 받지 않는다 — 조작은 아래 단추로만.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GYM_MUSIC_CATS, type GymMusicCat, type GymTrack } from "@/data/gymMusic";
import { buildQueue, retryDelayMs, watchdogAction } from "@/lib/gymMusicQueue";
import { loadYouTubeIframeApi, YT_STATE } from "@/lib/youtubeIframeApi";
import { useModalDismiss } from "@/hooks/useModalDismiss";

/* eslint-disable @typescript-eslint/no-explicit-any */

const VOL_KEY = "153play_music_vol";
const loadVol = () => {
  try {
    const v = Number(localStorage.getItem(VOL_KEY));
    return Number.isFinite(v) && v > 0 && v <= 100 ? v : 100;
  } catch { return 100; }
};

type WakeLockLike = { released: boolean; release: () => Promise<void> };

const CSS = `
.gmp{position:fixed;inset:0;z-index:130;background:var(--bg);color:var(--txt);overflow-y:auto;
  -webkit-overflow-scrolling:touch;padding:calc(10px + env(safe-area-inset-top)) 0 calc(24px + env(safe-area-inset-bottom))}
.gmp .top{display:flex;align-items:center;gap:10px;padding:0 16px 10px}
.gmp .top h2{font-size:1.1875rem;font-weight:900;letter-spacing:-.3px;flex:1;min-width:0}
.gmp .top h2 b{color:var(--mint)}
.gmp .x{flex:none;border:1px solid var(--line);background:var(--card);color:var(--txt);border-radius:10px;
  padding:9px 14px;font-size:.875rem;font-weight:900;cursor:pointer}
.gmp .main{display:flex;flex-direction:column;gap:14px;padding:0 16px}
.gmp .vid{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:12px;overflow:hidden}
.gmp .vid iframe,.gmp .vid .ytm{position:absolute;inset:0;width:100%;height:100%;border:0;pointer-events:none}
.gmp .tap{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:10px;background:rgba(0,0,0,.72);color:#fff;border:none;cursor:pointer;font-family:inherit;text-align:center;padding:16px}
.gmp .tap .big{width:76px;height:76px;border-radius:50%;background:var(--mint);color:#04211E;display:flex;
  align-items:center;justify-content:center}
.gmp .tap b{font-size:1.1875rem;font-weight:900}
.gmp .tap span{font-size:.875rem;opacity:.85}
.gmp .now .cat{display:inline-block;font-size:.8125rem;font-weight:900;color:var(--mint);margin-bottom:6px}
.gmp .now h3{font-size:1.5rem;font-weight:900;line-height:1.25;letter-spacing:-.5px}
.gmp .now p{font-size:1rem;color:var(--sub);margin-top:4px}
.gmp .ctl{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.gmp .ctl .b{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;cursor:pointer;
  border-radius:12px;background:var(--card);color:var(--txt);border:1px solid var(--line);height:52px;min-width:52px;
  padding:0 14px;font-size:.875rem;font-weight:900;font-family:inherit}
.gmp .ctl .b.pp{background:var(--mint);border-color:var(--mint);color:#04211E;min-width:72px}
.gmp .vol{display:flex;align-items:center;gap:8px;order:5;flex:1 1 100%;color:var(--sub);font-size:.875rem;font-weight:800;
  white-space:nowrap}
.gmp .vol input{flex:1;accent-color:var(--mint)}
.gmp .st{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.875rem;color:var(--sub)}
.gmp .st .dot{width:9px;height:9px;border-radius:50%;background:var(--dim);flex:none}
.gmp .st .dot.on{background:var(--mint);box-shadow:0 0 0 4px rgba(69,224,206,.18)}
.gmp .st .dot.warn{background:#F2994A}
.gmp .st i{font-style:normal;color:var(--dim)}
.gmp .chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}
.gmp .chips::-webkit-scrollbar{display:none}
.gmp .chips button{flex:none;border:1px solid var(--line);background:var(--card);color:var(--sub);border-radius:999px;
  padding:8px 13px;font-size:.875rem;font-weight:800;cursor:pointer;font-family:inherit}
.gmp .chips button.on{background:var(--mint);border-color:var(--mint);color:#04211E}
.gmp .side h4{font-size:.875rem;font-weight:900;color:var(--sub);margin:4px 0 8px}
.gmp .nx{display:flex;flex-direction:column;gap:8px}
.gmp .nx .r{display:flex;align-items:center;gap:10px;min-width:0}
.gmp .nx img{width:72px;height:40px;object-fit:cover;border-radius:6px;flex:none;background:#000}
.gmp .nx .tx{min-width:0}
.gmp .nx .t1{font-size:1rem;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gmp .nx .t2{font-size:.875rem;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (min-width:600px){ .gmp .vol{order:0;flex:1 1 150px} }
@media (min-width:1024px){
  .gmp{overflow:hidden}
  .gmp .main{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:24px;align-items:start;height:calc(100vh - 80px)}
  .gmp .vid{max-height:calc(100vh - 290px)}
  .gmp .now h3{font-size:2.5rem}
  .gmp .now p{font-size:1.1875rem}
  .gmp .side{overflow-y:auto;max-height:calc(100vh - 100px)}
}
`;

const Ico = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d={d} /></svg>
);
const I_PLAY = "M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z";
const I_PAUSE = "M7 5h3.5v14H7zM13.5 5H17v14h-3.5z";
const I_NEXT = "M5 6.2v11.6a.9.9 0 0 0 1.4.75L14.5 13v4.8h2.5V6.2h-2.5V11L6.4 5.45A.9.9 0 0 0 5 6.2z";
const I_PREV = "M19 6.2v11.6a.9.9 0 0 1-1.4.75L9.5 13v4.8H7V6.2h2.5V11l8.1-5.55A.9.9 0 0 1 19 6.2z";

const thumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const catLabel = (c: GymMusicCat) => GYM_MUSIC_CATS.find((x) => x.key === c)?.label ?? "";

interface Props {
  /** 전체 곡 (빼 둔 곡은 hidden 으로 거른다) */
  tracks: GymTrack[];
  hidden: Record<string, true>;
  /** 처음 고른 카테고리 — 빈 배열이면 전체 */
  initialCats: GymMusicCat[];
  /** 이 곡부터 */
  startWith?: string | null;
  onCatsChange: (cats: GymMusicCat[]) => void;
  onHide: (id: string) => void;
  onClose: () => void;
}

const GymMusicPlayer = ({ tracks, hidden, initialCats, startWith, onCatsChange, onHide, onClose }: Props) => {
  useModalDismiss(true, onClose);

  const byId = useMemo(() => new Map(tracks.map((t) => [t.id, t])), [tracks]);
  const [cats, setCats] = useState<GymMusicCat[]>(initialCats);
  const pool = useCallback(
    (cs: GymMusicCat[]) => tracks.filter((t) => !hidden[t.id] && (cs.length === 0 || cs.includes(t.c))),
    [tracks, hidden],
  );

  const [cur, setCur] = useState<string | null>(null);
  const [upNext, setUpNext] = useState<string[]>([]);
  const [paused, setPaused] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [waitNet, setWaitNet] = useState(false);
  const [apiErr, setApiErr] = useState(false);
  const [played, setPlayed] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [awake, setAwake] = useState(false);
  const [vol, setVol] = useState(loadVol);

  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  const posRef = useRef(0);
  const curRef = useRef<string | null>(null);
  const userPausedRef = useRef(false);
  const everPlayedRef = useRef(false);
  const failsRef = useRef(0);
  const tappedRef = useRef(false);
  const countedRef = useRef<string | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const w = useRef({ state: YT_STATE.UNSTARTED as number, stateAt: Date.now(), lastT: 0, progressAt: Date.now(),
    loadedAt: Date.now(), resumeTries: 0, reloadTries: 0 });

  const refreshUpNext = useCallback(() => {
    const q = queueRef.current;
    const p = posRef.current;
    const out: string[] = [];
    // 목록 끝을 넘어가면 다시 섞으니 미리 보여 줄 수 없다 — 이번 바퀴에 남은 곡만
    for (let i = p + 1; i < q.length && out.length < 5; i++) out.push(q[i]);
    setUpNext(out);
  }, []);

  /** 곡 불러오기 — isReload 면 같은 곡을 다시 받는 것(시도 횟수를 이어서 센다) */
  const load = useCallback((id: string, startSeconds = 0, isReload = false) => {
    curRef.current = id;
    setCur(id);
    const now = Date.now();
    w.current = { state: YT_STATE.UNSTARTED, stateAt: now, lastT: startSeconds, progressAt: now, loadedAt: now,
      resumeTries: 0, reloadTries: isReload ? w.current.reloadTries : 0 };
    const p = playerRef.current;
    if (p && readyRef.current) {
      try { p.loadVideoById({ videoId: id, startSeconds }); } catch { /* 플레이어가 다시 만들어지는 중 */ }
    }
    refreshUpNext();
  }, [refreshUpNext]);

  /** 다음 곡 — 목록 끝이면 다시 섞는다 */
  const next = useCallback(() => {
    if (advanceTimer.current) { window.clearTimeout(advanceTimer.current); advanceTimer.current = null; }
    const q = queueRef.current;
    if (!q.length) return;
    let p = posRef.current + 1;
    if (p >= q.length) {
      queueRef.current = buildQueue(pool(cats), { avoidFirst: curRef.current });
      p = 0;
    }
    posRef.current = p;
    if (queueRef.current.length) load(queueRef.current[p]);
  }, [cats, load, pool]);

  const prev = useCallback(() => {
    if (!queueRef.current.length) return;
    posRef.current = Math.max(0, posRef.current - 1);
    load(queueRef.current[posRef.current]);
  }, [load]);

  /** 못 트는 곡 — 바로(또는 인터넷이 끊긴 듯하면 잠시 뒤) 다음 곡 */
  const failAndAdvance = useCallback(() => {
    failsRef.current += 1;
    setSkipped((n) => n + 1);
    const wait = retryDelayMs(failsRef.current);
    setWaitNet(failsRef.current > 3);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      next();
    }, wait);
  }, [next]);

  // 최신 함수를 이벤트 콜백에서 쓰려고 ref 에 들고 있는다 (플레이어는 한 번만 만든다)
  const nextRef = useRef(next);
  const failRef = useRef(failAndAdvance);
  useEffect(() => { nextRef.current = next; failRef.current = failAndAdvance; });

  // 개발 서버에서만 — 브라우저 시험이 플레이어를 직접 건드릴 수 있게 (배포본에는 빠진다)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__gymMusic = { player: () => playerRef.current, queue: () => queueRef.current, pos: () => posRef.current };
  }, []);

  // ── 처음 순서 + 플레이어 만들기 ──
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | null = null;
    queueRef.current = buildQueue(pool(initialCats), { startWith: startWith ?? null });
    posRef.current = 0;
    const first = queueRef.current[0];
    if (first) { curRef.current = first; setCur(first); }
    refreshUpNext();

    const create = () => {
      loadYouTubeIframeApi().then((YT) => {
        if (cancelled || !wrapRef.current) return;
        setApiErr(false);
        const mount = document.createElement("div");
        mount.className = "ytm";
        wrapRef.current.querySelector(".ytm")?.remove();
        wrapRef.current.appendChild(mount);
        playerRef.current = new YT.Player(mount, {
          host: "https://www.youtube.com",
          videoId: curRef.current ?? undefined,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1, iv_load_policy: 3,
            origin: window.location.origin,
          },
          events: {
            onReady: (e: any) => {
              readyRef.current = true;
              const now = Date.now();
              w.current.loadedAt = now; w.current.stateAt = now; w.current.progressAt = now;
              try { e.target.setVolume(loadVol()); e.target.unMute(); e.target.playVideo(); } catch { /* noop */ }
            },
            onStateChange: (e: any) => {
              const s = Number(e.data);
              w.current.state = s;
              w.current.stateAt = Date.now();
              if (s === YT_STATE.PLAYING) {
                everPlayedRef.current = true;
                userPausedRef.current = false;
                setNeedTap(false); setPaused(false); setPlaying(true);
                if (countedRef.current !== curRef.current) {
                  countedRef.current = curRef.current;
                  setPlayed((n) => n + 1);
                }
              } else if (s === YT_STATE.PAUSED) {
                setPlaying(false);
              } else if (s === YT_STATE.ENDED) {
                setPlaying(false);
                nextRef.current();
              }
            },
            onError: () => {
              // 2 잘못된 id · 5 HTML5 오류 · 100 없음(삭제) · 101/150 퍼가기 막힘(나이 제한 포함)
              setPlaying(false);
              failRef.current();
            },
          },
        });
      }).catch(() => {
        if (cancelled) return;
        setApiErr(true);
        retryTimer = window.setTimeout(create, 10_000);
      });
    };
    create();

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      readyRef.current = false;
      try { playerRef.current?.destroy?.(); } catch { /* noop */ }
      playerRef.current = null;
    };
    // 플레이어는 화면을 열 때 한 번만 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 멈춤 감시 (2초마다) ──
  useEffect(() => {
    const iv = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || !readyRef.current || advanceTimer.current) return;
      let state = w.current.state;
      let t = w.current.lastT;
      try { state = Number(p.getPlayerState()); t = Number(p.getCurrentTime()) || 0; } catch { return; }
      const now = Date.now();
      if (state !== w.current.state) { w.current.state = state; w.current.stateAt = now; }
      if (t > w.current.lastT + 0.5) {
        w.current.lastT = t;
        w.current.progressAt = now;
        if (state === YT_STATE.PLAYING && failsRef.current) { failsRef.current = 0; setWaitNet(false); }
      }
      // 한 곡이라도 소리 나게 틀었거나, 재생 화면에서 사람이 재생 · 이전 · 다음을 눌렀으면 '자동재생 막힘'이 아니다
      const allowed = everPlayedRef.current || tappedRef.current;
      const act = watchdogAction({
        state, inStateMs: now - w.current.stateAt, stuckMs: now - w.current.progressAt,
        sinceLoadMs: now - w.current.loadedAt, resumeTries: w.current.resumeTries, reloadTries: w.current.reloadTries,
        everPlayed: allowed, userPaused: userPausedRef.current,
      });
      if (act === "resume") {
        w.current.resumeTries += 1;
        w.current.stateAt = now;
        try { p.unMute(); p.playVideo(); } catch { /* noop */ }
      } else if (act === "reload" && curRef.current) {
        w.current.reloadTries += 1;
        load(curRef.current, Math.max(0, Math.floor(w.current.lastT) - 2), true);
      } else if (act === "skip") {
        // 끝난 곡이 그대로 서 있는 경우는 실패가 아니다 — 그냥 다음 곡
        if (state === YT_STATE.ENDED) nextRef.current();
        else failRef.current();
      } else if (act === "needTap") {
        setNeedTap(true);
      }
    }, 2_000);
    return () => window.clearInterval(iv);
  }, [load]);

  // ── 화면 꺼짐 방지 ──
  useEffect(() => {
    let lock: WakeLockLike | null = null;
    let alive = true;
    const nav = navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } };
    const grab = async () => {
      if (!nav.wakeLock || document.visibilityState !== "visible") return;
      if (lock && !lock.released) return;
      try {
        lock = await nav.wakeLock.request("screen");
        if (!alive) { lock.release().catch(() => undefined); return; }
        setAwake(true);
        (lock as unknown as EventTarget).addEventListener?.("release", () => setAwake(false));
      } catch { setAwake(false); }
    };
    grab();
    const onVis = () => { if (document.visibilityState === "visible") grab(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => undefined);
    };
  }, []);

  // ── 인터넷이 돌아오면 바로 다시 ──
  useEffect(() => {
    const on = () => {
      if (failsRef.current > 0 && curRef.current) {
        if (advanceTimer.current) { window.clearTimeout(advanceTimer.current); advanceTimer.current = null; }
        load(curRef.current);
      }
    };
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [load]);

  const togglePause = useCallback(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    if (paused || needTap) {
      tappedRef.current = true;
      userPausedRef.current = false;
      w.current.resumeTries = 0;
      setPaused(false); setNeedTap(false);
      try { p.unMute(); p.playVideo(); } catch { /* noop */ }
    } else {
      userPausedRef.current = true;
      setPaused(true);
      // 못 튼 곡 때문에 다음 곡을 기다리는 중이었다면 그것도 멈춘다 — 멈춘 사이 저절로 다음 곡이 나오지 않게
      if (advanceTimer.current) { window.clearTimeout(advanceTimer.current); advanceTimer.current = null; }
      try { p.pauseVideo(); } catch { /* noop */ }
    }
  }, [paused, needTap]);

  /** 사람이 누른 이전 · 다음 — 일시정지 중이었어도 바로 튼다 */
  const manual = useCallback((go: () => void) => {
    tappedRef.current = true;
    userPausedRef.current = false;
    setPaused(false);
    go();
  }, []);

  // ── 키보드 (체육관 PC) — 스페이스 멈춤/재생 · → 다음 · ← 이전 ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === " ") { e.preventDefault(); togglePause(); }
      else if (e.key === "ArrowRight") manual(next);
      else if (e.key === "ArrowLeft") manual(prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, next, prev, manual]);

  const changeVol = (v: number) => {
    setVol(v);
    try { localStorage.setItem(VOL_KEY, String(v)); } catch { /* noop */ }
    try { playerRef.current?.setVolume(v); if (v > 0) playerRef.current?.unMute(); } catch { /* noop */ }
  };

  /** 카테고리를 바꾸면 지금 곡은 그대로, 다음 곡부터 새 목록 */
  const changeCats = (cs: GymMusicCat[]) => {
    const list = pool(cs);
    if (!list.length) return;
    setCats(cs);
    onCatsChange(cs);
    const now = curRef.current;
    const q = buildQueue(list, { avoidFirst: now });
    queueRef.current = now ? [now, ...q.filter((id) => id !== now)] : q;
    posRef.current = 0;
    refreshUpNext();
  };
  const toggleCat = (c: GymMusicCat | "all") => {
    if (c === "all") return changeCats([]);
    const has = cats.includes(c);
    const nextCats = has ? cats.filter((x) => x !== c) : [...cats, c];
    changeCats(nextCats.length === GYM_MUSIC_CATS.length ? [] : nextCats);
  };

  /** 이 곡 빼기 — 이 기기에서만, 바로 다음 곡 */
  const hideCurrent = () => {
    const id = curRef.current;
    if (!id) return;
    if (queueRef.current.length <= 1) return;
    onHide(id);
    const q = queueRef.current;
    const at = q.indexOf(id);
    queueRef.current = q.filter((x) => x !== id);
    posRef.current = Math.max(-1, at - 1);
    next();
  };

  const now = cur ? byId.get(cur) : undefined;
  const statusDot = waitNet || apiErr ? "warn" : playing ? "on" : "";
  const statusText = apiErr
    ? "유튜브를 불러오지 못했어요 — 10초마다 다시 시도해요"
    : waitNet
      ? "인터넷 연결을 기다리는 중 — 돌아오면 바로 이어서 틀어요"
      : paused
        ? "일시정지"
        : playing
          ? "자동재생 중"
          : "불러오는 중…";

  return (
    <div className="gmp" role="dialog" aria-modal="true" aria-label="체육관 음악 자동재생">
      <style>{CSS}</style>
      <div className="top">
        <h2><b>153</b> 체육관 음악</h2>
        <button type="button" className="x" onClick={onClose}>닫기</button>
      </div>
      <div className="main">
        <div className="left" style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <div className="vid" ref={wrapRef}>
            {needTap && (
              <button type="button" className="tap" onClick={togglePause}>
                <span className="big"><Ico d={I_PLAY} size={34} /></span>
                <b>화면을 한 번 눌러 음악을 시작해 주세요</b>
                <span>소리 나는 자동재생은 처음 한 번 눌러야 시작돼요 — 그다음부터는 계속 이어서 틀어요</span>
              </button>
            )}
          </div>
          <div className="now">
            {now && <span className="cat">{catLabel(now.c)}</span>}
            <h3>{now?.t ?? "곡을 고르는 중"}</h3>
            {now && <p>{now.a}</p>}
          </div>
          <div className="ctl">
            <button type="button" className="b" aria-label="이전 곡" onClick={() => manual(prev)}><Ico d={I_PREV} /></button>
            <button type="button" className="b pp" aria-label={paused || needTap ? "재생" : "일시정지"} onClick={togglePause}>
              <Ico d={paused || needTap ? I_PLAY : I_PAUSE} size={26} />
            </button>
            <button type="button" className="b" aria-label="다음 곡" onClick={() => manual(next)}><Ico d={I_NEXT} /></button>
            <label className="vol">
              볼륨
              <input type="range" min={0} max={100} step={5} value={vol}
                onChange={(e) => changeVol(Number(e.target.value))} aria-label="볼륨" />
            </label>
            <button type="button" className="b" onClick={hideCurrent}>이 곡 빼기</button>
          </div>
          <div className="st">
            <span className={`dot ${statusDot}`} />
            <span>{statusText}</span>
            <i>· {played}곡째{skipped ? ` · 못 튼 곡 ${skipped}` : ""}{awake ? " · 화면 켜짐 유지" : ""}</i>
          </div>
        </div>
        <div className="side">
          <h4>카테고리 — 지금 곡은 그대로, 다음 곡부터 바뀌어요</h4>
          <div className="chips">
            <button type="button" className={cats.length === 0 ? "on" : ""} onClick={() => toggleCat("all")}>전체</button>
            {GYM_MUSIC_CATS.map((c) => (
              <button type="button" key={c.key} className={cats.includes(c.key) ? "on" : ""}
                onClick={() => toggleCat(c.key)}>{c.label}</button>
            ))}
          </div>
          <h4 style={{ marginTop: 16 }}>다음 곡</h4>
          <div className="nx">
            {upNext.map((id, i) => {
              const t = byId.get(id);
              if (!t) return null;
              return (
                <div className="r" key={`${id}-${i}`}>
                  <img src={thumb(id)} alt="" loading="lazy" />
                  <div className="tx">
                    <div className="t1">{t.t}</div>
                    <div className="t2">{t.a}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GymMusicPlayer;
