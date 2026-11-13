/**
 * 📅 캘린더 3-1단계 — 구독 주소 서버 함수 감싸기 (2026-11-13, DB 20261113125736_calendar_feed.sql)
 *   my_calendar_feed(종류) = 지금 상태(만들지 않음) · my_calendar_feed_on(종류, 새로) = 만들기 · 새 주소 · my_calendar_feed_off(종류) = 끊기
 *   서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) available:false — 입구를 숨긴다.
 *   주소 · 글은 src/lib/calendarFeed.ts.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { normalizeFeedState, unavailableFeed, type FeedKind, type FeedState } from "@/lib/calendarFeed";
import { isMissingFunction } from "@/services/coachManualService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

export const FEED_KEY = ["calendar-feed"] as const;

/** 내 구독 주소 상태 — live = 시트가 열려 있는 동안 15초마다(캘린더가 읽어 가면 '방금 읽어 갔어요') */
export const useCalendarFeed = (kind: FeedKind, enabled = true, live = false) =>
  useQuery({
    queryKey: [...FEED_KEY, kind],
    enabled,
    staleTime: 30_000,
    retry: false,
    refetchInterval: live ? 15_000 : false,
    queryFn: async (): Promise<FeedState> => {
      const { data, error } = await rpc("my_calendar_feed", { p_kind: kind });
      if (error) {
        if (isMissingFunction(error)) return unavailableFeed(kind);
        throw new Error(translateError(error, "주소를 불러오지 못했어요"));
      }
      return normalizeFeedState(data, kind);
    },
  });

/** 주소 만들기 — rotate = 새 주소(옛 주소를 넣어 둔 캘린더는 비게 된다) */
export const useCalendarFeedOn = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { kind: FeedKind; rotate?: boolean }): Promise<FeedState> => {
      const { data, error } = await rpc("my_calendar_feed_on", { p_kind: v.kind, p_rotate: v.rotate === true });
      if (error) throw new Error(translateError(error, "주소를 만들지 못했어요"));
      return normalizeFeedState(data, v.kind);
    },
    onSuccess: (st, v) => qc.setQueryData([...FEED_KEY, v.kind], st),
  });
};

/** 연결 끊기 — 그 주소를 넣어 둔 캘린더는 다음에 읽을 때부터 비어 있다 */
export const useCalendarFeedOff = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kind: FeedKind): Promise<FeedState> => {
      const { data, error } = await rpc("my_calendar_feed_off", { p_kind: kind });
      if (error) throw new Error(translateError(error, "연결을 끊지 못했어요"));
      return normalizeFeedState(data, kind);
    },
    onSuccess: (st, kind) => qc.setQueryData([...FEED_KEY, kind], st),
  });
};

/** 지점 이름 → 공개 주소 코드 (branches 는 로그인한 사람이 읽을 수 있다) */
export const useBranchCode = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: ["branch-code", branch ?? ""],
    enabled: enabled && !!branch,
    staleTime: 3_600_000,
    retry: false,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.from("branches").select("code").eq("name", branch as string).maybeSingle();
      if (error) return null;
      const code = (data as { code?: string | null } | null)?.code ?? null;
      return code && /^[a-z0-9-]{2,40}$/.test(code) ? code : null;
    },
  });

// ───────────────────────── 휴대폰 캘린더 가져오기(.ics) → 내 일정 ─────────────────────────
/** 한 줄씩 기존 저장 함수(ops_plan_save · ops_plan_skip)로 — 셋씩 나란히 · 끝나면 한 번만 다시 읽기 */
export async function importIcsPlans(
  payloads: Array<{ payload: Record<string, unknown>; skip: string[]; key: string }>,
  onProgress: (done: number) => void,
): Promise<{ saved: string[]; failed: number; stopped: string | null }> {
  const saved: string[] = [];
  let failed = 0;
  let stopped: string | null = null;
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (!stopped && next < payloads.length) {
      const it = payloads[next++];
      const { data, error } = await rpc("ops_plan_save", { p: it.payload });
      if (error) {
        const msg = translateError(error, "일정을 넣지 못했어요");
        if (/너무 많아요/.test(msg)) stopped = msg;
        failed++;
      } else {
        saved.push(it.key);
        // 반복에서 빼는 날 — 실패해도 일정은 그대로 둔다
        for (const d of it.skip) await rpc("ops_plan_skip", { p_id: data, p_date: d });
      }
      onProgress(++done);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { saved, failed, stopped };
}

const doneKey = (me: string) => `153plan:ics-done:${me}`;

/** 이 기기에서 전에 넣은 일정 (같은 파일을 두 번 넣지 않게) */
export function readIcsDone(me: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(doneKey(me)) || "[]");
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeIcsDone(me: string, keys: string[]) {
  try {
    const all = [...readIcsDone(me), ...keys];
    localStorage.setItem(doneKey(me), JSON.stringify(all.slice(-2000)));
  } catch {
    /* 저장이 막힌 기기 — 다음엔 '같은 일정' 검사만 */
  }
}
