// 기록 확인 요청 — 「다니고 있어요」에서 명단을 못 찾은 회원이 데스크에 확인을 부탁한 것 (2026-11-22 확인 대기)
// 「가입 승인」 칸 맨 위. 회원을 찾아 본인 확인 뒤 연결하면, 회원 화면이 그 기록을 카카오로 바로 이어받는다.
// 서버: member_lookup_requests_list · member_lookup_candidates · member_lookup_resolve (함수가 없는 DB 면 칸을 그리지 않는다)
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Phone, ChevronDown, ChevronUp, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { branchShortName } from "@/lib/branchPayment";
import {
  LOOKUP_REPLY_PRESETS,
  lookupStatusLabel,
  normalizeLookupCandidates,
  normalizeLookupRequests,
  type LookupCandidate,
  type LookupRequestRow,
} from "@/lib/memberLookupRequests";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (fn: string, args?: Record<string, unknown>) => (supabase as any).rpc(fn, args);

const fmtPhone = (p: string | null) => {
  const d = (p || "").replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return p || "";
};
const fmtBirth = (b: string | null) => {
  const d = (b || "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : "";
};
const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (m < 60) return m < 1 ? "방금" : `${m}분 전`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`;
};

const RequestCard = ({ r, showBranch }: { r: LookupRequestRow; showBranch: boolean }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState<"none" | "find" | "reply">("none");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [pick, setPick] = useState<LookupCandidate | null>(null);
  const [checked, setChecked] = useState(false);
  const [replyKind, setReplyKind] = useState<"not_member" | "closed">("not_member");
  const [reply, setReply] = useState("");

  const cands = useQuery({
    queryKey: ["153lookup", "cands", r.id, search],
    enabled: open === "find",
    queryFn: async () => {
      const { data, error } = await rpc("member_lookup_candidates", { p_id: r.id, p_q: search || null });
      if (error) throw error;
      return normalizeLookupCandidates(data);
    },
  });

  const resolve = useMutation({
    mutationFn: async (args: { status: string; target?: string | null; reply?: string | null }) => {
      const { error } = await rpc("member_lookup_resolve", {
        p_id: r.id,
        p_status: args.status,
        p_target: args.target ?? null,
        p_reply: args.reply ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_d, args) => {
      toast.success(args.status === "found" ? "연결했어요 · 회원 화면에서 바로 이어받을 수 있어요" : "처리했어요 · 회원 화면에 답이 보여요");
      void qc.invalidateQueries({ queryKey: ["153lookup"] });
    },
    onError: (e: unknown) => toast.error((e as { message?: string })?.message || "처리하지 못했어요"),
  });

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4 shadow-elev-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-heading font-bold text-foreground">{r.name}</p>
          <p className="text-body text-muted-foreground">
            {fmtPhone(r.phone)}
            {r.birthDate ? ` · ${fmtBirth(r.birthDate)}` : ""}
          </p>
        </div>
        <span className="shrink-0 text-label text-muted-foreground">
          {showBranch ? `${branchShortName(r.branchName)} · ` : ""}
          {ago(r.createdAt)}
        </span>
      </div>
      {r.memo && <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-body text-foreground">{r.memo}</p>}

      <div className="mt-3 flex gap-2">
        <a href={`tel:${r.phone}`} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-body font-bold text-foreground">
          <Phone className="h-4 w-4" />
          전화
        </a>
        <button
          type="button"
          onClick={() => setOpen(open === "find" ? "none" : "find")}
          className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-body font-bold ${open === "find" ? "bg-foreground text-background" : "bg-primary text-primary-foreground"}`}
        >
          <Search className="h-4 w-4" />
          회원 찾기
        </button>
        <button
          type="button"
          onClick={() => setOpen(open === "reply" ? "none" : "reply")}
          className="h-11 rounded-xl border border-border px-3 text-body font-bold text-foreground"
        >
          답하기
        </button>
      </div>

      {open === "find" && (
        <div className="mt-3 border-t border-border pt-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPick(null);
              setSearch(q.trim());
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름으로 더 찾기"
              className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-body"
            />
            <button type="submit" className="h-11 rounded-xl bg-muted px-4 text-body font-bold text-foreground">
              찾기
            </button>
          </form>
          <p className="mt-2 text-label text-muted-foreground">이름 · 번호 끝 4자리 · 생년월일이 같은, 아직 앱을 안 쓴 회원이에요</p>
          {cands.isLoading ? (
            <p className="py-4 text-center text-body text-muted-foreground">찾는 중…</p>
          ) : (cands.data ?? []).length === 0 ? (
            <p className="py-4 text-center text-body text-muted-foreground">맞는 회원이 없어요 · 이름으로 더 찾아보세요</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {(cands.data ?? []).map((c) => (
                <li key={c.userId}>
                  <button
                    type="button"
                    onClick={() => {
                      setPick(c);
                      setChecked(false);
                    }}
                    aria-pressed={pick?.userId === c.userId}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left ${pick?.userId === c.userId ? "border-primary bg-primary/5" : "border-border"}`}
                  >
                    <p className="text-body font-bold text-foreground">
                      {c.name || "이름 없음"}
                      {showBranch && c.branchName ? <span className="font-normal text-muted-foreground"> · {branchShortName(c.branchName)}</span> : null}
                    </p>
                    <p className="text-label text-muted-foreground">
                      {fmtPhone(c.phone)}
                      {c.birthDate ? ` · ${fmtBirth(c.birthDate)}` : ""}
                      {c.membershipEnd ? ` · 수강권 ~${c.membershipEnd.slice(5).replace("-", "/")}` : ""}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pick && (
            <div className="mt-3 rounded-xl bg-muted p-3">
              <label className="flex items-start gap-2 text-body text-foreground">
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-5 w-5" />
                <span>전화나 데스크에서 {pick.name || "이 회원"}님 본인인지 확인했어요</span>
              </label>
              <button
                type="button"
                disabled={!checked || resolve.isPending}
                onClick={() => resolve.mutate({ status: "found", target: pick.userId })}
                className="mt-3 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-body font-bold text-primary-foreground disabled:opacity-40"
              >
                <UserCheck className="h-5 w-5" />이 회원으로 연결
              </button>
            </div>
          )}
        </div>
      )}

      {open === "reply" && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex gap-2">
            {(["not_member", "closed"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setReplyKind(k)}
                aria-pressed={replyKind === k}
                className={`flex-1 rounded-xl py-2.5 text-body font-bold ${replyKind === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
              >
                {k === "not_member" ? "명단에 없어요" : "데스크에서 처리"}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {LOOKUP_REPLY_PRESETS[replyKind].map((t) => (
              <button key={t} type="button" onClick={() => setReply(t)} className="rounded-full bg-muted px-3 py-1.5 text-label text-foreground">
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={reply}
            maxLength={200}
            onChange={(e) => setReply(e.target.value)}
            placeholder="회원 화면에 보일 한마디 (선택)"
            className="mt-2 min-h-[72px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-body"
          />
          <button
            type="button"
            disabled={resolve.isPending}
            onClick={() => resolve.mutate({ status: replyKind, reply: reply.trim() || null })}
            className="mt-2 h-12 w-full rounded-xl bg-foreground text-body font-bold text-background disabled:opacity-40"
          >
            보내기
          </button>
        </div>
      )}
    </div>
  );
};

const MemberLookupRequests = ({ showBranch }: { showBranch: boolean }) => {
  const [showDone, setShowDone] = useState(false);
  const { data } = useQuery({
    queryKey: ["153lookup", "list"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("member_lookup_requests_list");
      if (error) {
        // 함수가 없는 DB(적용 전 · 옛 DB 미리보기)거나 권한 없음 — 칸을 그리지 않는다
        return [] as LookupRequestRow[];
      }
      return normalizeLookupRequests(data);
    },
  });
  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");
  if (rows.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-heading font-bold text-foreground">
          기록 확인 요청 {pending.length > 0 && <span className="text-primary">{pending.length}</span>}
        </h3>
        <span className="text-label text-muted-foreground">명단에서 못 찾은 회원</span>
      </div>
      <div className="space-y-2">
        {pending.map((r) => (
          <RequestCard key={r.id} r={r} showBranch={showBranch} />
        ))}
      </div>
      {done.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl px-1 py-2 text-body font-bold text-muted-foreground"
          >
            처리한 요청 {done.length}
            {showDone ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showDone && (
            <ul className="space-y-1.5">
              {done.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-card px-3 py-2.5">
                  <p className="text-body font-bold text-foreground">
                    {r.name} <span className="font-normal text-muted-foreground">· {lookupStatusLabel(r)}</span>
                  </p>
                  <p className="text-label text-muted-foreground">
                    {r.resolver ? `${r.resolver} · ` : ""}
                    {r.resolvedAt ? ago(r.resolvedAt) : ""}
                    {r.seenAt ? " · 회원이 봤어요" : " · 회원이 아직 안 봤어요"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default MemberLookupRequests;
