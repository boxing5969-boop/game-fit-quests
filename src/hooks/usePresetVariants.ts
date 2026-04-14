import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PresetVariant {
  id: string;
  preset_style: string;
  category_code: string;
  option_key: string;
  asset_url: string | null;
  anchor_x: number;
  anchor_y: number;
  scale: number;
  rotation: number;
  z_order: number;
  is_active: boolean;
  preview_order: number;
}

/** Fetch all active variants for a specific preset style */
export const usePresetVariants = (presetStyle?: string) => {
  return useQuery({
    queryKey: ["preset-variants", presetStyle],
    enabled: !!presetStyle,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("preset_customization_variants")
        .select("*")
        .eq("preset_style", presetStyle!)
        .eq("is_active", true)
        .order("preview_order");
      if (error) throw error;
      return (data || []) as PresetVariant[];
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
};

/** Get available categories for a preset */
export function getVariantCategories(variants: PresetVariant[]): string[] {
  const cats = new Set(variants.map(v => v.category_code));
  return Array.from(cats);
}

/** Get options for a specific category within a preset's variants */
export function getVariantOptions(variants: PresetVariant[], categoryCode: string): PresetVariant[] {
  return variants.filter(v => v.category_code === categoryCode);
}

/** Find a specific variant by category + option key */
export function findVariant(
  variants: PresetVariant[],
  categoryCode: string,
  optionKey: string
): PresetVariant | undefined {
  return variants.find(v => v.category_code === categoryCode && v.option_key === optionKey);
}

/** Category display metadata */
export const VARIANT_CATEGORY_META: Record<string, { label: string; icon: string }> = {
  gloves: { label: "글러브", icon: "🥊" },
  accessory: { label: "액세서리", icon: "🎭" },
};

/** Option display labels */
export const VARIANT_OPTION_LABELS: Record<string, string> = {
  glove_red: "레드 글러브",
  glove_blue: "블루 글러브",
  glove_gold: "골드 글러브",
  glove_black: "블랙 글러브",
  sunglasses: "선글라스",
  crown: "왕관",
  headband_red: "레드 머리띠",
  bandage: "반창고",
};
