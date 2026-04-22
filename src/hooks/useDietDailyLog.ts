/**
 * 153 다이어트 — 일일 로그 훅.
 *
 * 제공
 *   • useTodayDailyLog(enrollmentId, date) — 해당 날짜 로그 조회
 *   • useDailyLogPhotos(logId) — 해당 로그의 사진 리스트
 *   • useRecentLogs(enrollmentId, limit) — 최근 21일 타임라인용
 *   • useSubmitDailyLog() — 제출/업서트 뮤테이션
 *   • useUploadMealPhoto() — Storage 업로드 + RPC 연결
 *   • 로컬 임시저장 유틸 (loadDraft/saveDraft/clearDraft)
 *
 * 네트워크 실패 방어
 *   • React Query 는 기본 retry 1 (App 루트 설정) 를 사용.
 *   • 사진 업로드는 슬롯 단위 독립 mutation — 한 장 실패해도 다른 슬롯 유지.
 *   • 임시저장은 localStorage 에 date 별 드래프트 보관.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import * as diet from "@/services/dietService";
import type { DailyHabitsPayload } from "@/services/dietService";

// ──────────────────────────────────────────────────────────────────
// 조회
// ──────────────────────────────────────────────────────────────────

export function useTodayDailyLog(
  enrollmentId: string | undefined,
  logDate: string,
) {
  return useQuery({
    queryKey: ["diet", "dailyLog", enrollmentId, logDate],
    enabled: !!enrollmentId && !!logDate,
    staleTime: 15_000,
    queryFn: async () =>
      enrollmentId ? diet.fetchDailyLog(enrollmentId, logDate) : null,
  });
}

export function useDailyLogPhotos(logId: string | null | undefined) {
  return useQuery({
    queryKey: ["diet", "dailyLogPhotos", logId],
    enabled: !!logId,
    staleTime: 30_000,
    queryFn: async () => (logId ? diet.fetchLogPhotos(logId) : []),
  });
}

/**
 * 최근 N 일 로그 목록. status 무관 — UI 측에서 approved/pending/누락 구분.
 */
export function useRecentLogs(enrollmentId: string | undefined, days = 21) {
  return useQuery({
    queryKey: ["diet", "recentLogs", enrollmentId, days],
    enabled: !!enrollmentId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!enrollmentId) return [];
      const { data, error } = await supabase
        .from("diet_daily_logs")
        .select("*")
        .eq("enrollment_id", enrollmentId)
        .order("log_date", { ascending: false })
        .limit(days);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// 뮤테이션
// ──────────────────────────────────────────────────────────────────

interface SubmitDailyLogInput {
  logDate: string;
  habits: DailyHabitsPayload;
  note?: string | null;
}

export function useSubmitDailyLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitDailyLogInput) => diet.submitDailyLog(input),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ["diet", "dailyLog"] });
      qc.invalidateQueries({ queryKey: ["diet", "recentLogs"] });
      qc.invalidateQueries({ queryKey: ["diet", "progress"] });
      // photos 도 함께 갱신 (해당 date 의 log 가 새로 생긴 경우)
      qc.invalidateQueries({ queryKey: ["diet", "dailyLogPhotos"] });
      void variables;
    },
  });
}

interface UploadMealPhotoInput {
  userId: string;
  logId: string;
  logDate: string;
  mealSlot: "breakfast" | "lunch" | "dinner" | "snack";
  file: Blob | File;
}

/**
 * 한 장의 사진 업로드 → RPC 로 DB 연결까지 원샷.
 * 반환: 성공 시 path, 실패 시 에러 문자열.
 */
export function useUploadMealPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UploadMealPhotoInput) => {
      const up = await diet.uploadDietPhoto({
        userId: input.userId,
        blob: input.file,
        logDate: input.logDate,
        mealSlot: input.mealSlot,
      });
      if (!up.success) throw new Error(up.error);
      const add = await diet.addLogPhoto({
        logId: input.logId,
        storagePath: up.path,
        mealSlot: input.mealSlot,
      });
      if (!add.success) throw new Error(add.error);
      return { photoId: add.photo_id, storagePath: up.path };
    },
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ["diet", "dailyLogPhotos", variables.logId] });
    },
  });
}

// ──────────────────────────────────────────────────────────────────
// 로컬 임시저장
// ──────────────────────────────────────────────────────────────────

const DRAFT_KEY_PREFIX = "diet_tracker_draft_v1";

export interface DietTrackerDraft {
  habits: DailyHabitsPayload;
  note: string;
}

const draftKey = (userId: string, logDate: string) =>
  `${DRAFT_KEY_PREFIX}_${userId}_${logDate}`;

export function loadTrackerDraft(
  userId: string,
  logDate: string,
): DietTrackerDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId, logDate));
    if (raw) return JSON.parse(raw) as DietTrackerDraft;
  } catch {
    // 파싱 실패 시 드래프트 없음으로 취급 — UI 는 기본값으로 로드
  }
  return null;
}

export function saveTrackerDraft(
  userId: string,
  logDate: string,
  draft: DietTrackerDraft,
) {
  try {
    localStorage.setItem(draftKey(userId, logDate), JSON.stringify(draft));
  } catch {
    // storage quota 초과 등 — UI state 는 메모리에서 유지됨
  }
}

export function clearTrackerDraft(userId: string, logDate: string) {
  try {
    localStorage.removeItem(draftKey(userId, logDate));
  } catch {
    // storage 접근 실패해도 로그인/로그아웃 시 자연 정리
  }
}
