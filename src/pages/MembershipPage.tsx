// 수강권 전용 화면 (/membership) — 전체메뉴 "수강권"에서 진입.
// 디지털 멤버십 카드 + 홀딩/양도/환불 신청(회원) → 관장·마스터가 승인·처리.
// 규칙 근거: 153복싱짐 통합 상품 이용약관 — 제14조(일시정지), 제15조(양도), 제18조(환불).
// 홀딩 표는 회원 이용계약서 제3조와 같은 data/gymPolicies.holdPolicy (153OS 셀프 홀딩 app_hold_policy 와도 동일).
// 부상·질병 홀딩: 병원 서류(lib/holdDocs → 비공개 버킷)를 첨부하면 일반 홀딩 횟수·일수와 별도로 신청. 관장 승인제.
import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { calcRefund, NORMAL_MONTHLY_DEFAULT } from "@/lib/refundPolicy";
import { holdPolicy, type HoldTier, MEDICAL_HOLD_MAX_DAYS, TRANSFER_FEE } from "@/data/gymPolicies";
import { uploadHoldDoc, removeHoldDoc, HOLD_DOC_ACCEPT } from "@/lib/holdDocs";
import { ArrowLeft, Pause, ArrowLeftRight, RotateCcw, X, Clock, CheckCircle2, XCircle, Stethoscope, Paperclip } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { isStaffProfile } from "@/lib/staffDisplay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MembershipCard from "@/components/MembershipCard";
import MembershipProducts from "@/components/MembershipProducts";

interface MReq {
  id: string;
  type: string;
  status: string;
  hold_days: number | null;
  hold_kind: string | null; // regular | medical(부상·질병, 서류 첨부)
  reason: string | null;
  created_at: string;
  processed_at: string | null;
  transferee_name: string | null;
  est_refund: number | null;
}

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
  // 지도진(profiles.is_staff)은 역할이 member 여도 무제한 이용권 (2026-09-23).
  // 홀딩·양도·환불 "본사 테스트 모드" 는 관리 역할(관장·본사)에게만 — 코치님 화면엔 안 보인다.
  const isManager = isManagerRole(role);
  const isStaff = isManager || isStaffProfile(profile);
  const hasMembership = isStaff || !!memEnd;

  const [requests, setRequests] = useState<MReq[]>([]);
  const [modal, setModal] = useState<null | "hold" | "transfer" | "refund">(null);
  // 일수 입력은 문자열로 받는다 — 칸을 비우는 순간 1로 바뀌어 "30"을 치면 "130"이 되던 문제 방지
  const [holdDaysStr, setHoldDaysStr] = useState("7");
  const [holdKind, setHoldKind] = useState<"regular" | "medical">("regular");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [medConsent, setMedConsent] = useState(false);
  const [reason, setReason] = useState("");
  const [tName, setTName] = useState("");
  const [tPhone, setTPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("membership_requests")
      .select("id, type, status, hold_days, hold_kind, reason, created_at, processed_at, transferee_name, est_refund")
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
  // 승인된 홀딩은 만료일을 그만큼 늘렸으므로, 계약 개월·이용일수 계산에서 빼야 홀딩해도 구간·환불액이 바뀌지 않는다.
  // 부상·질병 홀딩도 만료일을 늘리므로 날짜 계산에서는 빼고(allHoldDays), 일반 홀딩 횟수·일수 한도에서는 제외한다.
  const approvedHolds = requests.filter((r) => r.type === "hold" && r.status === "approved");
  const allHoldDays = approvedHolds.reduce((s, r) => s + (r.hold_days || 0), 0);
  const regularHolds = approvedHolds.filter((r) => r.hold_kind !== "medical");
  const usedHoldCount = regularHolds.length;
  const usedHoldDays = regularHolds.reduce((s, r) => s + (r.hold_days || 0), 0);
  const totalDays = useMemo(
    () => (regDate && memEnd ? Math.round((new Date(memEnd).getTime() - new Date(regDate).getTime()) / DAY) : null),
    [regDate, memEnd],
  );
  const elapsedDays = useMemo(
    () => (regDate ? Math.max(0, Math.floor((Date.now() - new Date(regDate).getTime()) / DAY)) : null),
    [regDate],
  );
  const contractDays = totalDays != null ? Math.max(0, totalDays - allHoldDays) : null;
  // 이용일수에서는 '이미 지나간' 홀딩 날만 뺀다 — 앱은 홀딩 날짜를 따로 모르므로 승인일부터 쉰 것으로 본다
  // (방금 승인된 90일 홀딩을 통째로 빼면 예상 환불액이 부풀려진다).
  const heldSoFar = approvedHolds.reduce((s, r) => {
    const from = new Date(r.processed_at ?? r.created_at).getTime();
    const passed = Math.max(0, Math.floor((Date.now() - from) / DAY));
    return s + Math.min(r.hold_days || 0, passed);
  }, 0);
  const usedDaysExHold = elapsedDays != null ? Math.max(0, elapsedDays - heldSoFar) : null;
  // 만료된 이용권은 일반 홀딩 불가(부상·질병은 서류 기간이 이용 중이었다면 관장 판단으로 가능)
  const todayKst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const expired = !!memEnd && memEnd.slice(0, 10) < todayKst;
  const contractMonths = contractDays ? contractDays / 30 : null;

  // 일시정지(홀딩) 자격 — 회원 이용계약서 제3조: 1~2개월 불가 · 3~4개월 1회 15일 · 5~11개월 2회 합계 30일 · 12개월 이상 3회 합계 60일
  // (1회 최대 3~4개월 15일, 5개월 이상 30일). 부상·질병 홀딩은 이 표와 별도.
  const holdTier: HoldTier | null =
    isManager
      ? holdPolicy(12) // 본사 테스트: 12개월+ 자격으로 가정
      : contractMonths == null
      ? null
      : holdPolicy(Math.round(contractMonths));
  const remainCount = holdTier ? Math.max(0, holdTier.maxCount - usedHoldCount) : 0;
  const remainDays = holdTier ? Math.max(0, holdTier.maxDays - usedHoldDays) : 0;
  // 이번 신청 최대 = min(남은 합계, 1회 최대) — 5개월 이상은 30일까지 한 번에 몰아 쓸 수 있다
  const perRequestMax = holdTier ? Math.min(remainDays, holdTier.perHold) : 0;
  const pendingHold = requests.some((r) => r.type === "hold" && r.status === "pending");
  const regularEligible = (isManager || !expired) && !!holdTier && holdTier.maxCount > 0 && remainCount > 0 && perRequestMax > 0;
  // 이번 신청 일수(문자열 입력 → 범위 안 숫자)
  const holdMax = holdKind === "medical" ? MEDICAL_HOLD_MAX_DAYS : perRequestMax;
  const holdDaysNum = /^\d+$/.test(holdDaysStr) ? parseInt(holdDaysStr, 10) : 0;
  const holdDaysValid = holdDaysNum >= 1 && holdDaysNum <= holdMax;
  const holdDays = Math.max(1, Math.min(Math.max(1, holdMax), holdDaysNum || 1));
  // 부상·질병 홀딩은 이용권만 있으면 언제든 서류를 첨부해 신청(관장 승인). 대기 중 신청이 있으면 하나씩.
  const holdEligible = !pendingHold;

  // 제15조 양도 — 1회만
  const transferUsed = requests.some((r) => r.type === "transfer" && (r.status === "approved" || r.status === "pending"));

  // 환불 예상액 — 정상가 재산정(할인 회수): 결제액 − (정상 일요금 × 이용일수) − 위약금10%.
  // 정상 일요금은 1개월 정상가 22만원 ÷ 30. 이용일수는 승인된 홀딩 일수를 뺀 날(홀딩해도 금액 불변). 최종은 관장이 153경영앱에서 확정.
  const estBreak = useMemo(() => {
    if (payment == null) return null;
    return calcRefund({ paid: payment, normalDaily: NORMAL_MONTHLY_DEFAULT / 30, elapsedDays: usedDaysExHold ?? 0 });
  }, [payment, usedDaysExHold]);
  const estRefund = estBreak ? estBreak.refund : null;
  const pendingRefund = requests.some((r) => r.type === "refund" && r.status === "pending");

  const holdPresets = [7, 15, 30].filter((d) => d <= perRequestMax);
  const medPresets = [14, 30, 60].filter((d) => d <= MEDICAL_HOLD_MAX_DAYS);

  const pickHoldKind = (k: "regular" | "medical") => {
    setHoldKind(k);
    setHoldDaysStr(String(k === "medical" ? 14 : Math.min(7, perRequestMax || 7)));
  };

  const openModal = (t: "hold" | "transfer" | "refund") => {
    setReason("");
    setTName("");
    setTPhone("");
    setDocFile(null);
    setMedConsent(false);
    if (t === "hold") pickHoldKind(regularEligible ? "regular" : "medical");
    setModal(t);
  };

  const submit = async () => {
    if (!user || !modal) return;
    if (modal === "transfer" && (!tName.trim() || !tPhone.trim())) {
      toast.error("양수인 이름과 연락처를 입력해주세요");
      return;
    }
    const medical = modal === "hold" && holdKind === "medical";
    if (modal === "hold" && !medical && !regularEligible) {
      toast.error("일반 홀딩은 더 신청할 수 없어요. 부상·질병이면 병원 서류를 첨부해 신청해 주세요");
      return;
    }
    if (medical && !docFile) {
      toast.error("병원 서류(진단서·소견서 등)를 첨부해 주세요");
      return;
    }
    if (medical && !medConsent) {
      toast.error("건강정보 수집·이용에 동의해야 부상·질병 홀딩을 신청할 수 있어요");
      return;
    }
    if (modal === "hold" && !holdDaysValid) {
      toast.error(`홀딩 일수는 1~${holdMax}일 사이로 입력해 주세요`);
      return;
    }
    setSubmitting(true);
    let uploadedPath: string | null = null;
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        branch_name: profile?.branch_name ?? null,
        type: modal,
        reason: reason.trim() || null,
        member_name: profile?.nickname || profile?.name || null,
      };
      if (modal === "hold") {
        if (medical && docFile) {
          uploadedPath = await uploadHoldDoc(user.id, docFile);
          payload.hold_kind = "medical";
          payload.doc_path = uploadedPath;
          payload.med_consent_at = new Date().toISOString(); // 건강정보 별도 동의 시각(서버가 부상·질병 신청에 필수로 확인)
          payload.hold_days = Math.max(1, Math.min(holdDays, MEDICAL_HOLD_MAX_DAYS));
        } else {
          payload.hold_days = Math.max(1, Math.min(holdDays, perRequestMax));
        }
      }
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
      toast.success(medical ? "부상·질병 홀딩 신청이 접수되었습니다. 관장님이 서류를 확인한 뒤 처리합니다" : "신청이 접수되었습니다");
      setModal(null);
      setReason("");
      setHoldDaysStr("7");
      setTName("");
      setTPhone("");
      setDocFile(null);
      setMedConsent(false);
      load();
    } catch (e) {
      // 신청이 들어가지 않았으면 방금 올린 서류도 지운다(건강정보를 남기지 않게)
      if (uploadedPath) void removeHoldDoc(uploadedPath);
      const err = e as { code?: string; message?: string };
      toast.error(
        err?.code === "23505" ? "이미 처리를 기다리는 홀딩 신청이 있어요" : "신청 실패: " + (err?.message || ""),
      );
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
          {(memEnd || isManager) && (
            <>
              {isManager && (
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
                {expired && !isManager ? (
                  <p>이용권이 만료되어 일반 홀딩은 신청할 수 없어요.</p>
                ) : holdTier && holdTier.maxCount > 0 ? (
                  <p>홀딩 가능: 남은 {remainCount}회 · 남은 {remainDays}일 · 한 번에 최대 {holdTier.perHold}일{isManager ? " (본사 테스트)" : ` (약정 ${Math.round(contractMonths ?? 0)}개월 기준)`}</p>
                ) : holdTier ? (
                  <p>일반 홀딩 불가: 1~2개월 이용권은 일반 홀딩이 없습니다.</p>
                ) : (
                  <p>일반 홀딩 가능 여부는 데스크에서 확인해 드려요.</p>
                )}
                <p className="mt-0.5">부상·질병은 병원 서류를 첨부하면 위 횟수·일수와 별도로 추가 홀딩을 신청할 수 있어요 (관장님 확인 후 승인).</p>
                <p className="mt-0.5">양도 1회 가능 · 수수료 {won(TRANSFER_FEE)} (관장 승인 후 처리, 재양도 불가).</p>
                <p className="mt-0.5">환불은 결제금액에서 이용하신 기간(홀딩 기간 제외)과 위약금(결제금액의 10%)을 빼서 산정하며, 지급 장비(글러브 50,000원·붕대 10,000원)·부대서비스는 별도 반영될 수 있습니다. 카드 수수료 등 다른 비용은 받지 않으며, 최종 금액은 관장님이 확정합니다.</p>
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
                              {r.type === "hold" && r.hold_kind === "medical" ? "부상·질병 홀딩" : typeLabel(r.type)}
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

            {/* 홀딩 — 종류(일반 / 부상·질병) + 일수 */}
            {modal === "hold" && (
              <div className="mb-4">
                <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => pickHoldKind("regular")}
                    disabled={!regularEligible}
                    className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-all active:scale-95 disabled:opacity-40 ${
                      holdKind === "regular" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Pause className="h-3.5 w-3.5" /> 일반 홀딩
                  </button>
                  <button
                    type="button"
                    onClick={() => pickHoldKind("medical")}
                    className={`flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-bold transition-all active:scale-95 ${
                      holdKind === "medical" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    <Stethoscope className="h-3.5 w-3.5" /> 부상·질병
                  </button>
                </div>

                {holdKind === "regular" ? (
                  <>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      홀딩 일수 (남은 {remainCount}회 · 이번에 최대 {perRequestMax}일)
                    </label>
                    {holdPresets.length > 0 && (
                      <div className="mb-2 flex gap-2">
                        {holdPresets.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setHoldDaysStr(String(d))}
                            className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all active:scale-95 ${
                              holdDaysStr === String(d) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {d}일
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      inputMode="numeric"
                      value={holdDaysStr}
                      onChange={(e) => setHoldDaysStr(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      onBlur={() => setHoldDaysStr(String(holdDays))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                      placeholder="직접 입력 (일)"
                    />
                  </>
                ) : (
                  <>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      홀딩 일수 (서류의 치료·안정 기간 안에서 · 최대 {MEDICAL_HOLD_MAX_DAYS}일)
                    </label>
                    <div className="mb-2 flex gap-2">
                      {medPresets.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setHoldDaysStr(String(d))}
                          className={`flex-1 rounded-xl py-2 text-sm font-bold transition-all active:scale-95 ${
                            holdDaysStr === String(d) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {d}일
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={holdDaysStr}
                      onChange={(e) => setHoldDaysStr(e.target.value.replace(/\D/g, "").slice(0, 3))}
                      onBlur={() => setHoldDaysStr(String(holdDays))}
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                      placeholder="직접 입력 (일)"
                    />

                    <p className="mb-1.5 mt-3 text-xs font-medium text-muted-foreground">병원 서류 (진단서·소견서·입퇴원 확인서 등)</p>
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-background px-3 py-3 text-sm text-foreground transition-all active:scale-[0.99]">
                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 truncate">{docFile ? docFile.name : "사진 찍기 또는 파일 선택 (사진·PDF)"}</span>
                      <input
                        type="file"
                        accept={HOLD_DOC_ACCEPT}
                        className="hidden"
                        onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      주민등록번호(특히 뒷자리)는 가리고 올려 주세요. 진단명과 치료·안정 기간만 보이면 됩니다.
                    </p>

                    <label className="mt-3 flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={medConsent}
                        onChange={(e) => setMedConsent(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span>
                        <b className="text-foreground">[필수] 건강정보 수집·이용 동의</b> — 목적: 부상·질병 홀딩 심사 · 항목: 병원 서류에 적힌 진단명·치료 기간 · 보관: 관장님이 승인·반려하면 바로 삭제. 동의하지 않으면 부상·질병 홀딩은 신청할 수 없고, 일반 홀딩은 그대로 이용할 수 있습니다.
                      </span>
                    </label>
                  </>
                )}
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
                    {contractDays != null && contractDays > 0 && usedDaysExHold != null && (
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-muted-foreground">이용 경과{heldSoFar > 0 ? ` (홀딩 ${heldSoFar}일 제외)` : ""}</span>
                        <span className="text-foreground">{Math.min(usedDaysExHold, contractDays)} / {contractDays}일</span>
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
                    <p className="mt-1.5 text-[11px] text-muted-foreground">할인 상품은 중도 해지 시 이용기간이 정상가로 재산정됩니다. 예상액은 1개월 정상가 22만원 ÷ 30일 기준이며, 주3회권은 확정할 때 18만원 기준으로 다시 계산합니다. 홀딩 기간은 빼고 계산하며, 지급 장비·부대서비스는 별도이고 최종 금액은 관장님이 확정합니다.</p>
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
                    ? holdKind === "medical"
                      ? "예: 다쳐서 4주 동안 운동이 어렵습니다 (진단명은 서류로 확인하니 적지 않아도 돼요)"
                      : "예: 출장으로 2주간 이용이 어렵습니다"
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
                (modal === "transfer" && (!tName.trim() || !tPhone.trim())) ||
                (modal === "hold" && holdKind === "regular" && !regularEligible) ||
                (modal === "hold" && holdKind === "medical" && (!docFile || !medConsent)) ||
                (modal === "hold" && !holdDaysValid)
              }
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {submitting
                ? "신청 중..."
                : modal === "hold"
                ? holdKind === "medical"
                  ? `부상·질병 ${holdDays}일 홀딩 신청`
                  : `${holdDays}일 홀딩 신청`
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
