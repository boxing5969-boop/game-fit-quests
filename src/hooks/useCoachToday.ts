/**
 * 🥊 오삼코치 '오늘의 목표' — 캐릭터 탭 내 카드 안 (2026-10-15 대표님 결정: 홈 MY복서 카드는 그대로, 내 카드 안에).
 *
 * 서버가 정본 — get_my_coach_today(): 오늘 실제로 보낸 오늘의 목표(또는 복귀 응원) 한 개, 없으면 null.
 * 알림을 눌러 /character-studio?coach=<id> 로 들어오면 coach_mark_opened(id) 로 한 번 기록한다
 * (보조 지표: 오삼코치 푸시로 앱을 연 비율). 기록은 실패해도 화면에는 영향 없다.
 */
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { kstToday } from "@/lib/levelPractice";

export type CoachToday = {
  id: string;
  kind: "daily_goal" | "comeback";
  title: string;
  body: string;
  detail: string;
  sent_at: string | null;
};

// 새 함수들은 types.ts 재생성 전 — 기존 파일들과 같은 캐스트 패턴
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown> = {}) => (supabase.rpc as any)(name, args);

const parse = (d: unknown): CoachToday | null => {
  if (!d || typeof d !== "object") return null;
  const o = d as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.body !== "string") return null;
  return {
    id: o.id,
    kind: o.kind === "comeback" ? "comeback" : "daily_goal",
    title: typeof o.title === "string" ? o.title : "",
    body: o.body,
    detail: typeof o.detail === "string" ? o.detail : "",
    sent_at: typeof o.sent_at === "string" ? o.sent_at : null,
  };
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCoachToday() {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [params] = useSearchParams();
  const openedId = params.get("coach");
  const marked = useRef<string | null>(null);

  // 알림을 눌러 들어왔으면 한 번 기록
  useEffect(() => {
    if (!uid || !openedId || !UUID_RE.test(openedId) || marked.current === openedId) return;
    marked.current = openedId;
    void rpc("coach_mark_opened", { _id: openedId }).then(
      () => undefined,
      () => undefined,
    );
  }, [uid, openedId]);

  return useQuery({
    queryKey: ["coach-today", uid, kstToday()],
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("get_my_coach_today");
      if (error) throw error;
      return parse(data);
    },
  });
}
