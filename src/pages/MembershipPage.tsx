// 수강권 전용 화면 (/membership) — 전체메뉴 "수강권"에서 진입.
// 디지털 멤버십 카드 + 홀딩/연기/환불 신청(회원) → 관장·마스터가 승인·처리.
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Pause, CalendarClock, RotateCcw, X, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MembershipCard from "@/components/MembershipCard";

interface MReq {
  id: string;
  type: string;
  status: string;
  hold_days: number | null;
  reason: string | null;
  created_at: string;
  processed_at: string | null;
}

const HOLD_PRESETS = [7, 14, 30];

const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR");

const typeLabel = (t: string) => (t === "hold" ? "홀딩" : t === "postpone" ? "연기" : t === "refund" ? "환불" : t);
const statusMeta = (s: string) =>
  s === "approved"
    ? { label: "승인됨", cls: "bg-status-complete/15 text-status-complete", Icon: CheckCircle2 }
    : s === "rejected"
    ? { label: "반려됨", cls: "bg-destructive/15 text-destructive", Icon: XCircle }
    : { label: "대기 중", cls: "bg-status-pending/15 text-status-pending", Icon: Clock };

const MembershipPage = () => {
  const navigate = useNavigate();
  const { profile, role, user } = useAuth();
  const memEnd = (profile as { membership_end?: string } | null)?.membership_end ?? null;
  const isStaff = isManagerRole(role);
  const hasMembership = isStaff || !!memEnd;

  const [requests, setRequests] = useState<MReq[]>([]);
  const [modal, setModal] = useState<null | "hold" | "postpone" | "refund">(null);
  const [holdDays, setHoldDays] = useState(7);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("membership_requests")
      .select("id, type, status, hold_days, reason, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests((data as MReq[]) || []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingHold = requests.some((r) => r.type === "hold" && r.status === "pending");
  const pendingPostpone = requests.some((r) => r.type === "postpone" && r.status === "pending");
  const pendingRefund = requests.some((r) => r.type === "refund" && r.status === "pending");

  const submit = async (type: "hold" | "refund") => {
    if (!user) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        branch_name: profile?.branch_name ?? null,
        type,
        reason: reason.trim() || null,
        member_name: profile?.nickname || profile?.name || null,
      };
      if (type === "hold") payload.hold_days = holdDays;
      const { error } = await (supabase as any).from("membership_requests").insert(payload);
      if (error) throw error;
      toast.success(type === "hold" ? "홀딩 신청이 접수되었습니다" : "환불 신청이 접수되었습니다");
      setModal(null);
      setReason("");
      setHoldDays(7);
      load();
    } catch (e) {
      toast.error("신청 실패: " + ((e as Error)?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const openModal = (t: "hold" | "refund") => {
    setReason("");
    setHoldDays(7);
    setModal(t);
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">수강권</h1>
      </div>

      {hasMembership ? (
        <div className="space-y-4">
          <MembershipCard />

          {/* 회원 전용 — 홀딩/환불 신청 (마스터·관장은 무제한이라 숨김) */}
          {!isStaff && memEnd && (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => openModal("hold")}
                  disabled={pendingHold}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-4 text-sm font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  <Pause className="h-5 w-5 text-status-pending" />
                  {pendingHold ? "신청 중" : "홀딩"}
                </button>
                <button
                  onClick={() => openModal("postpone")}
                  disabled={pendingPostpone}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-4 text-sm font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  <CalendarClock className="h-5 w-5 text-primary" />
                  {pendingPostpone ? "신청 중" : "연기"}
                </button>
                <button
                  onClick={() => openModal("refund")}
                  disabled={pendingRefund}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-4 text-sm font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw className="h-5 w-5 text-destructive" />
                  {pendingRefund ? "신청 중" : "환불"}
                </button>
              </div>
              <p className="px-1 text-xs leading-relaxed text-muted-foreground">
                신청하면 관장님이 확인 후 처리합니다. 홀딩·연기 승인 시 신청한 일수만큼 만료일이 자동 연장됩니다. 환불은 관장님과 별도 정산이 필요합니다.
              </p>

              {/* 내 신청 내역 */}
              {requests.length > 0 && (
                <div className="rounded-2xl border border-border bg-card">
                  <div className="border-b border-border px-4 py-2.5 text-xs font-bold text-foreground">내 신청 내역</div>
                  <div className="divide-y divide-border">
                    {requests.map((r) => {
                      const m = statusMeta(r.status);
                      return (
                        <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {typeLabel(r.type)}
                              {(r.type === "hold" || r.type === "postpone") && r.hold_days ? ` ${r.hold_days}일` : ""}
                            </p>
                            {r.reason && <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.reason}</p>}
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(r.created_at)} 신청</p>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${m.cls}`}>
                            <m.Icon className="h-3 w-3" />
                            {m.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {isStaff && (
            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              출석·수강 시 이 화면을 보여주세요. 회원 홀딩·연기·환불 신청은 홈 화면의 관리 메뉴에서 처리할 수 있습니다.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-3xl">🎫</span>
          <p className="mt-2 text-sm font-medium text-foreground">등록된 수강권이 없습니다</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            관장님께 문의하시거나, 구글·카카오로 가입하셨다면 전화번호 연동을 진행해주세요.
          </p>
        </div>
      )}

      {/* 신청 모달 */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">{modal === "hold" ? "수강권 홀딩 신청" : modal === "postpone" ? "수강권 연기 신청" : "수강권 환불 신청"}</h2>
              <button onClick={() => setModal(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>

            {(modal === "hold" || modal === "postpone") && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{modal === "postpone" ? "연기 일수" : "홀딩 일수"}</label>
                <div className="mb-2 flex gap-2">
                  {HOLD_PRESETS.map((d) => (
                    <button
                      key={d}
                      onClick={() => setHoldDays(d)}
                      className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all active:scale-95 ${
                        holdDays === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {d}일
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={holdDays}
                  onChange={(e) => setHoldDays(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="직접 입력 (일)"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">사유 {modal === "refund" ? "" : "(선택)"}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder={modal === "refund" ? "환불 사유를 입력해주세요" : modal === "postpone" ? "예: 사정이 생겨 기간을 미루고 싶습니다" : "예: 출장으로 2주간 이용이 어렵습니다"}
              />
            </div>

            <button
              onClick={() => submit(modal)}
              disabled={submitting || (modal === "refund" && !reason.trim())}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? "신청 중..." : modal === "hold" ? `${holdDays}일 홀딩 신청` : modal === "postpone" ? `${holdDays}일 연기 신청` : "환불 신청"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipPage;
