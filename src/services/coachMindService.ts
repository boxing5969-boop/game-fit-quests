/**
 * 🧭 153 코치 성향 카드 · 맞춤 피드백 — 훅 · 뮤테이션 (["coach153", "mind", …] 캐시 — 153 기준 캐시와 같이 새로 읽힌다)
 *   서버: coach_mind_state · coach_mind_save · coach_mind_clear · coach_mind_ask · coach_note_send · coach_note_seen
 *         · coach_note_ack · coach_note_remove (20261105124544_coach_mind.sql)
 *   오삼코치: Edge Function coach-mind — summary(내 카드 요약) · core(메모 → 공통 기준) · tailor(코치님마다 맞춘 글). 저장은 화면이 함수로
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type { CoachMindState, MindAnswers, MindSummary, NoteBody, NoteCore } from "@/lib/coachMind";
import { COACH153_KEY } from "@/services/coachGrowthService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

export const useCoachMindState = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...COACH153_KEY, "mind", branch],
    enabled,
    staleTime: 20_000,
    queryFn: () => call<CoachMindState>("coach_mind_state", { p_branch: branch }, "성향 카드를 불러오지 못했어요"),
  });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: COACH153_KEY });
};

export interface MindSaveInput {
  answers: MindAnswers;
  mbti: string | null;
  mbtiSource: "test" | "guess" | null;
  notePower: string;
  noteKnow: string;
  consent: boolean;
}

export const useSaveMind = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: MindSaveInput) =>
      call<unknown>(
        "coach_mind_save",
        {
          p_answers: v.answers,
          p_mbti: v.mbti,
          p_mbti_source: v.mbtiSource,
          p_note_power: v.notePower,
          p_note_know: v.noteKnow,
          p_consent: v.consent,
        },
        "성향 카드를 저장하지 못했어요",
      ),
    onSuccess: done,
  });
};

export const useClearMind = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (coach: string | null) => call<void>("coach_mind_clear", { p_coach: coach }, "성향 카드를 지우지 못했어요"),
    onSuccess: done,
  });
};

export const useAskMind = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (branch: string | null) => call<number>("coach_mind_ask", { p_branch: branch }, "부탁을 보내지 못했어요"),
    onSuccess: done,
  });
};

export interface NoteSendItem {
  coach: string;
  body: NoteBody | null;
}

export const useSendNote = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: { branch: string | null; core: NoteCore; items: NoteSendItem[] }) =>
      call<string>("coach_note_send", { p_branch: v.branch, p_core: v.core, p_items: v.items }, "피드백을 보내지 못했어요"),
    onSuccess: done,
  });
};

export const useSeenNotes = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (ids: string[]) => call<number>("coach_note_seen", { p_ids: ids }, "읽음을 남기지 못했어요"),
    onSuccess: done,
  });
};

export const useAckNote = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (v: { id: string; reply?: string }) =>
      call<void>("coach_note_ack", { p_id: v.id, p_reply: v.reply ?? null }, "확인을 남기지 못했어요"),
    onSuccess: done,
  });
};

export const useRemoveNote = () => {
  const done = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("coach_note_remove", { p_note: id }, "피드백을 지우지 못했어요"),
    onSuccess: done,
  });
};

/* ───────────── 오삼코치 (Edge Function coach-mind) — 답은 늘 {ok, …} / {ok:false, error} ───────────── */

async function mind<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("coach-mind", { body });
  if (error) throw new Error("오삼코치가 지금 바빠요 — 잠시 뒤 다시 눌러 주세요");
  const d = (data ?? {}) as { ok?: boolean; error?: string } & T;
  if (!d.ok) throw new Error(d.error || "오삼코치가 지금 바빠요 — 잠시 뒤 다시 눌러 주세요");
  return d;
}

/** 내 성향 카드 → 전달 설명서 (서버가 내 카드에 저장한다) */
export const makeMindSummary = (branch: string | null) =>
  mind<{ summary: MindSummary; stale?: boolean }>({ action: "summary", branch });

/** 저장 뒤 요약 만들기 — 화면이 '정리하는 중'을 보여 줄 수 있게 뮤테이션으로 */
export const useMakeMindSummary = () => {
  const done = useInvalidate();
  return useMutation({ mutationFn: (branch: string | null) => makeMindSummary(branch), onSettled: done });
};

/** 대표님 메모 → 공통 기준 (저장하지 않는다) */
export const makeNoteCore = (text: string, branch: string | null) => mind<{ core: NoteCore }>({ action: "core", text, branch });

/** 공통 기준 → 그 코치님께 맞춘 글 (카드가 없으면 body null) */
export const makeNoteTailor = (coach: string, core: NoteCore, branch: string | null) =>
  mind<{ body: NoteBody | null; tailored: boolean }>({ action: "tailor", coach_id: coach, core, branch });
