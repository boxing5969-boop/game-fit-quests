/**
 * 👔 관장님 숫자 — 서버 함수 감싸기 (DB 20261126234059_owner_home.sql · Edge Function leader-kpi · docs/features/69)
 *   leader_owner_home(관장 · 지점장 · 본사만 — 그 밖은 꺼짐 · 매출은 서버가 권한대로 뺀다).
 *   숫자가 없거나 오래됐으면 leader-kpi 를 불러 다시 계산한다 — 관장님 숫자는 { owner: true }(서버가 10분 안 계산은 건너뜀),
 *   전체 재등록률은 지도자 홈 재등록률과 같은 계산(서버가 30분 안 계산은 건너뜀). 10분에 한 번까지만 부탁한다.
 *   함수가 아직 없거나 막히면 꺼진 것으로 본다. 캐시 키 ["153leader","owner",…]. 글 · 칸은 src/lib/ownerKpi.ts.
 */
import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { normalizeOwnerHome, OWNER_OFF, type OwnerHomeData } from "@/lib/ownerKpi";
import { LEADER_KEY } from "@/services/leaderHomeService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

const ASK_BUCKET_MS = 10 * 60_000;

/** 관장님 숫자 — 켠 지점 관장 · 지점장 · 본사만 */
export function useOwnerHome(branch: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery<OwnerHomeData>({
    queryKey: [...LEADER_KEY, "owner", branch ?? "mine", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    refetchInterval: 300_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("leader_owner_home", { p_branch: branch ?? null });
      if (error) return OWNER_OFF;
      return normalizeOwnerHome(data);
    },
  });
}

/** 숫자가 없거나 오래됐으면 다시 계산을 부탁한다(10분에 한 번까지) */
export function useOwnerRefresh(data: OwnerHomeData | undefined) {
  const qc = useQueryClient();
  const asked = useRef<Set<string>>(new Set());
  const branch = data?.on ? data.branch : null;
  const needOwner = !!branch && (!data?.owner || data.ownerStale);
  const needRenew = !!branch && (!data?.renew || data.renewStale);
  useEffect(() => {
    if (!branch) return;
    const bucket = Math.floor(Date.now() / ASK_BUCKET_MS);
    const jobs: { key: string; body: Record<string, unknown> }[] = [];
    if (needOwner) jobs.push({ key: `o:${branch}:${bucket}`, body: { branch, owner: true } });
    if (needRenew) jobs.push({ key: `k:${branch}:${bucket}`, body: { branch } });
    for (const j of jobs) {
      if (asked.current.has(j.key)) continue;
      asked.current.add(j.key);
      void supabase.functions
        .invoke("leader-kpi", { body: j.body })
        .then(({ error }) => {
          if (error) return;
          void qc.invalidateQueries({ queryKey: [...LEADER_KEY, "owner"] });
          if (!j.body.owner) void qc.invalidateQueries({ queryKey: [...LEADER_KEY, "home"] });
        })
        .catch(() => undefined);
    }
  }, [branch, needOwner, needRenew, qc]);
}
