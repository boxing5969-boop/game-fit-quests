/**
 * 📈 153 코치 기준 · 4주 성장 — 훅 · 뮤테이션 (["coach153", …] 캐시)
 *   서버: coach_growth_me · coach_growth_start · coach_observe_save · coach_observe_seen · coach_observe_delete
 *         · coach_growth_review · coach_std_save (20261105005333_coach_std_growth.sql)
 *   오삼코치 다듬기: chat-assistant action "coach-observe-polish" — 서버가 ai_polish 를 켤 때만 화면에 보인다
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { CoachGrowthMe, Marks, PlanDecision } from "@/lib/coachGrowth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

export const COACH153_KEY = ["coach153"] as const;

export const useCoachGrowthMe = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...COACH153_KEY, "me", branch],
    enabled,
    staleTime: 20_000,
    queryFn: () => call<CoachGrowthMe>("coach_growth_me", { p_branch: branch }, "153 기준을 불러오지 못했어요"),
  });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COACH153_KEY });
};

export const useStartGrowth = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: { coach: string; startOn: string }) =>
      call<string>("coach_growth_start", { p_coach: v.coach, p_start_on: v.startOn }, "4주 과정을 시작하지 못했어요"),
    onSuccess: done,
  });
};

export interface ObserveInput {
  coach: string;
  classOn: string;
  classHour: number | null;
  marks: Marks;
  good1: string;
  good2: string;
  fix1: string;
  fixNo: number | null;
}

export const useSaveObservation = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: ObserveInput) =>
      call<string>(
        "coach_observe_save",
        {
          p_coach: v.coach,
          p_class_on: v.classOn,
          p_class_hour: v.classHour,
          p_marks: v.marks,
          p_good1: v.good1,
          p_good2: v.good2,
          p_fix1: v.fix1,
          p_fix_no: v.fixNo,
        },
        "피드백을 보내지 못했어요",
      ),
    onSuccess: done,
  });
};

export const useSeenObservations = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (ids: string[]) => call<number>("coach_observe_seen", { p_ids: ids }, "확인을 남기지 못했어요"),
    onSuccess: done,
  });
};

export const useDeleteObservation = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("coach_observe_delete", { p_id: id }, "피드백을 지우지 못했어요"),
    onSuccess: done,
  });
};

export const useReviewGrowth = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: { plan: string; decision: PlanDecision; note: string }) =>
      call<void>("coach_growth_review", { p_plan: v.plan, p_decision: v.decision, p_note: v.note }, "돌아보기를 저장하지 못했어요"),
    onSuccess: done,
  });
};

export const useSaveStd = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: { no: number; title: string; why: string; how: string; say: string; check: string }) =>
      call<void>(
        "coach_std_save",
        { p_no: v.no, p_title: v.title, p_why: v.why, p_how: v.how, p_say: v.say, p_check: v.check, p_active: true },
        "기준을 저장하지 못했어요",
      ),
    onSuccess: done,
  });
};

export interface PolishResult {
  good1: string;
  good2: string;
  fix1: string;
  fix_no: number | null;
}

/** 오삼코치로 다듬기 — 메모 + 점검표 → 잘한 것 2 · 바꿀 것 1 (저장하지 않는다, 칸을 채울 뿐) */
export async function polishObservation(v: { coach: string; memo: string; marks: Marks; branch: string | null }): Promise<PolishResult> {
  const { data, error } = await supabase.functions.invoke("chat-assistant", {
    body: { action: "coach-observe-polish", coach_id: v.coach, memo: v.memo, marks: v.marks, branch: v.branch },
  });
  if (error) throw new Error("오삼코치가 지금 바빠요. 잠시 뒤 다시 눌러 주세요");
  const d = (data ?? {}) as Partial<PolishResult> & { error?: string };
  if (d.error) throw new Error(d.error);
  if (!d.good1 || !d.fix1) throw new Error("다듬은 글을 받지 못했어요");
  return { good1: d.good1, good2: d.good2 ?? "", fix1: d.fix1, fix_no: typeof d.fix_no === "number" ? d.fix_no : null };
}
