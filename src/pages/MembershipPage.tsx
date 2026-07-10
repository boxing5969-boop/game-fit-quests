// 수강권 전용 화면 (/membership) — 전체메뉴 "수강권"에서 진입.
// 디지털 멤버십 카드 + 홀딩/양도/환불 신청(회원) → 관장·마스터가 승인·처리.
// 규칙 근거: 153복싱짐 통합 상품 이용약관 — 제14조(일시정지), 제15조(양도), 제18조(환불).
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { calcRefund, NORMAL_MONTHLY_DEFAULT } from "@/lib/refundPolicy";
import { ArrowLeft, Pause, ArrowLeftRight, RotateCcw, X, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MembershipCard from "@/components/MembershipCard";
import MembershipProducts from "@/components/MembershipProducts";

interface MReq {
  id: string;
  type: string;
  status: string;
  hold_days: number | null;
  reason: string | null;
  created_at: string;
  processed_at: string | null;
  transferee_name: string | null;
  est_refund: number | null;
}

const TRANSFER_FEE = 50000;
const DAY = 86400000;

const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR");
const won = (n: number) => n.toLocaleString("ko-KR") + "원";

const typeLabel = (t: string) =>
  t === "hold" ? "홀딩" : t === "transfer" ? "양도" : t === "refund" ? "환불" : t === "postpone" ? "연기" : t;
const statusMeta = (s: string) =>
  s === "approved"
    ? { label: "승인됨", cls: "bg-status-complete/15 text-status-complete", Icon: CheckCircle2 }
    : s === "rejected"
    ? { label: "반려됨", cls: "bg-destructive/15 text-destructive", Icon: XCircle }
    : { label: "대기 중", cls: "bg-status-pending/15 text-status-pending", Icon: Clock };

const MembershipPage = () => {
  const navigate = useNavigate();
  const { profile, role, user, refreshProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const memEnd = (profile as { membership_end?: string } | null)?.membership_end ?? null;
  const regDate = (profile as { gym_reg_date?: string } | null)?.gym_reg_date ?? null;
  const payment = (profile as { payment_total?: number } | null)?.payment_total ?? null;
  const isStaff = isManagerRole(role);
  const hasMembership = isStaff || !!memEnd;

  const [requests, setRequests] = useState<MReq[]>([]);
  const [modal, setModal] = useState<null | "hold" | "transfer" | "refund">(null);
  const [holdDays, setHoldDays] = useState(7);
  const [reason, setReason] = useState("");
  const [tName, setTName] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("membership_requests")
      .select("id, type, status, hold_days, reason, created_at, processed_at, transferee_name, est_refund")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests((data as MReq[]) || []);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // 결제선생 결제창에서 복귀(?paid=1) → 결제 확인 안내 + 프로필 갱신
  useEffect(() => {
    if (searchParams.get("paid") === "1") {
      toast.success("결제 확인 중입니다. 잠시 후 수강권에 반영됩니다.");
      refreshProfile?.();
      setSearchParams({}, { replace: true });
      const t = setTimeout(() => refreshProfile?.(), 3000);
      return () => clearTimeout(t);
    }
  }, [searchParams, setSearchParams, refreshProfile]);

  // ── 약관 기반 계산 ──────────────────────────────
  const totalDays = useMemo(
    () => (regDate && memEnd ? Math.round((new Date(memEnd).getTime() - new Date(regDate).getTime()) / DAY) : null),
    [regDate, memEnd],
  );
  const elapsedDays = useMemo(
    () => (regDate ? Math.max(0, Math.floor((Date.now() - new Date(regDate).getTime()) / DAY)) : null),
    [regDate],
  );
  const contractMonths = totalDays ? totalDays / 30 : null;

  // 제14조 일시정지(홀딩) 자격
  const holdTier =
    isStaff
      ? { maxCount: 2, maxDays: 30 } // 본사 테스트: 12개월+ 자격으로 가정
      : contractMonths == null
      ? null
      : contractMonths < 6
      ? { maxCount: 0, maxDays: 0 }
      : contractMonths < 12
      ? { maxCount: 1, maxDays: 10 }
      : { maxCount: 2, maxDays: 30 };
  const approvedHolds = requests.filter((r) => r.type === "hold" && r.status === "approved");
  const usedHoldCount = approvedHolds.length;
  const usedHoldDays = approvedHolds.reduce((s, r) => s + (r.hold_days || 0), 0);
  const remainCount = holdTier ? Math.max(0, holdTier.maxCount - usedHoldCount) : 0;
  const remainDays = holdTier ? Math.max(0, holdTier.maxDays - usedHoldDays) : 0;
  const pendingHold = requests.some((r) => r.type === "hold" && r.status === "pending");
  const holdEligible = !!holdTier && holdTier.maxCount > 0 && remainCount > 0 && remainDays > 0 && !pendingHold;

  // 제15조 양도 — 1회만
  const transferUsed = requests.some((r) => r.type === "transfer" && (r.status === "approved" || r.status === "pending"));

  // 환불 예상액 — 정상가 재산정(할인 회수): 결제액 − (정상 일요금 × 이용일수) − 위약금10%.
  // 정상 일요금은 월 30만원(주5회 정상가) 기준. 최종은 관장이 153경영앱에서 확정.
  const estBreak = useMemo(() => {
    if (payment == null) return null;
    return calcRefund({ paid: payment, normalDaily: NORMAL_MONTHLY_DEFAULT / 30, elapsedDays: elapsedDays ?? 0 });
  }, [payment, elapsedDays]);
  const estRefund = estBreak ? estBreak.refund : null;
  const pendingRefund = requests.some((r) => r.type === "refund" && r.status === "pending");

  const holdPresets = [7, 14, 30].filter((d) => d <= remainDays);

  const openModal = (t: "hold" | "transfer" | "refund") => {
    setReason("");
    setTName("");
    setTPhone("");
    setHoldDays(Math.min(7, remainDays || 7));
    setModal(t);
  };

  const submit = async () => {
    if (!user || !modal) return;
    if (modal === "transfer" && (!tName.trim() || !tPhone.trim())) {
      toast.error("양수인 이름과 연락처를 입력해주세요");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        branch_name: profile?.branch_name ?? null,
        type: modal,
        reason: reason.trim() || null,
        member_name: profile?.nickname || profile?.name || null,
      };
      if (modal === "hold") payload.hold_days = Math.min(holdDays, remainDays);
      if (modal === "transfer") {
        payload.transferee_name = tName.trim();
        payload.transferee_phone = tPhone.trim();
      }
      if (modal === "refund") {
        payload.payment_total = payment;
        payload.est_refund = estRefund;
      }
      const { error } = await (supabase as any).from("membership_requests").insert(payload);
      if (error) throw error;
      toast.success("신청이 접수되었습니다");
      setModal(null);
      setReason("");
      setHoldDays(7);
      setTName("");
      setTPhone("");
      load();
    } catch (e) {
      toast.error("신청 실패: " + ((e as Error)?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-4">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <h1 className="text-xl text-foreground">수강권</h1>
      </div>

      <div className="space-y-4">
        {hasMembership ? (
          <MembershipCard />
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center">
            <span className="text-3xl">🎫</span>
            <p className="mt-2 text-sm font-medium text-foreground">아직 등록된 수강권이 없습니다</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">아래에서 수강권을 결제하면 바로 이용이 시작됩니다.</p>
          </div>
        )}

          {/* 수강권 결제 — 회원: 상품 결제하기 / 관장·마스터: 상품 관리 */}
          <MembershipProducts />

          {/* 홀딩/양도/환불 신청 — 회원은 본인 수강권 기준, 본사는 테스트 모드 */}
          {(memEnd || isStaff) && (
            <>
              {isStaff && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  <span className="font-bold text-primary">본사 테스트 모드</span> — 무제한 계정이라 실제 회원에겐 없는 신청 버튼이 테스트용으로 표시됩니다. 신청하면 아래 내역과 홈 화면 관리 메뉴에서 승인/반려를 확인할 수 있습니다.
                </div>
              )}
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  onClick={() => openModal("hold")}
                  disabled={!holdEligible}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-4 text-sm font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  <Pause className="h-5 w-5 text-status-pending" />
                  {pendingHold ? "신청 중" : "홀딩"}
                </button>
                <button
                  onClick={() => openModal("transfer")}
                  disabled={transferUsed}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card py-4 text-sm font-bold text-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  <ArrowLeftRight className="h-5 w-5 text-primary" />
                  {transferUsed ? "신청 중" : "양도"}
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

              {/* 자격 안내 (약관 기준) */}
              <div className="rounded-xl bg-muted/30 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                {holdTier && holdTier.maxCount > 0 ? (
                  <p>홀딩 가능: 남은 {remainCount}회 · {remainDays}일{isStaff ? " (본사 테스트)" : ` (약정 ${Math.round(contractMonths ?? 0)}개월 기준)`}</p>
                ) : (
                  <p>홀딩 불가: 6개월 미만 약정은 일시정지가 제공되지 않습니다(약관 제14조).</p>
                )}
                <p className="mt-0.5">양도 1회 가능 · 수수료 {won(TRANSFER_FEE)} (관장 승인 후 처리, 재양도 불가).</p>
                <p className="mt-0.5">환불은 소비자분쟁해결기준(체육시설업)에 따라 결제금액에서 이용하신 기간과 결제 수수료·세금(10%)을 공제해 산정하며, 위생용품·부대서비스는 별도 반영될 수 있습니다. 최종 금액은 관장님이 확정합니다.</p>
              </div>

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
                              {r.type === "hold" && r.hold_days ? ` ${r.hold_days}일` : ""}
                              {r.type === "transfer" && r.transferee_name ? ` → ${r.transferee_name}` : ""}
                              {r.type === "refund" && r.est_refund != null ? ` (예상 ${won(r.est_refund)})` : ""}
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
        </div>

      {/* 신청 모달 */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">
                {modal === "hold" ? "수강권 홀딩 신청" : modal === "transfer" ? "수강권 양도 신청" : "수강권 환불 신청"}
              </h2>
              <button onClick={() => setModal(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 홀딩 — 일수 */}
            {modal === "hold" && (
              <div className="mb-4">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  홀딩 일수 (남은 {remainCount}회 · 최대 {remainDays}일)
                </label>
                {holdPresets.length > 0 && (
                  <div className="mb-2 flex gap-2">
                    {holdPresets.map((d) => (
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
                )}
                <input
                  type="number"
                  min={1}
                  max={remainDays}
                  value={holdDays}
                  onChange={(e) => setHoldDays(Math.max(1, Math.min(remainDays, Number(e.target.value) || 1)))}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="직접 입력 (일)"
                />
              </div>
            )}

            {/* 양도 — 양수인 정보 */}
            {modal === "transfer" && (
              <div className="mb-4 space-y-2">
                <div className="rounded-xl bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  양도 수수료 {won(TRANSFER_FEE)} · 1회만 가능 · 재양도 불가. 관장님 승인 후 처리됩니다.
                </div>
                <input
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="양수인 이름"
                />
                <input
                  value={tPhone}
                  onChange={(e) => setTPhone(e.target.value)}
                  inputMode="tel"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="양수인 연락처"
                />
              </div>
            )}

            {/* 환불 — 예상액 */}
            {modal === "refund" && (
              <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed">
                {payment != null ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">결제 금액</span>
                      <span className="font-semibold text-foreground">{won(payment)}</span>
                    </div>
                    {totalDays && elapsedDays != null && (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-muted-foreground">이용 경과</span>
                        <span className="text-foreground">{Math.min(elapsedDays, totalDays)} / {totalDays}일</span>
                      </div>
                    )}
                    {estBreak && (
                      <>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-muted-foreground">이용분 차감 (정상가 재산정)</span>
                          <span className="font-semibold text-destructive">-{won(estBreak.usedNormal)}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-muted-foreground">위약금 (10%)</span>
                          <span className="font-semibold text-destructive">-{won(estBreak.penalty)}</span>
                        </div>
                      </>
                    )}
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                      <span className="font-bold text-foreground">예상 환불액</span>
                      <span className="text-base font-black text-primary">{won(estRefund ?? 0)}</span>
                    </div>
                    {estBreak && estBreak.loss > 0 && (
                      <div className="mt-2 rounded-lg bg-destructive/10 px-2.5 py-2 text-center">
                        <span className="text-[11px] font-bold text-destructive">지금 환불하면 약 {won(estBreak.loss)} 손해예요</span>
                      </div>
                    )}
                    <p className="mt-1.5 text-[11px] text-muted-foreground">할인 상품은 중도 해지 시 이용기간이 정상가로 재산정됩니다(정상 월 30만원 기준). 위생용품·부대서비스는 별도이며, 최종 금액은 관장님이 확정합니다.</p>
                  </>
                ) : (
                  <p className="text-muted-foreground">결제 금액 정보가 없어 예상액을 계산할 수 없습니다. 신청 후 관장님이 금액을 확정합니다.</p>
                )}
              </div>
            )}

            {/* 사유 */}
            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">사유 {modal === "refund" ? "" : "(선택)"}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder={
                  modal === "hold"
                    ? "예: 출장으로 2주간 이용이 어렵습니다"
                    : modal === "transfer"
                    ? "예: 지인에게 남은 기간을 양도합니다"
                    : "환불 사유를 입력해주세요"
                }
              />
            </div>

            <button
              onClick={submit}
              disabled={
                submitting ||
                (modal === "refund" && !reason.trim()) ||
                (modal === "transfer" && (!tName.trim() || !tPhone.trim()))
              }
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting
                ? "신청 중..."
                : modal === "hold"
                ? `${holdDays}일 홀딩 신청`
                : modal === "transfer"
                ? "양도 신청"
                : "환불 신청"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipPage;
