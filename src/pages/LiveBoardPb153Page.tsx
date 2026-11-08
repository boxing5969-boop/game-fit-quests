/**
 * 📺 153 PB 라이브보드 — /tv/:지점/pb1 「코스 보드」 · /tv/:지점/pb2 「기록 보드」
 *   (2026-11-08 대표님 「다음진행 추천대로」 · 보고서 「153 PB 라이브보드 설계」 1단계 — 화이트 · 최대 4명 · 자동 전환)
 *
 *   · TV 는 로그인하지 않는다 — 기록은 board_test153(지점, TV 열쇠)로만 읽는다(라이브보드 잠그기 규칙 그대로).
 *   · 측정 중 표시는 코치 측정 화면이 보내는 신호(채널 test153-live:<지점 이름>, 이름 없음)를 따른다.
 *   · /tv/:지점/1 · 2 가 측정 신호를 받으면 이 화면으로 넘어온다(?auto=1) → 마지막 측정이 끝나고 3분 뒤 돌아간다.
 *   · 주소 쿼리: ?demo=1 예시 화면 · ?lite=1 시범 영상 대신 정지 그림(저사양 TV) · ?k= TV 열쇠 · ?pb=0 자동 전환 끄기(1 · 2번 화면)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveBranchCode } from "@/lib/branchAlias";
import { isBoardKeyError, readBoardKey } from "@/lib/boardKey";
import { usePb153Live } from "@/hooks/usePb153Live";
import { PB_AUTO_RETURN_MS, PB_DEMO_BOARD, pbRunPhase, pbSearchWith, type PbBoardData } from "@/lib/pbBoard";
import { PB_TV_CSS } from "@/components/liveBoard/pb/pbTvStyles";
import PbCourseBoard from "@/components/liveBoard/pb/PbCourseBoard";
import PbRecordBoard from "@/components/liveBoard/pb/PbRecordBoard";

const BOARD_POLL_MS = 60_000;

const LiveBoardPb153Page = ({ screen }: { screen: "pb1" | "pb2" }) => {
  const { branchCode: rawBranchCode } = useParams<{ branchCode: string }>();
  const branchCode = resolveBranchCode(rawBranchCode);
  const { search } = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(search);
  const demo = params.get("demo") === "1";
  const lite = params.get("lite") === "1";
  const auto = params.get("auto") === "1";

  // 지점 이름 (라이브보드와 같은 방법)
  const [branchName, setBranchName] = useState("");
  useEffect(() => {
    if (!branchCode) return;
    (async () => {
      const { data } = await supabase
        .from("branches")
        .select("name, code")
        .or(`code.eq.${branchCode},name.eq.${decodeURIComponent(branchCode)}`)
        .limit(1);
      setBranchName(data?.[0]?.name || decodeURIComponent(branchCode));
    })();
  }, [branchCode]);
  const branchLabel = (branchName || "153복싱짐").replace(/^153복싱짐\s*/, "") || "153복싱짐";

  const live = usePb153Live(branchName, demo);

  // 0.5초 시계 — 큰 타이머는 초 단위라 이걸로 충분하다(TV 부담 줄이기 · 10/26 렉 규칙)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  // 기록 보드 데이터 (2번 화면만)
  const [board, setBoard] = useState<PbBoardData | null>(demo ? PB_DEMO_BOARD : null);
  const [keyRequired, setKeyRequired] = useState(false);
  const loadBoard = useCallback(async () => {
    if (demo || screen !== "pb2" || !branchName) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("board_test153", { p_branch: branchName, p_key: readBoardKey(branchName) });
    if (error) {
      if (isBoardKeyError(error)) setKeyRequired(true);
      return;
    }
    setKeyRequired(false);
    if (data) setBoard(data as PbBoardData);
  }, [demo, screen, branchName]);
  useEffect(() => {
    void loadBoard();
    const t = window.setInterval(() => void loadBoard(), BOARD_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadBoard();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [loadBoard]);
  // 공식 기록이 저장되면 1.5초 뒤 다시 읽기 (저장 → 신호 → 순위 반영)
  useEffect(() => {
    if (!live.savedTick) return;
    const t = window.setTimeout(() => void loadBoard(), 1500);
    return () => window.clearTimeout(t);
  }, [live.savedTick, loadBoard]);

  // 자동 전환으로 들어왔으면 — 달리는 측정이 없어진 뒤 3분(완주 축하 · 기록을 보여 주는 시간) 지나면 원래 화면으로
  const lastActive = useRef(Date.now());
  const running = live.runs.some((r) => pbRunPhase(r) === "running");
  useEffect(() => {
    if (running) lastActive.current = Date.now();
  }, [running, now]);
  useEffect(() => {
    if (!auto || demo || !rawBranchCode) return;
    if (!running && Date.now() - lastActive.current > PB_AUTO_RETURN_MS) {
      navigate(`/tv/${rawBranchCode}/${screen === "pb1" ? "1" : "2"}${pbSearchWith(search, false)}`, { replace: true });
    }
  }, [now, auto, demo, running, rawBranchCode, screen, search, navigate]);

  // TV 화면 꺼짐 막기 (되는 기기만 — 라이브보드와 같은 방법)
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: "screen") => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await nav.wakeLock!.request("screen");
      } catch {
        /* 못 잡아도 화면은 그대로 */
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);

  return (
    <div style={{ width: 1920, height: 1080, overflow: "hidden", background: "#F5F8F7" }}>
      <style>{PB_TV_CSS}</style>
      {screen === "pb1" ? (
        <PbCourseBoard branchLabel={branchLabel} runs={live.runs} now={now} lite={lite} />
      ) : (
        <PbRecordBoard
          branchLabel={branchLabel}
          data={board}
          runs={live.runs}
          now={now}
          keyRequired={keyRequired}
          demo={demo}
        />
      )}
    </div>
  );
};

export default LiveBoardPb153Page;
