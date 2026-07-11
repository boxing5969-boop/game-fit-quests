/**
 * 153 다이어트 · 식단 사진 AI 분석 훅.
 *
 * 역할:
 *   1. analyzeMealPhoto(input) 실행 → 결과 받아옴 (현재 rules-based 폴백)
 *   2. save_diet_photo_analysis RPC 로 DB 업데이트
 *   3. React Query 캐시 무효화 (갤러리·트래커 자동 갱신)
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveMealPhotoAnalysis } from "@/services/dietService";
import {
  analyzeMealPhoto,
  type AnalyzeInput,
  type AnalyzeResult,
} from "@/lib/diet/mealAnalyzer";

export interface AnalyzeAndSaveInput {
  photoId: string;
  imageSource?: string;
  storageKey?: string;
  uploadedAt?: Date;
  userSlot?: "breakfast" | "lunch" | "dinner" | "snack";
}

export function useMealPhotoAnalysis() {
  const qc = useQueryClient();
  return useMutation<AnalyzeResult, Error, AnalyzeAndSaveInput>({
    mutationFn: async (input) => {
      const analyzeInput: AnalyzeInput = {
        imageSource: input.imageSource,
        storageKey: input.storageKey,
        uploadedAt: input.uploadedAt,
        userSlot: input.userSlot,
      };
      const result = await analyzeMealPhoto(analyzeInput);

      // DB 저장 — 실패해도 결과는 반환 (UX 끊기지 않게)
      try {
        await saveMealPhotoAnalysis({
          photoId: input.photoId,
          category: result.category,
          feedback: result.feedback,
          detectedTags: result.detectedTags,
          provider: result.provider,
        });
      } catch {
        // best-effort — 마이그레이션 미반영 등으로 실패해도 UI 는 결과 표시
      }

      return result;
    },
    onSuccess: () => {
      // 갤러리·오늘 로그 자동 갱신
      qc.invalidateQueries({ queryKey: ["diet", "myPhotos"] });
      qc.invalidateQueries({ queryKey: ["diet", "dailyLog"] });
      qc.invalidateQueries({ queryKey: ["diet", "dailyLogPhotos"] });
    },
  });
}
