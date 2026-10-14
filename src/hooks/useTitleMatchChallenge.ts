/**
 * 🏆 타이틀매치 도전 — 상태 읽기 · 회원 신청/취소 · 지점장 도전 기록(영상 올리기) (2026-10-14 대표님).
 *
 * 서버 함수가 정본이다 (get_title_match_state · request_title_match_review · cancel_title_match_request ·
 * record_title_match_attempt). 영상은 비공개 저장소 title-match-videos 에 올리고, 볼 때는 1시간짜리 서명 주소를 받는다.
 * 쿼리키는 다른 화면 캐시와 겹치지 않게 153title: 로 시작한다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  TITLE_VIDEO_MAX_BYTES,
  formatMb,
  parseTitleMatchState,
  titleVideoPath,
  type TitleMatchState,
} from "@/lib/titleMatchChallenge";

export const TITLE_STATE_KEY = "153title:state";
export const TITLE_VIDEO_BUCKET = "title-match-videos";

// 새 함수들은 types.ts 재생성 전 — 기존 파일들과 같은 캐스트 패턴
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args ?? {});

const errMessage = (e: unknown, fallback: string) => {
  const m = (e as { message?: string } | null)?.message;
  return m && m.trim() ? m : fallback;
};

/** 내 상태(memberId 없음) 또는 지점장이 보는 회원 상태 */
export function useTitleMatchState(memberId?: string | null, enabled = true) {
  const { user } = useAuth();
  const target = memberId ?? user?.id ?? null;
  return useQuery({
    queryKey: [TITLE_STATE_KEY, target],
    enabled: enabled && !!user?.id && !!target,
    staleTime: 30_000,
    queryFn: async (): Promise<TitleMatchState | null> => {
      const { data, error } = await rpc("get_title_match_state", memberId ? { _member_id: memberId } : {});
      if (error) throw error;
      return parseTitleMatchState(data);
    },
  });
}

/** 신청·기록 뒤 다시 물어볼 것들 — 타이틀 상태 · 심사함 · 승급 진행도 · 내 레벨 상태 */
function useInvalidateTitle() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: [TITLE_STATE_KEY] });
    void qc.invalidateQueries({ queryKey: ["level-review-queue"] });
    void qc.invalidateQueries({ queryKey: ["level-review-checklist"] });
    void qc.invalidateQueries({ queryKey: ["level-cycle"] });
    void qc.invalidateQueries({ queryKey: ["my-level-status"] });
    void qc.invalidateQueries({ queryKey: ["member-progress"] });
  };
}

/** 회원: 지점장님께 심사 신청 */
export function useRequestTitleMatch() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = useInvalidateTitle();
  return useMutation({
    mutationFn: async (): Promise<TitleMatchState | null> => {
      const { data, error } = await rpc("request_title_match_review");
      if (error) throw new Error(errMessage(error, "신청하지 못했어요 — 잠시 후 다시 눌러 주세요"));
      return parseTitleMatchState(data);
    },
    onSuccess: (state) => {
      if (state && user?.id) qc.setQueryData([TITLE_STATE_KEY, user.id], state);
      invalidate();
    },
  });
}

/** 회원: 신청 취소 (도전 기록이 없을 때만 — 서버가 확인) */
export function useCancelTitleMatch() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const invalidate = useInvalidateTitle();
  return useMutation({
    mutationFn: async (): Promise<TitleMatchState | null> => {
      const { data, error } = await rpc("cancel_title_match_request");
      if (error) throw new Error(errMessage(error, "취소하지 못했어요 — 잠시 후 다시 눌러 주세요"));
      return parseTitleMatchState(data);
    },
    onSuccess: (state) => {
      if (state && user?.id) qc.setQueryData([TITLE_STATE_KEY, user.id], state);
      invalidate();
    },
  });
}

export interface RecordAttemptInput {
  memberId: string;
  video: Blob;
  contentType: string;
  passed: boolean;
  note?: string | null;
}

export interface RecordAttemptResult {
  result: "passed" | "failed" | "failed_final";
  attemptNo: number;
  maxAttempts: number;
  attemptsLeft?: number;
  retryAt?: string;
  promotion?: { ranked_up?: boolean; new_rank?: string; new_level?: number; fast_track?: boolean };
}

/** 지점장·관장: 영상 올리기 → 도전 기록 (합격이면 서버가 바로 승급까지) */
export function useRecordTitleAttempt() {
  const invalidate = useInvalidateTitle();
  return useMutation({
    mutationFn: async (input: RecordAttemptInput): Promise<RecordAttemptResult> => {
      if (input.video.size > TITLE_VIDEO_MAX_BYTES) {
        throw new Error(`영상이 너무 커요 (${formatMb(input.video.size)}) — 50MB까지예요. 앱으로 촬영하면 작게 저장돼요`);
      }
      // 올리기 전에 지금 상태를 한 번 더 — 다른 분이 이미 합격·마감 처리했으면 큰 영상을 헛되이 올리지 않는다
      const pre = await rpc("get_title_match_state", { _member_id: input.memberId });
      if (pre.error) throw new Error(errMessage(pre.error, "회원 상태를 확인하지 못했어요 — 다시 눌러 주세요"));
      const now = parseTitleMatchState(pre.data);
      if (!now || !now.isTitleLevel || !now.flowEnabled) throw new Error("이 회원은 지금 화이트 타이틀매치 심사 대상이 아니에요");
      if (now.cleared) throw new Error("이미 통과한 타이틀매치예요");
      const open = now.challenge?.status === "requested" ? now.challenge : null;
      if (!open && now.retryAt) throw new Error(`도전 ${now.maxAttempts}번이 끝나 지금은 기록할 수 없어요 — 화면을 새로고침해 주세요`);
      if (open && open.attempts.length >= now.maxAttempts) throw new Error("도전 횟수를 모두 썼어요 — 화면을 새로고침해 주세요");
      const path = titleVideoPath(input.memberId, input.contentType);
      // supabase-js 는 Blob 본문이면 contentType 옵션 대신 Blob 자신의 형식을 보낸다 — 형식이 비었거나
      // 다른 이름(예: 빈 문자열 · application/octet-stream)이면 저장소가 거절하므로 맞춘 형식으로 다시 감싼다
      const body = input.video.type === input.contentType ? input.video : new Blob([input.video], { type: input.contentType });
      const up = await supabase.storage
        .from(TITLE_VIDEO_BUCKET)
        .upload(path, body, { contentType: input.contentType, upsert: false, cacheControl: "3600" });
      if (up.error) {
        const m = up.error.message || "";
        if (/exceed|too large|size/i.test(m)) throw new Error("영상이 너무 커요 — 50MB까지예요. 앱으로 촬영하면 작게 저장돼요");
        throw new Error(`영상을 올리지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요 (${m || "업로드 실패"})`);
      }
      const { data, error } = await rpc("record_title_match_attempt", {
        _member_id: input.memberId,
        _video_path: path,
        _passed: input.passed,
        _note: input.note?.trim() || null,
      });
      if (error) throw new Error(errMessage(error, "결과를 저장하지 못했어요 — 다시 눌러 주세요"));
      return data as RecordAttemptResult;
    },
    onSettled: () => invalidate(),
  });
}

/** 도전 영상 보기 — 1시간짜리 서명 주소 (회원 본인 · 지점장 · 관장만 받을 수 있다) */
export async function getTitleVideoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(TITLE_VIDEO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error("영상을 열 수 없어요 — 잠시 후 다시 눌러 주세요");
  return data.signedUrl;
}
