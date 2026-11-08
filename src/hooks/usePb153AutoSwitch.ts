/**
 * 📺 라이브보드 1 · 2번 화면 → 153 PB 화면 자동 전환 (2026-11-08 대표님 「다음진행 추천대로」 — 측정이 시작되면 TV 가 저절로)
 *   /tv/:지점/1 · 2 가 채널 `test153-live:<지점 이름>` 을 듣다가 '달리는 측정' 신호가 오면
 *   /tv/:지점/pb1 · pb2 (?auto=1) 로 넘어간다. PB 화면은 마지막 측정이 끝나고 3분 뒤 원래 화면으로 돌아온다.
 *   열쇠(?k=) · embed · safe 같은 주소 쿼리는 그대로 가져간다. 끄기: 주소에 ?pb=0
 */
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { pbLiveChannel, pbScreenFor, pbSearchWith, pbShouldAutoSwitch } from "@/lib/pbBoard";

export function usePb153AutoSwitch(branchName: string, screen: string | undefined, rawBranchCode: string | undefined) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const target = pbScreenFor(screen);
  const off = new URLSearchParams(search).get("pb") === "0";

  useEffect(() => {
    if (!branchName || !target || !rawBranchCode || off) return;
    let moved = false;
    const channel = supabase
      .channel(pbLiveChannel(branchName))
      .on("broadcast", { event: "run" }, (msg) => {
        if (moved || !pbShouldAutoSwitch(msg?.payload)) return;
        moved = true;
        navigate(`/tv/${rawBranchCode}/${target}${pbSearchWith(search, true)}`, { replace: true });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [branchName, target, rawBranchCode, off, search, navigate]);
}

export default usePb153AutoSwitch;
