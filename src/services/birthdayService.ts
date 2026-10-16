/**
 * 🎂 생일 축하하기 (2026-10-16 대표님 — 라이브보드 생일 연출의 앱 쪽)
 *
 *   · get_today_birthdays — 오늘 생일이고 오늘 내 지점에 운동하러 온 동료 + 내 생일이면 받은 축하
 *   · send_birthday_congrats — 한 번 눌러 축하 (같은 사람에게 하루 한 번), 받은 사람에게 알림
 *   · TV 는 get_live_board_birthdays 로 '축하 N개'를 읽는다
 *   생년월일은 어디에도 내보내지 않는다 (DB 가 '오늘 생일인가'만 판단).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export interface BirthdayMate {
  user_id: string;
  name: string;
  avatar_url: string | null;
  league: string;
  level: number;
  /** 오늘 받은 축하 수 */
  congrats: number;
  /** 내가 이미 축하했나 */
  sent: boolean;
}

export interface TodayBirthdays {
  branch: string | null;
  rows: BirthdayMate[];
  /** 오늘 내 생일이면 — 받은 축하 수와 최근 보낸 사람 (최신 순 5명) */
  me: { congrats: number; recent: string[] } | null;
}

/** 축하 한 줄 — 한 번 누르면 이 문구로 간다 */
export const DEFAULT_CONGRATS_MESSAGE = "생일 축하해요! 🎉";

/** 축하를 보낸 회원 보상 — 챔피언 머니 (서버 send_birthday_congrats 와 같은 값, 2026-10-16 대표님).
 *  생일 회원 1명당 하루 한 번 · 코치(지도진)는 보상 없음 */
export const BIRTHDAY_CONGRATS_REWARD = 100;

const KEY = ["today-birthdays"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

const normalize = (raw: unknown): TodayBirthdays => {
  const r = (raw ?? {}) as Partial<TodayBirthdays> & { rows?: unknown; me?: unknown };
  const rows = Array.isArray(r.rows) ? (r.rows as BirthdayMate[]) : [];
  const me = r.me && typeof r.me === "object" ? (r.me as TodayBirthdays["me"]) : null;
  return {
    branch: typeof r.branch === "string" ? r.branch : null,
    rows: rows.map((m) => ({
      ...m,
      congrats: Number(m.congrats) || 0,
      level: Number(m.level) || 1,
      sent: m.sent === true,
    })),
    me: me ? { congrats: Number(me.congrats) || 0, recent: Array.isArray(me.recent) ? me.recent : [] } : null,
  };
};

/** 1분마다 다시 읽는다 — 동료가 운동하러 오거나 축하가 쌓이면 바로 보이게 */
export const useTodayBirthdays = (enabled = true) =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await rpc("get_today_birthdays");
      if (error) throw new Error(translateError(error, "잠시 후 다시 시도해 주세요"));
      return normalize(data);
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

export const useSendBirthdayCongrats = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { receiverId: string; message?: string }) => {
      const { data, error } = await rpc("send_birthday_congrats", {
        p_receiver: input.receiverId,
        p_message: input.message ?? DEFAULT_CONGRATS_MESSAGE,
      });
      if (error) throw new Error(translateError(error, "지금은 축하를 보낼 수 없어요"));
      return data as { ok: boolean; already: boolean; congrats: number; reward?: number };
    },
    onSuccess: (res, input) => {
      if ((res?.reward ?? 0) > 0) void qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.setQueryData<TodayBirthdays>(KEY, (prev) =>
        prev
          ? {
              ...prev,
              rows: prev.rows.map((m) =>
                m.user_id === input.receiverId ? { ...m, sent: true, congrats: Number(res?.congrats) || m.congrats } : m,
              ),
            }
          : prev,
      );
    },
  });
};
