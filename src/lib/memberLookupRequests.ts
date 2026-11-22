// 기록 확인 요청(운영진 화면) — 서버 값 다듬기 · 글. 화면: components/admin/MemberLookupRequests.tsx (2026-11-22)

export interface LookupRequestRow {
  id: string;
  createdAt: string;
  branchName: string;
  name: string;
  phone: string;
  birthDate: string | null;
  memo: string | null;
  status: "pending" | "found" | "not_member" | "closed";
  reply: string | null;
  resolvedAt: string | null;
  seenAt: string | null;
  resolver: string | null;
  targetName: string | null;
}

export interface LookupCandidate {
  userId: string;
  name: string | null;
  phone: string | null;
  birthDate: string | null;
  branchName: string | null;
  membershipEnd: string | null;
  score: number;
}

const str = (v: unknown) => (typeof v === "string" && v ? v : null);
const STATUSES = ["pending", "found", "not_member", "closed"] as const;

export function normalizeLookupRequests(v: unknown): LookupRequestRow[] {
  if (!Array.isArray(v)) return [];
  const out: LookupRequestRow[] = [];
  for (const x of v) {
    const o = (x ?? {}) as Record<string, unknown>;
    const id = str(o.id);
    const status = STATUSES.find((s) => s === o.status);
    if (!id || !status || !str(o.created_at)) continue;
    out.push({
      id,
      createdAt: str(o.created_at)!,
      branchName: str(o.branch_name) ?? "",
      name: str(o.name) ?? "",
      phone: str(o.phone) ?? "",
      birthDate: str(o.birth_date),
      memo: str(o.memo),
      status,
      reply: str(o.reply),
      resolvedAt: str(o.resolved_at),
      seenAt: str(o.seen_at),
      resolver: str(o.resolver),
      targetName: str(o.target_name),
    });
  }
  return out;
}

export function normalizeLookupCandidates(v: unknown): LookupCandidate[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => {
      const o = (x ?? {}) as Record<string, unknown>;
      return {
        userId: str(o.user_id) ?? "",
        name: str(o.name),
        phone: str(o.phone),
        birthDate: str(o.birth_date),
        branchName: str(o.branch_name),
        membershipEnd: str(o.membership_end),
        score: typeof o.score === "number" ? o.score : Number(o.score) || 0,
      };
    })
    .filter((c) => c.userId)
    .sort((a, b) => b.score - a.score);
}

export function lookupStatusLabel(r: Pick<LookupRequestRow, "status" | "targetName">): string {
  if (r.status === "found") return r.targetName ? `${r.targetName}님으로 연결` : "연결함";
  if (r.status === "not_member") return "명단에 없어요";
  if (r.status === "closed") return "데스크에서 처리";
  return "확인 기다림";
}

export const LOOKUP_REPLY_PRESETS: Record<"not_member" | "closed", readonly string[]> = {
  not_member: ["명단에서 찾지 못했어요. 처음이시면 신규 가입으로 시작해 주세요.", "등록할 때 쓴 번호를 데스크에 알려 주세요."],
  closed: ["전화로 안내해 드렸어요.", "데스크에 오시면 바로 연결해 드릴게요."],
};
