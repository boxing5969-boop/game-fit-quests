/**
 * 153운영본부 · 근무 — 계약서 서버 함수 감싸기 (2026-11-03, DB 20261103191354_ops_contracts.sql)
 *   ops_contract_list · ops_contract_branch · ops_contract_mine · ops_contract_get
 *   ops_employer_save · ops_contract_send · ops_contract_sign · ops_contract_void · ops_contract_delivered
 *   글 만들기 · 점검은 src/lib/opsContract.ts — 여기는 읽고 쓰기만.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import type {
  ContractBrief,
  ContractDoc,
  ContractEmployer,
  ContractKind,
  ContractTerms,
  FreelanceTerms,
  LaborTerms,
} from "@/lib/opsContract";
import type { OpsPtRate } from "@/lib/opsPt";
import { OPS_KEY } from "./opsService";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback || "잠시 후 다시 시도해 주세요"));
  return data as T;
}

const KEY = [...OPS_KEY, "contracts"] as const;

export interface OpsContractListData {
  branch: string;
  /** 대표님 — 사업주 정보 · 서명을 바꿀 수 있다 */
  hq: boolean;
  employer: ContractEmployer | null;
  contracts: ContractBrief[];
  last_labor: Partial<LaborTerms> | null;
  last_freelance: Partial<FreelanceTerms> | null;
  pt_rates: OpsPtRate[];
}

export interface OpsContractFull extends ContractBrief {
  doc: ContractDoc;
  doc_hash: string;
  sealed_hash: string | null;
  employer_owner: string;
  employer_sign: string;
  worker_sign: string | null;
  worker_sign_name: string | null;
  worker_address: string | null;
  worker_phone: string | null;
  staff_name: string | null;
  can_manage: boolean;
  is_worker: boolean;
  can_sign: boolean;
}

export const useOpsContractList = (staffId: string | null, enabled = true) =>
  useQuery({
    queryKey: [...KEY, "staff", staffId],
    enabled: enabled && !!staffId,
    staleTime: 15_000,
    queryFn: async (): Promise<OpsContractListData> => {
      const d = await call<OpsContractListData>("ops_contract_list", { p_staff_id: staffId }, "계약서를 불러오지 못했어요");
      return {
        ...d,
        hq: !!d?.hq,
        employer: d?.employer ?? null,
        contracts: d?.contracts ?? [],
        last_labor: d?.last_labor ?? null,
        last_freelance: d?.last_freelance ?? null,
        pt_rates: d?.pt_rates ?? [],
      };
    },
  });

/** 지점 근무자 목록의 '계약서 없음 · 서명 대기' — 돈을 보는 분에게만 내용이 온다 */
export const useOpsContractBranch = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...KEY, "branch", branch],
    enabled: enabled && !!branch,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => {
      const d = await call<{ pay: boolean; contracts: ContractBrief[] } | null>(
        "ops_contract_branch",
        { p_branch: branch },
        "계약서를 불러오지 못했어요",
      );
      return { pay: !!d?.pay, contracts: d?.contracts ?? [] };
    },
  });

export const useOpsContractMine = (enabled = true) =>
  useQuery({
    queryKey: [...KEY, "mine"],
    enabled,
    staleTime: 30_000,
    retry: false,
    queryFn: async () => (await call<ContractBrief[] | null>("ops_contract_mine", undefined, "계약서를 불러오지 못했어요")) ?? [],
  });

export const useOpsContract = (id: string | null) =>
  useQuery({
    queryKey: [...KEY, "one", id],
    enabled: !!id,
    staleTime: 10_000,
    retry: false,
    queryFn: async () => call<OpsContractFull>("ops_contract_get", { p_id: id }, "계약서를 불러오지 못했어요"),
  });

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
};

export interface OpsEmployerInput {
  branch: string;
  biz_name: string;
  owner_name: string;
  biz_number: string;
  address: string;
  phone: string;
  /** 넣지 않으면 서명은 그대로 */
  sign?: string;
}

export const useOpsEmployerSave = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (p: OpsEmployerInput) => call<ContractEmployer>("ops_employer_save", { p }, "사업주 정보를 저장하지 못했어요"),
    onSuccess: () => void inv(),
  });
};

export interface OpsContractSendInput {
  staff_id: string;
  kind: ContractKind;
  title: string;
  start_date: string;
  end_date: string | null;
  terms: ContractTerms;
  doc: ContractDoc;
  notify: boolean;
}

export const useOpsContractSend = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (p: OpsContractSendInput) =>
      call<{ id: string; doc_hash: string }>("ops_contract_send", { p }, "계약서를 보내지 못했어요"),
    onSuccess: () => void inv(),
  });
};

export interface OpsContractSignInput {
  id: string;
  hash: string;
  sign: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  inPerson?: boolean;
}

export const useOpsContractSign = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (p: OpsContractSignInput) =>
      call<{ ok: boolean; signed_at: string; sealed_hash: string }>(
        "ops_contract_sign",
        {
          p_id: p.id,
          p_hash: p.hash,
          p_sign: p.sign,
          p_name: p.name,
          p_address: p.address ?? null,
          p_phone: p.phone ?? null,
          p_in_person: !!p.inPerson,
        },
        "서명하지 못했어요",
      ),
    onSuccess: () => void inv(),
  });
};

export const useOpsContractVoid = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (p: { id: string; reason: string }) =>
      call<{ ok: boolean }>("ops_contract_void", { p_id: p.id, p_reason: p.reason }, "무효로 하지 못했어요"),
    onSuccess: () => void inv(),
  });
};

export const useOpsContractDelivered = () => {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: (p: { id: string; how: "pdf" | "paper" }) =>
      call<{ ok: boolean }>("ops_contract_delivered", { p_id: p.id, p_how: p.how }, "저장하지 못했어요"),
    onSuccess: () => void inv(),
  });
};
