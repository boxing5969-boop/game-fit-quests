/**
 * PT 수당 2단계 2-4 — 회원 확인 서버 함수 감싸기 (2026-11-16 · DB 20261116195750_ops_pt_member_check.sql)
 *   회원: pt_deduct_checks · pt_deduct_answer — 캐시 열쇠 ["153pt", "asks", …](PT 예약 회원 쪽과 같은 머리)
 *   코치 · 지점장 · 대표님: 목록은 PT 기록(useOpsPtRecord)과 함께 받는다 · 쓰기 = ops_pt_member_check_close · ops_pt_check_setting_set
 *   글 · 상태는 src/lib/opsPtCheck.ts — 여기는 읽고 쓰기만.
 *
 *   서버에 함수가 없으면(DB 적용 전 · 옛 DB 미리보기) 묻기가 없는 것으로 본다(회원 화면에 아무것도 안 나온다).
 *   예시 화면은 서버를 부르지 않는다 — 회원 `/home?ptdemo=1` · 코치 `/office?tab=work&demo=1`.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { translateError } from "@/lib/errorMessages";
import {
  applyPtAskDemo,
  buildPtAsksSample,
  normalizePtAsks,
  type PtCheckAnswer,
  type PtDeductAsk,
} from "@/lib/opsPtCheck";
import type { PtRecordData } from "@/lib/opsPtRecord";
import { applyPtDemo, type PtDemoAction } from "@/lib/opsPtRecordSample";
import { OPS_KEY } from "./opsService";
import { PT_KEY, isPtDemo } from "./ptBookingService";

const kstToday = (): string =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(),
  );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase.rpc as any)(name, args);

type RpcError = { code?: string; message?: string } | null;
/** 서버에 함수가 없다 — DB 적용 전 · 옛 DB 미리보기 */
const isMissingFn = (e: RpcError) =>
  !!e &&
  (e.code === "PGRST202" ||
    e.code === "42883" ||
    /could not find the function/i.test(e.message ?? ""));

async function call<T>(
  name: string,
  args: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback));
  return data as T;
}

// ───────────────────────── 회원 ─────────────────────────
const asksKey = (uid: string | null | undefined, demo: boolean) =>
  [...PT_KEY, "asks", demo ? "demo" : (uid ?? "anon")] as const;

/** 내 PT 차감 안내 — enabled 는 PT 회원이거나 알림 링크(/home?ptcheck=1)로 왔을 때만 */
export const usePtDeductAsks = (enabled: boolean) => {
  const { user } = useAuth();
  const demo = isPtDemo();
  return useQuery({
    queryKey: asksKey(user?.id, demo),
    enabled: demo || (enabled && !!user),
    staleTime: demo ? Infinity : 60_000,
    refetchInterval: demo ? false : 5 * 60_000,
    retry: false,
    queryFn: async (): Promise<PtDeductAsk[]> => {
      if (demo) return buildPtAsksSample(kstToday());
      const { data, error } = await rpc("pt_deduct_checks");
      if (error) {
        if (isMissingFn(error)) return [];
        throw new Error(
          translateError(error, "PT 차감 안내를 불러오지 못했어요"),
        );
      }
      return normalizePtAsks(data);
    },
  });
};

/** 답하기 — 「네, 맞아요」 · 「아니에요」(한 줄 메모 선택) */
export const usePtDeductAnswer = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const demo = isPtDemo();
  const key = asksKey(user?.id, demo);
  return useMutation({
    mutationFn: async (v: {
      id: string;
      answer: PtCheckAnswer;
      note?: string | null;
    }) => {
      if (demo) {
        qc.setQueryData(
          key,
          applyPtAskDemo(
            qc.getQueryData<PtDeductAsk[]>(key) ?? [],
            v.id,
            v.answer,
            v.note ?? null,
          ),
        );
        return;
      }
      await call<unknown>(
        "pt_deduct_answer",
        { p_id: v.id, p_answer: v.answer, p_note: v.note?.trim() || null },
        "답을 보내지 못했어요",
      );
    },
    onSuccess: () =>
      demo
        ? undefined
        : qc.invalidateQueries({ queryKey: [...PT_KEY, "asks"] }),
  });
};

// ───────────────────────── 코치 · 지점장 · 대표님 ─────────────────────────
/** 「아니에요」에 답하고 닫기(지점장 · 대표님) · 켜기 · 끄기(대표님) — 예시 화면은 이 기기 안의 예시 자료만 바꾼다 */
export const useOpsPtCheckActions = (
  branch: string | null,
  { demo = false }: { demo?: boolean } = {},
) => {
  const qc = useQueryClient();
  const done = () =>
    demo
      ? undefined
      : qc.invalidateQueries({ queryKey: [...OPS_KEY, "pt-record"] });
  // 예시는 코치 · 관리자 예시 자료 둘 다(useOpsPtRecord 예시 열쇠)
  const demoApply = (a: PtDemoAction) => {
    for (const manage of [true, false]) {
      const k = [...OPS_KEY, "pt-record", "demo", manage] as const;
      const cur = qc.getQueryData<PtRecordData>(k);
      if (cur) qc.setQueryData(k, applyPtDemo(cur, a));
    }
  };
  const close = useMutation({
    mutationFn: async (v: { id: string; reply: string }) => {
      if (demo)
        return demoApply({
          type: "checkClose",
          id: v.id,
          reply: v.reply.trim(),
        });
      await call<unknown>(
        "ops_pt_member_check_close",
        { p_id: v.id, p_reply: v.reply.trim() },
        "답을 보내지 못했어요",
      );
    },
    onSuccess: done,
  });
  const setOn = useMutation({
    mutationFn: async (on: boolean) => {
      if (demo) return demoApply({ type: "checkSet", on });
      await call<unknown>(
        "ops_pt_check_setting_set",
        { p_branch: branch, p_on: on },
        "바꾸지 못했어요",
      );
    },
    onSuccess: done,
  });
  return { close, setOn };
};
