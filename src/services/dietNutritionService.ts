/**
 * 153 다이어트 · 영양 프로필 서비스 레이어.
 *
 * 마이그레이션 20260502000000 의 upsert/get RPC 래퍼.
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  ActivityLevel,
  Sex,
} from "@/lib/diet/nutritionEngine";

export interface DietNutritionProfileRow {
  user_id: string;
  sex: Sex | null;
  height_cm: number | null;
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: ActivityLevel;
  dietary_restrictions: string[];
  disliked_ingredients: string[];
  meals_per_day: number;
  created_at: string;
  updated_at: string;
}

export interface NutritionProfilePayload {
  has_profile: boolean;
  age: number;
  profile?: DietNutritionProfileRow;
}

type RpcOk<T> = { success: true } & T;
type RpcErr = { success: false; error: string };
type RpcResult<T> = RpcOk<T> | RpcErr;

const err = (e: string): RpcErr => ({ success: false, error: e });
const asRpc = <T>(data: unknown): RpcResult<T> => {
  if (!data || typeof data !== "object") return err("unexpected_response");
  return data as RpcResult<T>;
};

export async function getNutritionProfile(
  userId?: string,
): Promise<RpcResult<NutritionProfilePayload>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_nutrition_profile", {
    _user_id: userId ?? null,
  });
  if (error) return err(error.message);
  return asRpc<NutritionProfilePayload>(data);
}

export interface UpsertNutritionProfileInput {
  sex?: Sex | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  activityLevel?: ActivityLevel;
  dietaryRestrictions?: string[];
  dislikedIngredients?: string[];
  mealsPerDay?: 2 | 3 | 4;
}

export async function upsertNutritionProfile(
  input: UpsertNutritionProfileInput,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("upsert_nutrition_profile", {
    _sex: input.sex ?? null,
    _height_cm: input.heightCm ?? null,
    _weight_kg: input.weightKg ?? null,
    _target_weight_kg: input.targetWeightKg ?? null,
    _activity_level: input.activityLevel ?? null,
    _dietary_restrictions: input.dietaryRestrictions ?? null,
    _disliked_ingredients: input.dislikedIngredients ?? null,
    _meals_per_day: input.mealsPerDay ?? 3,
  });
  if (error) return err(error.message);
  return asRpc<Record<string, never>>(data);
}
