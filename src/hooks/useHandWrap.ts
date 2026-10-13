/**
 * 🥊 붕대 감기 — 집 연습 미션 기록 · 영상 주소 · 코치용 회원 기록 (2026-10-13 대표님).
 *
 *   · 집 연습 미션: 회원이 집에서 혼자 감아 본 날 '오늘 감아 봤어요' → log_handwrap_practice().
 *     한국 날짜로 하루 한 번만 쌓인다(같은 날 다시 눌러도 그대로). 목표 일수를 채우면 챔피언 머니를 한 번만 받는다.
 *     목표 일수·보상 = DB 함수(handwrap_practice_goal · handwrap_practice_reward)가 정본 — 화면은 받은 숫자만 쓴다.
 *   · 영상: 훈련 라이브러리의 '복싱 붕대 감기' 항목 영상 URL. 쿼리키를 ["training-library", …] 아래에 둬서
 *     훈련 라이브러리에서 고치면(invalidate ["training-library"]) 여기도 같이 새로 읽는다.
 *   · 홈 카드와 붕대 감기 화면이 같은 캐시(["handwrap-practice", 내 id])를 쓴다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { HANDWRAP_EXERCISE_NAME } from "@/data/handWrapGuide";
import { httpsUrlOrNull } from "@/lib/videoUrl";

export interface HandWrapPractice {
  /** 지금까지 감아 본 날 수 (서로 다른 날) */
  days: number;
  /** 오늘(한국 날짜) 이미 기록했나 */
  today: boolean;
  /** 목표 일수 */
  goal: number;
  /** 목표를 채우면 받는 챔피언 머니 */
  reward: number;
  /** 보상을 이미 받았나 */
  rewarded: boolean;
}

export interface HandWrapLogResult extends HandWrapPractice {
  /** 오늘 이미 눌렀던 날이면 true (새로 쌓이지 않음) */
  alreadyToday: boolean;
  /** 이번에 보상을 받았으면 true */
  granted: boolean;
}

const asObject = (raw: unknown): Record<string, unknown> =>
  raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** RPC 응답 → 화면용. success:false 면 그 사유로 에러를 던진다 */
export function parseHandWrapPractice(raw: unknown): HandWrapPractice {
  const r = asObject(raw);
  if (r.success !== true) throw new Error(typeof r.error === "string" ? r.error : "bad_response");
  return {
    days: count(r.days),
    today: r.today === true,
    goal: count(r.goal),
    reward: count(r.reward),
    rewarded: r.rewarded === true,
  };
}

export function parseHandWrapLog(raw: unknown): HandWrapLogResult {
  const r = asObject(raw);
  const base = parseHandWrapPractice({ ...r, today: true });
  return { ...base, alreadyToday: r.already_today === true, granted: r.granted === true };
}

const practiceKey = (userId: string | undefined) => ["handwrap-practice", userId ?? "guest"] as const;

/** 내 집 연습 기록 */
export function useHandWrapPractice(enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: practiceKey(user?.id),
    enabled: enabled && !!user,
    staleTime: 60_000,
    // 밤에 누르고 앱을 켜 둔 채 다음 날 돌아오면 '오늘 완료'가 풀려야 한다 — 앱으로 돌아올 때 다시 읽는다
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // get_my_handwrap_practice 는 types.ts 재생성 전 함수 — 기존 캐스트 패턴
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_my_handwrap_practice", {});
      if (error) throw error;
      return parseHandWrapPractice(data);
    },
  });
}

/** '오늘 감아 봤어요' */
export function useLogHandWrapPractice() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    // 누르기 직전에 돌던 재조회가 늦게 도착해 '누르기 전' 값으로 덮지 않게 먼저 멈춘다
    onMutate: () => qc.cancelQueries({ queryKey: practiceKey(user?.id) }),
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("log_handwrap_practice", {});
      if (error) throw error;
      return parseHandWrapLog(data);
    },
    onSuccess: (r) => {
      const next: HandWrapPractice = { days: r.days, today: true, goal: r.goal, reward: r.reward, rewarded: r.rewarded };
      qc.setQueryData(practiceKey(user?.id), next);
      if (r.granted) qc.invalidateQueries({ queryKey: ["wallet"] });
    },
  });
}

export interface HandWrapVideo {
  url: string;
  poster: string | null;
}

/** 훈련 라이브러리 '복싱 붕대 감기' 항목의 영상 — 없으면 null */
export function useHandWrapVideo() {
  return useQuery({
    queryKey: ["training-library", "handwrap-video"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<HandWrapVideo | null> => {
      // training_exercises 는 types.ts 재생성 전 테이블 — 기존 캐스트 패턴
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("training_exercises")
        .select("video_url, image_url")
        .eq("name", HANDWRAP_EXERCISE_NAME)
        .eq("is_active", true)
        .not("video_url", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = asObject((data ?? [])[0]);
      // https 주소만 — 'javascript:' 같은 주소가 플레이어(iframe)로 들어가지 않게
      const url = httpsUrlOrNull(row.video_url);
      if (!url) return null;
      return { url, poster: httpsUrlOrNull(row.image_url) };
    },
  });
}

export interface MemberHandWrapPractice {
  days: number;
  goal: number;
  rewarded: boolean;
  /** 마지막으로 감아 본 날 (YYYY-MM-DD, 한국 날짜) */
  lastOn: string | null;
}

/** 코치·관장 화면 — 회원 한 명의 집 연습 기록 (권한 없으면 null) */
export function useMemberHandWrapPractice(memberId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["member-handwrap", memberId],
    enabled: enabled && !!memberId,
    staleTime: 60_000,
    queryFn: async (): Promise<MemberHandWrapPractice | null> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_member_handwrap_practice", { _member_id: memberId });
      if (error) throw error;
      const r = asObject(data);
      if (r.success !== true) return null;
      return {
        days: count(r.days),
        goal: count(r.goal),
        rewarded: r.rewarded === true,
        lastOn: typeof r.last_on === "string" ? r.last_on : null,
      };
    },
  });
}
