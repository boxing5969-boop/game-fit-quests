/**
 * 153 레코드 — 153복싱짐의 '최초' 기록 + 153 체력테스트 신기록 (2026-10-15 대표님)
 * DB: supabase/migrations/20261015170000_records_153.sql (get_153_records)
 *   · firsts — 한 번 새겨지면 바뀌지 않는 최초 기록
 *   · bests  — 챌린지 아레나 체력 종목별 지금 최고 기록 (계속 바뀜)
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export interface Record153First {
  key: string;
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  branch_name: string | null;
  achieved_at: string;
  value: number | null;
  is_me: boolean;
}

export interface Record153Best {
  code: string;
  category: string;
  title: string;
  metric: string | null;
  user_id: string | null;
  nickname: string | null;
  value: number | null;
  achieved_at: string | null;
  is_me: boolean | null;
}

export interface Records153 {
  firsts: Record153First[];
  bests: Record153Best[];
  members: number;
}

export const RECORDS_153_KEY = ["records-153"] as const;

export async function getRecords153(): Promise<Records153> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_153_records");
  if (error) throw new Error(translateError(error));
  const d = (data ?? {}) as Partial<Records153>;
  return { firsts: d.firsts ?? [], bests: d.bests ?? [], members: Number(d.members ?? 0) };
}

export function useRecords153(enabled = true) {
  return useQuery({ queryKey: RECORDS_153_KEY, queryFn: getRecords153, enabled, staleTime: 60_000 });
}
