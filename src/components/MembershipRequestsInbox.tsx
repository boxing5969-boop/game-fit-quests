// 수강권 홀딩·양도·환불 신청 처리 인박스 — 관장(본인 지점)/마스터(전체) 전용.
// 회원이 /membership 에서 신청한 pending 건을 승인/반려. RLS 가 지점 스코프를 강제한다.
// 처리는 process_membership_request RPC(SECURITY DEFINER) — 홀딩 승인 시 앱 만료일을 바로 늘린다.
//   ⚠️ 앱 만료일은 회원 동기화(sync-members-to-app, 3시간마다)가 브로제이·CRM 값으로 다시 맞춘다.
//      그래서 홀딩을 승인하면 브로제이에도 같은 일수로 홀딩을 등록해야 연장이 유지된다(승인 직후 안내).
// 양도·환불 승인은 기록만 처리되며 실제 정산/이전은 관장이 오프라인으로 진행.
// 부상·질병 홀딩: 첨부된 병원 서류를 '서류 보기'로 확인 → 승인/반려하면 서류는 바로 삭제(건강정보 최소 보관).
//   삭제가 실패한 서류는 인박스를 열 때마다 다시 지운다(mark_hold_doc_deleted 가 실제 삭제를 확인해 기록).
import { useState, useEffect, useCallback } from "react";
import { Pause, ArrowLeftRight, RotateCcw, Check, X, Stethoscope, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { supabase } from "@/integrations/supabase/client";
import { holdDocSignedUrl, purgeHoldDoc, isPdfPath } from "@/lib/holdDocs";
import { TRANSFER_FEE } from "@/data/gymPolicies";
import { toast } from "sonner";

interface PReq {
  id: string;
  user_id: string;
  branch_name: string | null;
  type: string;
  hold_days: number | null;
  hold_kind: string | null;
  doc_path: string | null;
  reason: string | null;
  created_at: string;
  member_name: string | null;
  transferee_name: string | null;
  transferee_phone: string | null;
  est_refund: number | null;
}

/** 홀딩 신청 회원의 만료일·지난 홀딩 사용량 — 관장이 규칙을 넘는 신청을 걸러낼 수 있게 */
interface MemberCtx {
  end: string | null;
  regCount: number;
  regDays: number;
  medCount: number;
  medDays: number;
}

interface DocView {
  url: string;
  inline: boolean; // 화면 안에 그림으로 보여줄 수 있나 (PDF·HEIC 는 새 창으로 연다)
}

const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR");
const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const isMedical = (r: PReq) => r.type === "hold" && r.hold_kind === "medical";
const todayKst = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

const MembershipRequestsInbox = () => {
  const { role } = useAuth();
  const isStaff = isManagerRole(role);
  const [reqs, setReqs] = useState<PReq[]>([]);
  const [ctx, setCtx] = useState<Record<string, MemberCtx>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocView | null>(null);
  const [docBusy, setDocBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("membership_requests")
      .select(
        "id, user_id, branch_name, type, hold_days, hold_kind, doc_path, reason, created_at, member_name, transferee_name, transferee_phone, est_refund",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    const list = (data as PReq[]) || [];
    setReqs(list);

    const ids = Array.from(new Set(list.filter((r) => r.type === "hold").map((r) => r.user_id)));
    if (ids.length > 0) {
      const [profRes, pastRes] = await Promise.all([
        (supabase as any).from("profiles").select("user_id, membership_end").in("user_id", ids),
        (supabase as any)
          .from("membership_requests")
          .select("user_id, hold_days, hold_kind")
          .eq("type", "hold")
          .eq("status", "approved")
          .in("user_id", ids),
      ]);
      const next: Record<string, MemberCtx> = {};
      for (const id of ids) next[id] = { end: null, regCount: 0, regDays: 0, medCount: 0, medDays: 0 };
      for (const p of (profRes.data as { user_id: string; membership_end: string | null }[]) || []) {
        if (next[p.user_id]) next[p.user_id].end = p.membership_end;
      }
      for (const h of (pastRes.data as { user_id: string; hold_days: number | null; hold_kind: string | null }[]) || []) {
        const c = next[h.user_id];
        if (!c) continue;
        if (h.hold_kind === "medical") {
          c.medCount += 1;
          c.medDays += h.hold_days || 0;
        } else {
          c.regCount += 1;
          c.regDays += h.hold_days || 0;
        }
      }
      setCtx(next);
    } else {
      setCtx({});
    }

    // 처리가 끝났는데 아직 지워지지 않은 병원 서류 — 열 때마다 다시 지운다(내 권한 범위, 한 번에 20건)
    const { data: left } = await (supabase as any)
      .from("membership_requests")
      .select("id, doc_path")
      .eq("hold_kind", "medical")
      .neq("status", "pending")
      .is("doc_deleted_at", null)
      .not("doc_path", "is", null)
      .limit(20);
    for (const d of (left as { id: string; doc_path: string }[]) || []) {
      await purgeHoldDoc(d.id, d.doc_path);
    }
  }, []);

  useEffect(() => {
    if (isStaff) load();
  }, [isStaff, load]);

  if (!isStaff || reqs.length === 0) return null;

  const viewDoc = async (r: PReq) => {
    if (!r.doc_path) return;
    setDocBusy(r.id);
    try {
      const url = await holdDocSignedUrl(r.doc_path, 300);
      setDoc({ url, inline: !isPdfPath(r.doc_path) && !/\.(heic|heif)$/i.test(r.doc_path) });
    } catch (e) {
      toast.error("서류를 열 수 없습니다: " + ((e as Error)?.message || ""));
    } finally {
      setDocBusy(null);
    }
  };

  const act = async (r: PReq, approve: boolean) => {
    setBusy(r.id);
    try {
      const { error } = await (supabase as any).rpc("process_membership_request", {
        _request_id: r.id,
        _approve: approve,
      });
      if (error) throw error;
    } catch (e) {
      toast.error("처리 실패: " + ((e as Error)?.message || ""));
      setBusy(null);
      return;
    }
    // 처리는 끝났다 — 아래 서류 삭제가 실패해도 목록에서는 뺀다(다음에 열 때 다시 지움)
    let note = "";
    if (isMedical(r) && r.doc_path) {
      const purged = (await purgeHoldDoc(r.id, r.doc_path)) || (await purgeHoldDoc(r.id, r.doc_path));
      note = purged ? " · 병원 서류는 삭제했습니다" : " · 서류 삭제는 다음에 다시 시도합니다";
    }
    toast.success((approve ? "승인 처리했습니다" : "반려했습니다") + note);
    if (approve && r.type === "hold") {
      toast.info(
        `브로제이에도 홀딩 ${r.hold_days ?? 0}일을 등록해 주세요. 등록하지 않으면 다음 회원 동기화(최대 3시간) 때 만료일이 원래대로 돌아갑니다.`,
        { duration: 10000 },
      );
    }
    setReqs((p) => p.filter((x) => x.id !== r.id));
    setBusy(null);
  };

  const typeChip = (r: PReq) => {
    if (isMedical(r))
      return (
        <>
          <Stethoscope className="h-3 w-3" /> 부상·질병 홀딩 {r.hold_days ?? "-"}일
        </>
      );
    if (r.type === "hold")
      return (
        <>
          <Pause className="h-3 w-3" /> 홀딩 {r.hold_days ?? "-"}일
        </>
      );
    if (r.type === "transfer")
      return (
        <>
          <ArrowLeftRight className="h-3 w-3" /> 양도
        </>
      );
    if (r.type === "refund")
      return (
        <>
          <RotateCcw className="h-3 w-3" /> 환불
        </>
      );
    return <>{r.type}</>;
  };

  const today = todayKst();

  return (
    <div className="mb-5 rounded-2xl border border-status-pending/30 bg-status-pending/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-status-pending px-1.5 text-micro font-bold text-white">
          {reqs.length}
        </span>
        <h3 className="text-body font-bold text-foreground">수강권 홀딩·양도·환불 신청</h3>
      </div>
      <div className="space-y-2">
        {reqs.map((r) => {
          const c = r.type === "hold" ? ctx[r.user_id] : undefined;
          const expired = !!c?.end && c.end < today;
          return (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3">
              <p className="text-body font-semibold text-foreground">
                {r.member_name || "회원"}
                <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-micro font-bold text-muted-foreground">
                  {typeChip(r)}
                </span>
              </p>

              {/* 홀딩: 만료일·지난 홀딩 사용량 (계약서 표: 3~4개월 1회 15일 · 5~11개월 2회 30일 · 12개월+ 3회 60일) */}
              {c && (
                <p className="mt-1 text-label text-muted-foreground">
                  만료일 {c.end ?? "-"}
                  {expired && <span className="ml-1 font-bold text-destructive">(만료)</span>} · 지난 일반 홀딩 {c.regCount}회·{c.regDays}일 · 부상·질병 {c.medCount}회·{c.medDays}일
                </p>
              )}

              {/* 부상·질병 홀딩: 병원 서류 확인 */}
              {isMedical(r) && (
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    onClick={() => viewDoc(r)}
                    disabled={!r.doc_path || docBusy === r.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-label font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
                  >
                    <FileText className="h-3.5 w-3.5" /> {docBusy === r.id ? "여는 중..." : "병원 서류 보기"}
                  </button>
                  <span className="text-label text-muted-foreground">진단 기간과 신청 일수를 확인하세요</span>
                </div>
              )}

              {/* 양도: 양수인 정보 */}
              {r.type === "transfer" && (
                <p className="mt-1 text-label text-foreground">
                  양수인 <span className="font-semibold">{r.transferee_name || "-"}</span>
                  {r.transferee_phone ? ` · ${r.transferee_phone}` : ""}
                  <span className="ml-1 text-muted-foreground">(수수료 {won(TRANSFER_FEE)} 안내)</span>
                </p>
              )}

              {/* 환불: 예상 환불액 */}
              {r.type === "refund" && r.est_refund != null && (
                <p className="mt-1 text-label text-foreground">
                  예상 환불액 <span className="font-bold text-primary">{won(r.est_refund)}</span>
                  <span className="ml-1 text-muted-foreground">(최종 확정 필요)</span>
                </p>
              )}

              {r.reason && <p className="mt-1 text-label text-muted-foreground">{r.reason}</p>}
              <p className="mt-1 text-label text-muted-foreground">
                {r.branch_name ? r.branch_name + " · " : ""}
                {fmt(r.created_at)}
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={() => act(r, true)}
                  disabled={busy === r.id}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-status-complete py-2 text-label font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> 승인
                </button>
                <button
                  onClick={() => act(r, false)}
                  disabled={busy === r.id}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-muted py-2 text-label font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" /> 반려
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-label leading-relaxed text-muted-foreground">
        홀딩을 승인하면 앱 만료일이 바로 늘어나고, <b className="text-foreground">브로제이에도 같은 일수로 홀딩을 등록</b>해야 연장이 유지됩니다(등록하지 않으면 다음 회원 동기화 때 원래 날짜로 돌아갑니다). 부상·질병 홀딩은 일반 홀딩 횟수와 별도이며, 승인·반려하면 첨부 서류는 바로 삭제됩니다. 양도·환불 승인은 신청 기록만 처리되며, 실제 정산·명의 이전은 별도로 진행하세요.
      </p>

      {/* 병원 서류 보기 */}
      {doc && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4" onClick={() => setDoc(null)}>
          <div className="w-full max-w-md rounded-2xl bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-body font-bold text-foreground">병원 서류</h4>
              <button
                onClick={() => setDoc(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {doc.inline && (
              <img src={doc.url} alt="병원 서류" className="max-h-[65vh] w-full rounded-lg bg-muted object-contain" />
            )}
            <a
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl bg-primary py-2.5 text-label font-bold text-primary-foreground active:scale-[0.98]"
            >
              <FileText className="h-3.5 w-3.5" /> {doc.inline ? "새 창에서 크게 보기" : "서류 열기"}
            </a>
            <p className="mt-2 text-center text-label text-muted-foreground">링크는 5분 뒤 만료됩니다. 서류를 따로 저장하지 마세요.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipRequestsInbox;
