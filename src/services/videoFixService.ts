/**
 * 🎬 영상 고쳐 주세요 — 읽기 · 보내기 (2026-11-17 · 서버 20261117112356_training_video_fix.sql)
 *
 *   · useVideoFixes — 대표님 · 운영진: 고쳐 달라고 한 것 · 숨긴 영상 · 클로드가 다시 만든 새 영상(확인 기다림)
 *       서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) available:false — 화면은 「이 장면 고쳐 달라기」를 그리지 않는다
 *   · useVideoFixActions — 고쳐 달라기 · 숨긴 영상 다시 보이기 · 그만두기 · 새 영상 붙이기/다시 고쳐 주세요
 *       카드 영상이 바뀌는 일(숨기기 · 붙이기)은 카드 목록(["training-library"])도 새로 읽는다
 *   · 클로드 쪽 답 · 새 영상 넣기는 SQL(_training_video_fix_reply · _training_video_candidate_add) — 앱은 부르지 않는다
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseVideoFixList, type VideoFixCat, type VideoFixData } from "@/lib/videoFix";
import { isTrainingDemo } from "@/services/trainingCardService";

export const VIDEO_FIX_KEY = ["training-library", "video-fix"] as const;

export interface VideoFixState {
  available: boolean;
  data: VideoFixData | null;
}

type RpcError = { code?: string; message?: string } | null;
const missingFn = (error: RpcError) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(error.message ?? ""));
const rpc = (fn: string, args?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: RpcError }> }).rpc(fn, args);

let listOff = false;

/** 대표님 · 운영진 — 이 계정이 고칠 수 있는지는 서버가 다시 본다(can_edit) */
export function useVideoFixes(enabled: boolean) {
  const demo = isTrainingDemo();
  return useQuery({
    queryKey: [...VIDEO_FIX_KEY, demo ? "demo" : "db"],
    enabled: enabled && !demo && !listOff,
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<VideoFixState> => {
      const { data, error } = await rpc("training_video_fix_list");
      if (error) {
        if (missingFn(error)) {
          listOff = true;
          return { available: false, data: null };
        }
        throw new Error(error.message ?? "영상 고칠 목록을 읽지 못했어요");
      }
      return { available: true, data: parseVideoFixList(data) };
    },
  });
}

const fail = (error: RpcError, fallback: string): never => {
  throw new Error(error?.message?.trim() || fallback);
};

export interface VideoFixInput {
  cardId: string;
  atSec: number;
  fromSec: number | null;
  toSec: number | null;
  motion: string;
  cat: VideoFixCat;
  body: string;
  hold: boolean;
}

export function useVideoFixActions() {
  const qc = useQueryClient();
  const refresh = (cards: boolean) => {
    void qc.invalidateQueries({ queryKey: VIDEO_FIX_KEY });
    if (cards) void qc.invalidateQueries({ queryKey: ["training-library", "cards"] });
  };
  return {
    /** 이 장면 고쳐 달라기 → { held } (숨겼으면 카드 영상이 빠졌다) */
    add: async (x: VideoFixInput): Promise<{ held: boolean }> => {
      const { data, error } = await rpc("training_video_fix_add", {
        p_card: x.cardId,
        p_at: Math.round(Math.max(0, x.atSec) * 100) / 100,
        p_from: x.fromSec,
        p_to: x.toSec,
        p_motion: x.motion,
        p_cat: x.cat,
        p_body: x.body,
        p_hold: x.hold,
      });
      if (error) fail(error, "보내지 못했어요 — 잠시 뒤 다시 눌러 주세요");
      const held = !!(data as { held?: boolean } | null)?.held;
      refresh(held);
      return { held };
    },
    /** 숨긴 영상 다시 보이기 */
    restore: async (fixId: string) => {
      const { error } = await rpc("training_video_fix_restore", { p_id: fixId });
      if (error) fail(error, "되돌리지 못했어요");
      refresh(true);
    },
    /** 요청 그만두기 — 숨긴 영상이 있으면 카드에 되돌린다 */
    cancel: async (fixId: string) => {
      const { error } = await rpc("training_video_fix_cancel", { p_id: fixId });
      if (error) fail(error, "그만두지 못했어요");
      refresh(true);
    },
    /** 새 영상 — 이대로 붙이기(ok) · 다시 고쳐 주세요(note) */
    decide: async (candidateId: string, ok: boolean, note: string) => {
      const { error } = await rpc("training_video_candidate_decide", { p_id: candidateId, p_ok: ok, p_note: note });
      if (error) fail(error, "정하지 못했어요");
      refresh(ok);
    },
  };
}
