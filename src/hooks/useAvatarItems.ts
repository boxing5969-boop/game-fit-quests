import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useAvatarCategories = () => {
  return useQuery({
    queryKey: ["avatar-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_item_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
};

export const useAvatarItems = (categoryCode?: string) => {
  return useQuery({
    queryKey: ["avatar-items", categoryCode],
    queryFn: async () => {
      let query = supabase
        .from("avatar_items")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (categoryCode) {
        query = query.eq("category_code", categoryCode);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
};

export const useOwnedItems = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["owned-items", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_owned_items")
        .select("*, avatar_items(*)")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data;
    },
  });
};

export const useEquippedItems = (userId?: string) => {
  const { user } = useAuth();
  const targetId = userId || user?.id;
  
  return useQuery({
    queryKey: ["equipped-items", targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_avatar_equipment")
        .select("*, avatar_items(*)")
        .eq("user_id", targetId!);
      if (error) throw error;
      return data;
    },
  });
};

export const useEquipItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.rpc("equip_avatar_item", { _item_id: itemId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipped-items"] });
    },
  });
};

export const useUnequipItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categoryCode: string) => {
      const { error } = await supabase.rpc("unequip_avatar_item", { _category_code: categoryCode });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipped-items"] });
    },
  });
};
