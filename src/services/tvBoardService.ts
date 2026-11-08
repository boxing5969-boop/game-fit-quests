/**
 * 📺 라이브보드 TV 화면 바꾸기 — 관리자 앱 쪽 (2026-11-08 · supabase/migrations/20261108192720_tv_board_modes.sql)
 *   get_tv_board_modes(지점) · set_tv_board_mode(지점, TV 번호, 화면) — 그 지점 운영진만 (서버가 거른다).
 *   생성된 타입에 아직 없어서 (supabase as any) 로 부른다.
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizeTvModes, type TvModeSetting, type TvSlot, type TvSlotState } from "@/lib/tvRemote";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export const fetchTvModes = async (branch: string): Promise<TvSlotState[]> => {
  const { data, error } = await sb.rpc("get_tv_board_modes", { p_branch: branch });
  if (error) throw error;
  return normalizeTvModes(data);
};

export const setTvMode = async (branch: string, slot: TvSlot, mode: TvModeSetting): Promise<TvSlotState[]> => {
  const { data, error } = await sb.rpc("set_tv_board_mode", { p_branch: branch, p_slot: slot, p_mode: mode });
  if (error) throw error;
  return normalizeTvModes(data);
};
