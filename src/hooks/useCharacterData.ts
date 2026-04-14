import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
      // Upsert assignment
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
