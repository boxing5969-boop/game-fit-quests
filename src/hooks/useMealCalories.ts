/**
 * 153 다이어트 · 식단 사진 칼로리 추정 훅.
 *
 *   useAnalyzeMealPhoto()   사진 → AI 추정 결과 (저장 안 함)
 *   useConfirmMealCalories() 회원이 확인·수정한 값 저장 (여기서 오늘 합계에 잡힘)
 *
 * 분석과 저장을 나눈 이유: AI 추정값이 그대로 기록되면 안 되기 때문이다.
 * 회원이 화면에서 확인하고 확정을 눌러야 오늘 섭취량으로 인정한다.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  analyzeMealPhotoVision,
  confirmMealCalories,
  type MealVisionErrorCode,
} from "@/services/dietService";
import type {
  MealConfidence,
  MealKcalSource,
  MealVisionItem,
  MealVisionResponse,
} from "@/lib/diet/mealCalories";
import type { DietMealSlot } from "@/lib/dietTrack";

/** 회원에게 그대로 보여줘도 되는 문장으로 바꾼다. 원인을 탓하지 않는 톤. */
export const VISION_ERROR_MESSAGE: Record<MealVisionErrorCode, string> = {
  not_authenticated: "로그인이 풀렸어요. 다시 들어와 주세요.",
  daily_limit: "오늘 사진 분석을 많이 하셨어요. 내일 다시 열립니다.",
  image_too_large: "사진 용량이 커요. 한 번만 다시 찍어주세요.",
  invalid_image: "사진을 읽지 못했어요. 한 번만 다시 찍어주세요.",
  vision_unavailable: "지금은 사진 분석이 어려워요. 잠시 뒤 다시 시도해 주세요.",
  unknown: "지금은 사진 분석이 어려워요. 잠시 뒤 다시 시도해 주세요.",
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("invalid_image"));
    reader.onload = () => {
      const out = reader.result;
      if (typeof out === "string") resolve(out);
      else reject(new Error("invalid_image"));
    };
    reader.readAsDataURL(blob);
  });
}

export interface AnalyzeMealInput {
  blob: Blob;
  mealSlot: DietMealSlot;
}

export function useAnalyzeMealPhoto() {
  return useMutation<MealVisionResponse, Error, AnalyzeMealInput>({
    mutationFn: async ({ blob, mealSlot }) => {
      const imageDataUrl = await blobToDataUrl(blob);
      const localTime = new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Seoul",
      });
      const res = await analyzeMealPhotoVision({ imageDataUrl, mealSlot, localTime });
      if (!res.success) throw new Error(res.error);
      return res.vision;
    },
  });
}

export interface ConfirmMealInput {
  photoId: string;
  logId?: string;
  items: MealVisionItem[];
  totalKcal: number;
  totalProteinG: number;
  source: MealKcalSource;
  confidence?: MealConfidence | null;
  category?: "good" | "normal" | "adjust" | null;
  feedback?: string | null;
  detectedTags?: string[] | null;
  provider?: string | null;
}

export function useConfirmMealCalories() {
  const qc = useQueryClient();
  return useMutation<{ total_kcal: number }, Error, ConfirmMealInput>({
    mutationFn: async (input) => {
      const res = await confirmMealCalories(input);
      if (!res.success) throw new Error(res.error);
      return { total_kcal: res.total_kcal };
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ["diet", "myPhotos"] });
      qc.invalidateQueries({ queryKey: ["diet", "dailyLog"] });
      qc.invalidateQueries({ queryKey: ["diet", "dailyLogPhotos"] });
      if (vars.logId) {
        qc.invalidateQueries({ queryKey: ["diet", "dailyLogPhotos", vars.logId] });
      }
    },
  });
}
