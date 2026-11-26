/**
 * 📇 153운영본부 「CRM」 — 서버 부르기 (2026-11-27 대표님 「다음가자」 · 관장님 앱 ② · docs/features/69)
 *   Edge Function os-crm — action members(회원 목록 · 할 일) · card(회원 카드) · customers(고객). 읽기만.
 *   범위(누가 어느 지점)는 서버 crm_scope 가 정한다 — 화면은 고른 지점만 넘긴다(본사는 켠 지점 중에서).
 *   예시(?demo=1)면 서버를 부르지 않고 lib/crm153 의 지어낸 자료.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CRM_DEMO_CARD,
  CRM_DEMO_CUSTOMERS,
  CRM_DEMO_MEMBERS,
  CRM_ERROR,
  normalizeCard,
  normalizeCustomers,
  normalizeMembers,
  type CrmCard,
  type CrmCustomers,
  type CrmMembers,
} from "@/lib/crm153";
import { isCrmDemo } from "./crmOn";

export const CRM_KEY = ["crm"] as const;

async function callCrm(body: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke("os-crm", { body });
  if (error) throw new Error("인터넷 연결을 확인하고 다시 시도해 주세요");
  const d = data as { ok?: boolean; code?: string; data?: unknown } | null;
  if (!d || d.ok !== true) throw new Error(CRM_ERROR[d?.code ?? ""] ?? "CRM 자료를 읽지 못했어요");
  return d.data;
}

const demoSearch = (q: string): CrmMembers => {
  const s = q.replace(/\s/g, "");
  if (!s) return CRM_DEMO_MEMBERS;
  const rows = CRM_DEMO_MEMBERS.rows.filter((r) => r.name.includes(s) || (r.last4 ?? "").endsWith(s.slice(-4)));
  return { ...CRM_DEMO_MEMBERS, query: s, rows, counts: { ...CRM_DEMO_MEMBERS.counts, shown: rows.length } };
};

/** 회원 목록 — q 가 비면 지금 회원(유효 · 홀딩 · 끝난 지 90일 안) + 할 일 숫자, 있으면 이름 · 전화 뒷자리로 모든 회원 */
export const useCrmMembers = (branch: string | null, q: string, enabled = true) => {
  const demo = isCrmDemo();
  return useQuery({
    queryKey: [...CRM_KEY, "members", demo ? "demo" : branch, q],
    enabled: demo || (enabled && !!branch),
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<CrmMembers> =>
      demo ? demoSearch(q) : normalizeMembers(await callCrm({ action: "members", branch, q: q || null })),
  });
};

/** 회원 카드 — 전화 전체 · 결제 · 방문 날짜 (서버가 연 기록을 남긴다) */
export const useCrmCard = (branch: string | null, id: string | null) => {
  const demo = isCrmDemo();
  return useQuery({
    queryKey: [...CRM_KEY, "card", demo ? "demo" : branch, id],
    enabled: !!id && (demo || !!branch),
    staleTime: 60_000,
    retry: false,
    queryFn: async (): Promise<CrmCard> => {
      if (demo) {
        const r = CRM_DEMO_MEMBERS.rows.find((x) => x.id === id);
        return r
          ? {
              ...CRM_DEMO_CARD,
              id: r.id,
              name: r.name,
              last4: r.last4,
              phone: `0100000${r.last4 ?? "0000"}`,
              product: r.product,
              end: r.end,
              daysLeft: r.daysLeft,
              active: r.status !== "ended",
              statusText: r.status === "ended" ? "만료" : r.status === "hold" ? "홀딩" : "유효",
              lastVisit: r.lastVisit,
              coach: r.coach,
            }
          : CRM_DEMO_CARD;
      }
      const c = normalizeCard(await callCrm({ action: "card", branch, id }));
      if (!c) throw new Error(CRM_ERROR.NOT_FOUND);
      return c;
    },
  });
};

/** 고객 — 이번 달 손님 흐름 · 톡톡 손님(최근 60일) · 문의 기록 */
export const useCrmCustomers = (branch: string | null, enabled = true) => {
  const demo = isCrmDemo();
  return useQuery({
    queryKey: [...CRM_KEY, "customers", demo ? "demo" : branch],
    enabled: demo || (enabled && !!branch),
    staleTime: 120_000,
    retry: 1,
    queryFn: async (): Promise<CrmCustomers> =>
      demo ? CRM_DEMO_CUSTOMERS : normalizeCustomers(await callCrm({ action: "customers", branch })),
  });
};
