/**
 * 📺 라이브보드 TV 화면 바꾸기 — TV 쪽 (2026-11-08 대표님 「라이브보드 탭에서 내가 버튼을 누르면 라이브보드 변경 가능하게해줘 모든 모드 별로」)
 *   TV 화면(1 · 2 · 3 · 4 · pb1 · pb2)마다 이 훅을 둔다:
 *     · 처음 · 1분마다 · 화면을 다시 볼 때 board_tv_mode(지점, TV 열쇠, TV 번호, 지금 화면)로 '지금 이 화면이에요'를 알리고
 *       관리자 앱에서 고른 화면을 받는다.
 *     · 앱에서 바꾸면 채널 tv-mode:<지점 이름> 으로 이름 없는 신호가 온다 → 바로 다시 읽는다(신호를 놓쳐도 1분 안에).
 *     · 고른 화면이 지금 화면과 다르면 그 주소로 넘어간다(열쇠 ?k= 등 쿼리 유지 · 번호와 다른 화면이면 ?tv=<번호>).
 *   앱 안 미리보기(iframe)에서는 아무것도 하지 않는다 — 미리보기가 TV 인 척 알리거나 저절로 넘어가면 안 된다.
 *   153 PB 자동 전환으로 들어온 화면(holdUntilNewCommand)은 들어온 뒤에 새로 고른 화면만 따른다 — 그 전 설정이면 자동 복귀를 기다린다.
 *   보내기 · 읽기는 늘 조용히 실패한다(TV 화면은 그대로).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { readBoardKey } from "@/lib/boardKey";
import { resolveBranchCode } from "@/lib/branchAlias";
import {
  isTvScreen,
  tvDesired,
  tvModeChannel,
  tvRouteFor,
  tvSearchFor,
  type TvModeSetting,
  type TvScreen,
  type TvSlot,
} from "@/lib/tvRemote";

interface Opts {
  /** 주소의 지점 (s · sunreung …) */
  rawBranchCode: string | undefined;
  /** 이미 찾은 지점 이름 — 없으면 여기서 찾는다(회원 안내 화면은 DB 를 안 읽어서) */
  branchName?: string;
  slot: TvSlot | null;
  showing: TvScreen;
  holdUntilNewCommand?: boolean;
}

const CHECK_MS = 60_000;
const nameCache = new Map<string, string>();

export function useTvRemote({ rawBranchCode, branchName, slot, showing, holdUntilNewCommand = false }: Opts) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const inFrame = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);
  const active = !inFrame && !!slot && !!rawBranchCode;

  // 지점 이름 — 열쇠(이 기기에 지점 이름으로 남아 있다) · 채널 이름에 쓴다
  const [name, setName] = useState(branchName ?? "");
  useEffect(() => {
    if (branchName) {
      setName(branchName);
      return;
    }
    if (!active) return;
    const code = resolveBranchCode(rawBranchCode);
    if (!code) return;
    const cached = nameCache.get(code);
    if (cached) {
      setName(cached);
      return;
    }
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from("branches")
        .select("name, code")
        .or(`code.eq.${code},name.eq.${decodeURIComponent(code)}`)
        .limit(1);
      // 못 찾으면 주소 그대로 (다른 TV 화면과 같은 규칙)
      const n = (data?.[0]?.name as string | undefined) || decodeURIComponent(code);
      if (!alive || !n) return;
      nameCache.set(code, n);
      setName(n);
    })();
    return () => {
      alive = false;
    };
  }, [branchName, active, rawBranchCode]);

  const [state, setState] = useState<{ mode: TvModeSetting; setAt: number } | null>(null);
  /** 이 화면을 연 뒤 처음 받은 설정 시각(서버 시계) — 자동 전환 화면은 이보다 새 설정만 따른다 */
  const baseline = useRef<number | null>(null);
  const showingRef = useRef(showing);
  showingRef.current = showing;

  const check = useCallback(async () => {
    if (!active || !name || !slot) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("board_tv_mode", {
        p_branch: name,
        p_key: readBoardKey(name),
        p_slot: slot,
        p_showing: showingRef.current,
      });
      if (error || !data) return;
      const mode = (data as { mode?: unknown }).mode;
      if (mode !== "home" && !isTvScreen(mode)) return;
      const at = (data as { set_at?: unknown }).set_at;
      const setAt = typeof at === "string" ? Date.parse(at) || 0 : 0;
      if (baseline.current == null) baseline.current = setAt;
      setState((prev) => (prev && prev.mode === mode && prev.setAt === setAt ? prev : { mode: mode as TvModeSetting, setAt }));
    } catch {
      /* 다음 차례에 다시 */
    }
  }, [active, name, slot]);

  // 처음 · 1분마다 · 화면을 다시 볼 때
  useEffect(() => {
    if (!active || !name) return;
    void check();
    const t = window.setInterval(() => void check(), CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, name, check]);

  // 같은 화면 부품을 쓰는 주소끼리(/1 ↔ /2 ↔ 번호 없음) 넘어가면 다시 그려지지 않는다 → 지금 화면이 바뀌면 바로 알리기
  const reported = useRef(showing);
  useEffect(() => {
    if (reported.current === showing) return;
    reported.current = showing;
    void check();
  }, [showing, check]);

  // 앱에서 바꿨다는 신호 → 바로 다시 읽기
  useEffect(() => {
    if (!active || !name) return;
    const channel = supabase
      .channel(tvModeChannel(name))
      .on("broadcast", { event: "mode" }, (msg) => {
        const s = (msg?.payload as { slot?: unknown } | undefined)?.slot;
        if (typeof s === "string" && s !== slot) return;
        void check();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, name, slot, check]);

  // 고른 화면으로 넘어가기
  useEffect(() => {
    if (!active || !state || !slot || !rawBranchCode) return;
    const desired = tvDesired(slot, state.mode);
    if (desired === showing) return;
    if (holdUntilNewCommand && baseline.current != null && state.setAt <= baseline.current) return;
    navigate(`${tvRouteFor(rawBranchCode, desired)}${tvSearchFor(search, slot, desired)}`, { replace: true });
  }, [active, state, slot, showing, holdUntilNewCommand, rawBranchCode, search, navigate]);

  return {
    /** 이 TV 번호에서 지금 보여야 할 화면 (아직 모르면 null) */
    desired: active && state && slot ? tvDesired(slot, state.mode) : null,
  };
}

export default useTvRemote;
