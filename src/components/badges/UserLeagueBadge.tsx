/**
 * 회원 아이디만 알 때 쓰는 리그 뱃지 (커뮤니티·챌린지 보드 등) — 2026-10-15.
 *
 * 같은 화면에 이름이 여러 개 떠도 서버는 한 번만 부른다: 한 박자(16ms) 동안 들어온 아이디를 모아
 * get_member_leagues RPC 로 한꺼번에 조회하고, 결과는 앱이 켜져 있는 동안 기억한다(10분).
 * 지도진(champion)·조회 실패는 뱃지를 그리지 않는다 — 이름 줄이 흔들리지 않게 자리도 비운다.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import NameBadge from "@/components/badges/NameBadge";

type Entry = { league: string | null; at: number };
const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<(v: string | null) => void>>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
const TTL = 10 * 60 * 1000;

async function flush() {
  const ids = [...queue];
  queue = new Set();
  timer = null;
  if (ids.length === 0) return;
  const found = new Map<string, string>();
  try {
    // 새 RPC 라 생성 타입(types.ts)에 아직 없어 캐스팅
    const { data } = await (supabase as any).rpc("get_member_leagues", { p_ids: ids });
    for (const r of (data ?? []) as Array<{ user_id: string; league: string }>) found.set(r.user_id, r.league);
  } catch {
    /* 네트워크 실패 — 뱃지 없이 둔다 */
  }
  const now = Date.now();
  for (const id of ids) {
    const v = found.get(id) ?? null;
    cache.set(id, { league: v, at: now });
    listeners.get(id)?.forEach((fn) => fn(v));
  }
}

function request(id: string) {
  queue.add(id);
  if (!timer) timer = setTimeout(flush, 16);
}

export function useMemberLeague(userId: string | null | undefined): string | null {
  const hit = userId ? cache.get(userId) : undefined;
  const [league, setLeague] = useState<string | null>(hit && Date.now() - hit.at < TTL ? hit.league : null);
  useEffect(() => {
    if (!userId) return;
    const c = cache.get(userId);
    if (c && Date.now() - c.at < TTL) {
      setLeague(c.league);
      return;
    }
    const set = listeners.get(userId) ?? new Set();
    set.add(setLeague);
    listeners.set(userId, set);
    request(userId);
    return () => {
      set.delete(setLeague);
    };
  }, [userId]);
  return league;
}

interface Props {
  userId: string | null | undefined;
  className?: string;
  animated?: boolean;
}

const UserLeagueBadge = ({ userId, className = "h-4 w-4", animated }: Props) => {
  const league = useMemberLeague(userId);
  if (!league || league === "champion") return null;
  // 이름 옆 = 리그 버튼 (2026-10-15 대표님 개편 — 방패는 리그·레벨 줄에)
  return <NameBadge league={league} className={className} glow={animated} />;
};

export default UserLeagueBadge;
