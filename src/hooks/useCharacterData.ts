import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { CharacterCustomization } from "@/data/characterCustomizationData";
import type { PartsSelection } from "@/data/characterPartsData";

export const useCharacterPresets = () => {
  return useQuery({
    queryKey: ["character-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("character_presets")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
};

export const useTemplatePresets = () => {
  return useQuery({
    queryKey: ["character-presets", "templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("character_presets")
        .select("*")
        .eq("is_template", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
};

export const useMemberCharacterAssignment = (userId?: string) => {
  const { user } = useAuth();
  const targetId = userId || user?.id;

  return useQuery({
    queryKey: ["character-assignment", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_character_assignments")
        .select("*, character_presets(*)")
        .eq("user_id", targetId!)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
};

export const useAllCharacterAssignments = () => {
  return useQuery({
    queryKey: ["character-assignments-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_character_assignments")
        .select("*, character_presets(*)")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });
};

export const useAssignCharacter = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, presetId }: { userId: string; presetId: string }) => {
      const { error } = await supabase
        .from("member_character_assignments")
        .upsert(
          { user_id: userId, preset_id: presetId, is_active: true, display_mode: "sprite" },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["character-assignment"] });
      qc.invalidateQueries({ queryKey: ["character-assignments-all"] });
    },
  });
};

export const useSavePreset = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, partsJson }: { name: string; partsJson: Record<string, any> }) => {
      const { data, error } = await supabase
        .from("character_presets")
        .insert({
          name,
          parts_json: partsJson,
          created_by: user?.id,
          is_template: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["character-presets"] });
    },
  });
};

export const useSaveCustomPreset = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ name, partsJson }: { name: string; partsJson: Record<string, any> }) => {
      const { data, error } = await supabase
        .from("character_presets")
        .insert({
          name,
          parts_json: partsJson,
          created_by: user?.id,
          is_template: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["character-presets"] });
      qc.invalidateQueries({ queryKey: ["character-assignment"] });
    },
  });
};

/**
 * Save customization overlay on top of existing preset style.
 * Updates the preset's parts_json to include customization data,
 * then assigns it to the user.
 */
/**
 * Customization save path (Step 7 — server-validated).
 *
 * Calls save_member_customization RPC which:
 *   1. Validates every (category, itemKey) in `customization` against
 *      get_customization_required_level + get_caller_user_level.
 *   2. Upserts character_presets (personal slot) and
 *      member_character_assignments atomically.
 *
 * A BEFORE INSERT/UPDATE trigger on character_presets also re-validates,
 * so direct table writes from any other code path are equally blocked.
 *
 * Structured error contract (RPC returns success=false with):
 *   • level_locked         — carries { category, item_key, required_level, current_level }
 *   • not_authenticated    — no session
 */
export const useSaveCustomization = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      style,
      customization,
    }: {
      style: string;
      customization: CharacterCustomization;
    }) => {
      if (!user?.id) throw new Error("로그인이 필요합니다");

      const { data, error } = await supabase.rpc(
        "save_member_customization" as any,
        {
          _style: style,
          _customization: customization as unknown as Record<string, unknown>,
        },
      );
      if (error) {
        // Trigger-level rejection (direct-write bypass attempts) surfaces
        // as a check_violation. Give the same human-readable message as
        // the RPC's structured path.
        if (error.code === "23514" || error.message?.includes("level_locked")) {
          throw new Error("레벨이 부족한 아이템이 포함되어 있어 저장할 수 없어요");
        }
        throw error;
      }

      const result = (data ?? {}) as {
        success: boolean;
        error?: string;
        category?: string;
        item_key?: string;
        required_level?: number;
        current_level?: number;
        preset_id?: string;
      };

      if (!result.success) {
        if (result.error === "level_locked") {
          throw new Error(
            `레벨 ${result.required_level ?? 0} 달성 시 해금됩니다`,
          );
        }
        if (result.error === "not_authenticated") {
          throw new Error("로그인이 필요합니다");
        }
        throw new Error(result.error ?? "저장 실패");
      }

      return { presetId: result.preset_id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["character-assignment"] });
      qc.invalidateQueries({ queryKey: ["character-assignments-all"] });
      qc.invalidateQueries({ queryKey: ["character-presets"] });
    },
  });
};

export const useSaveParts = () => {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ parts }: { parts: PartsSelection }) => {
      if (!user?.id) throw new Error("로그인이 필요합니다");

      const partsJson = { parts } as unknown as Record<string, any>;

      const { data: existing } = await supabase
        .from("character_presets")
        .select("id")
        .eq("created_by", user.id)
        .eq("is_template", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let presetId: string;

      if (existing) {
        const { error } = await supabase
          .from("character_presets")
          .update({ parts_json: partsJson as any, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
        presetId = existing.id;
      } else {
        const { data: newPreset, error } = await supabase
          .from("character_presets")
          .insert([{
            name: `${user.id}_parts`,
            parts_json: partsJson as any,
            created_by: user.id,
            is_template: false,
          }])
          .select()
          .single();
        if (error) throw error;
        presetId = newPreset.id;
      }

      const { error: assignError } = await supabase
        .from("member_character_assignments")
        .upsert(
          { user_id: user.id, preset_id: presetId, is_active: true, display_mode: "layered" },
          { onConflict: "user_id" }
        );
      if (assignError) throw assignError;

      return { presetId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["character-assignment"] });
      qc.invalidateQueries({ queryKey: ["character-assignments-all"] });
      qc.invalidateQueries({ queryKey: ["character-presets"] });
    },
  });
};
