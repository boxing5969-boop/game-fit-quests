// 수강권/부가상품 결제 — 회원: 탭(주5회·주3회·PT·용품·렌탈·1일권) + 상품 선택 후 결제 / 관장·마스터: 상품 관리.
// 수강권 탭은 정상가·할인율·원/일(하루 단가)을 노출하는 153멤버십 선택형 카드.
// 결제는 payssam-create-bill 엣지함수가 결제선생 청구서를 만들고 결제 URL(shortUrl)을 반환 → 그 URL 로 이동.
// 2026-10-21 대표님: 칠금점은 결제선생이 아직 없다 → 그 지점 회원에게는 가격표·결제 대신 '계좌이체 · 현장 결제' 안내만
//   (lib/branchPayment · components/membership/OfflinePayCard). 결제선생 흐름(선릉역점)은 그대로.
// 2026-10-21 대표님: "수강권 탭에서 결제하기 눌러도 마일리지 입력 탭이 없는데" → 모든 상품 결제 전에 확인 창을 띄우고
//   '153 마일리지 쓰기' 칸(components/membership/MileagePayBox)을 항상 보여 준다. 수강권은 환불 규정 확인도 같이.
//   점수 검사 · 청구 금액 계산은 그대로 서버(payssam-create-bill → DB mileage_max_use)가 한다.
// 2026-10-27 장바구니 (대표님 보고서 「앱 결제 장바구니」 · "나머진 니추천대로"): 수강권 결제 확인 창에서 운동복 · 락카도 같이 쓸지 묻고
//   (수강권과 같은 개월, 줄일 수 있게) 결제선생 링크 1개로 결제한다(body.cart). 렌탈 탭은 운동복 · 락카만 연장하는 장바구니.
//   운동복 · 락카를 안 담은 수강권 · PT · 용품 · 1일권은 예전처럼 상품 하나(body.product_id). 계산은 lib/cartPricing.
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { CreditCard, Plus, Pencil, Trash2, X, Settings, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PromoBanner from "@/components/PromoBanner";
import PayssamInspectPanel from "@/components/PayssamInspectPanel";
import { calcRefund, normalDailyRate, SIM_MONTHS } from "@/lib/refundPolicy";
import { useMyMileage } from "@/hooks/useMileage";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import { isOfflinePayBranch } from "@/lib/branchPayment";
import OfflinePayCard from "@/components/membership/OfflinePayCard";
import MileagePayBox from "@/components/membership/MileagePayBox";
import RentalAddOns from "@/components/membership/RentalAddOns";
import { clampMileageUse, maxMileageUse } from "@/lib/mileagePay";
import {
  MAX_RENTAL_MONTHS,
  cartLines,
  cartTotal,
  endText,
  extendedEnd,
  membershipMonths,
  mileageBase,
  rentalKindOf,
  type RentalKind,
} from "@/lib/cartPricing";
import { kstToday } from "@/lib/levelPractice";

interface Product {
  id: string;
  branch_name: string | null;
  category: string; // membership | pt | goods | rental | daypass
  pass_type: string | null; // 주5회 | 주3회 (membership)
  name: string;
  price: number;
  normal_price: number | null;
  duration_days: number;
  sort_order: number;
  is_active: boolean;
}

const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};
const blankForm = { name: "", price: "", duration_days: "30" };

/** 결제 확인 창에 올린 것 — 상품 하나(PT · 용품 · 1일권), 수강권(+ 운동복 · 락카), 또는 운동복 · 락카만(product = null) */
type Checkout = { product: Product | null; rentals: Record<RentalKind, number> };
const NO_RENTALS: Record<RentalKind, number> = { sportswear: 0, locker: 0 };

// 회원 화면 카테고리 탭
const CATS = [
  { key: "m5", label: "주5회", match: (p: Product) => p.category === "membership" && (p.pass_type === "주5회" || p.pass_type === "무제한") },
  { key: "m3", label: "주3회", match: (p: Product) => p.category === "membership" && p.pass_type === "주3회" },
  { key: "pt", label: "PT", match: (p: Product) => p.category === "pt" },
  { key: "goods", label: "용품", match: (p: Product) => p.category === "goods" },
  { key: "rental", label: "렌탈", match: (p: Product) => p.category === "rental" },
  { key: "day", label: "1일권", match: (p: Product) => p.category === "daypass" },
] as const;
const CAT_LABEL: Record<string, string> = { membership: "수강권", pt: "PT", goods: "용품", rental: "렌탈", daypass: "1일권" };

const MembershipProducts = () => {
  const { profile, role, refreshProfile, user } = useAuth();
  const isStaff = isManagerRole(role);
  const isAdmin = role === "admin" || role === "super_admin";
  const branch = profile?.branch_name ?? null;
  const memberPhone = ((profile as { phone_number?: string } | null)?.phone_number || "").replace(/\D/g, "");

  const [products, setProducts] = useState<Product[]>([]);
  const [paying, setPaying] = useState<string | null>(null);
  const [activeCatKey, setActiveCatKey] = useState<string>("m5");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [phoneModal, setPhoneModal] = useState<{ amount: number } | null>(null); // 번호 입력 창 — 결제할 금액
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [showProductAdmin, setShowProductAdmin] = useState(false); // 마스터 전용 상품 설정 패널 열림 여부
  const [checkout, setCheckout] = useState<Checkout | null>(null); // 결제 전 확인 창(환불 규정 · 운동복/락카 · 마일리지)
  const [confirmAgree, setConfirmAgree] = useState(false);
  // 렌탈 탭 — 운동복 · 락카만 연장할 개월 (2026-10-27)
  const [rentalPick, setRentalPick] = useState<Record<RentalKind, number>>(NO_RENTALS);
  // 153 마일리지 쓰기 (2026-10-15) — 결제 확인 창에서 고른 점수. 결제선생 청구 금액에서 빠지고, 결제가 끝나야 차감된다.
  //   2026-10-21: 체크 하나(최대만) → 점수 입력칸. 지도진 계정도 읽는다 — 칸이 왜 비어 있는지(적립 제외) 보여 주려고.
  const [mileagePts, setMileagePts] = useState(0);
  // 번호 입력 창을 거쳐도 고른 것(장바구니 · 점수)이 남게
  const pendingPay = useRef<{ checkout: Checkout; mileage: number } | null>(null);
  const mileage = useMyMileage();
  const mileageBalance = mileage.data?.balance ?? 0;
  const today = kstToday();
  const rentalEnds = profile as { locker_end?: string | null; sportswear_end?: string | null } | null;

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("membership_products")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("price", { ascending: true });
    let list = ((data as Product[]) || []).filter((p) => p.branch_name === null || p.branch_name === branch);
    if (!isStaff) list = list.filter((p) => p.is_active);
    setProducts(list);
  }, [branch, isStaff]);

  useEffect(() => {
    load();
  }, [load]);

  // 수강권 카드의 '연장하기'(/membership?cat=rental · ?buy=1) → 그 탭을 열고 결제 칸으로 내려 준다 (2026-10-27)
  const location = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const cat = q.get("cat");
    if (!cat && q.get("buy") !== "1") return;
    if (cat && CATS.some((c) => c.key === cat)) setActiveCatKey(cat);
    const t = setTimeout(() => rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    return () => clearTimeout(t);
  }, [location.key, location.search]);

  // ── 장바구니 계산 (2026-10-27) — 렌탈 한 달 가격은 상품표 '렌탈'의 운동복 · 개인 락카 (1개월)
  const rentalUnit = useMemo(() => {
    const u: Partial<Record<RentalKind, number>> = {};
    for (const p of products) {
      if (p.category !== "rental" || !p.is_active) continue;
      const k = rentalKindOf(p.name);
      if (k && u[k] == null) u[k] = p.price;
    }
    return u;
  }, [products]);
  const isCartCheckout = (c: Checkout) =>
    !c.product || (c.product.category === "membership" && c.rentals.sportswear + c.rentals.locker > 0);
  const linesFor = (c: Checkout) =>
    cartLines({
      membership: c.product?.category === "membership" ? { name: c.product.name, price: c.product.price, days: c.product.duration_days } : null,
      sportswearMonths: c.rentals.sportswear,
      lockerMonths: c.rentals.locker,
      unitPrice: { sportswear: rentalUnit.sportswear ?? 0, locker: rentalUnit.locker ?? 0 },
    });
  const checkoutTotal = (c: Checkout) => (isCartCheckout(c) ? cartTotal(linesFor(c)) : c.product?.price ?? 0);
  const checkoutMileageBase = (c: Checkout) => (isCartCheckout(c) ? mileageBase(linesFor(c)) : c.product?.price ?? 0);

  // ── 회원 결제 ── 전화번호 있으면 바로 결제, 없으면(카톡/구글 가입자) 번호 입력 모달 먼저.
  const pay = (c: Checkout, mileagePts = 0) => {
    pendingPay.current = { checkout: c, mileage: mileagePts };
    if (memberPhone.length < 10) {
      setPhoneInput("");
      setPhoneModal({ amount: checkoutTotal(c) - mileagePts });
      return;
    }
    void runBill();
  };

  // 결제 전 확인 창 — 수강권: '환불 규정 확인'(환불 억제) + 운동복 · 락카 담기 + 마일리지 / PT·용품·1일권: 마일리지만 (2026-10-21)
  const askConfirm = (p: Product | null, rentals: Record<RentalKind, number> = NO_RENTALS) => {
    setConfirmAgree(false);
    setMileagePts(0);
    setCheckout({ product: p, rentals });
  };

  const runBill = async () => {
    const pend = pendingPay.current;
    pendingPay.current = null;
    if (!pend) return;
    const c = pend.checkout;
    setPaying(c.product?.id ?? "rental-cart");
    try {
      const use_mileage = pend.mileage;
      const body = isCartCheckout(c)
        ? {
            cart: {
              membership_product_id: c.product?.category === "membership" ? c.product.id : null,
              sportswear_months: c.rentals.sportswear,
              locker_months: c.rentals.locker,
            },
            use_mileage,
          }
        : { product_id: c.product!.id, use_mileage };
      const { data, error } = await supabase.functions.invoke("payssam-create-bill", { body });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.shortUrl) {
        if (isIosApp()) {
          // 아이폰 앱: 앱 안 사파리 창으로 결제 (카드사 앱 이동이 그대로 된다). 창을 닫으면 결제 결과를 다시 읽는다 (2026-10-19)
          await (await loadIosAppNative()).openInAppBrowser(data.shortUrl as string, () => window.location.reload());
        } else {
          window.location.href = data.shortUrl as string;
        }
      } else {
        toast.error("결제 URL을 받지 못했습니다.");
      }
    } catch (e) {
      toast.error("결제 요청 실패: " + ((e as Error)?.message || ""));
    } finally {
      setPaying(null);
    }
  };

  // 카톡/구글 가입자: 번호 입력 → 선릉역점 회원 등록(번호·지점·등록일) 후 결제 진행.
  const savePhoneAndPay = async () => {
    const digits = phoneInput.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("전화번호를 정확히 입력해주세요.");
      return;
    }
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          phone_number: digits,
          branch_name: branch || "153복싱짐 선릉역점",
          gym_reg_date: new Date().toISOString().slice(0, 10),
        } as never)
        .eq("user_id", user?.id ?? "");
      if (error) {
        if (/duplicate|unique|23505/i.test(error.message)) {
          toast.error("이미 등록된 번호입니다. 기존 회원이시면 로그인 화면의 '기존 회원 연동'을 이용해주세요.");
        } else {
          toast.error("번호 저장 실패: " + error.message);
        }
        return;
      }
      await refreshProfile?.();
      setPhoneModal(null);
      void runBill();
    } catch (e) {
      toast.error("처리 중 오류: " + ((e as Error)?.message || ""));
    } finally {
      setSavingPhone(false);
    }
  };

  // ── 관장 상품 관리 ──
  const openEdit = (p: Product | "new") => {
    if (p === "new") setForm(blankForm);
    else setForm({ name: p.name, price: String(p.price), duration_days: String(p.duration_days) });
    setEditing(p);
  };

  const save = async () => {
    const name = form.name.trim();
    const price = Number(form.price);
    const duration = Number(form.duration_days);
    if (!name || !(price >= 0) || !(duration >= 0)) {
      toast.error("상품명·금액·기간을 확인해주세요");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        const { error } = await (supabase as any).from("membership_products").insert({
          name,
          price,
          duration_days: duration,
          branch_name: isAdmin ? null : branch,
        });
        if (error) throw error;
        toast.success("상품을 추가했습니다");
      } else if (editing) {
        const { error } = await (supabase as any).from("membership_products").update({ name, price, duration_days: duration }).eq("id", editing.id);
        if (error) throw error;
        toast.success("상품을 수정했습니다");
      }
      setEditing(null);
      load();
    } catch (e) {
      toast.error("저장 실패: " + ((e as Error)?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    const { error } = await (supabase as any).from("membership_products").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) toast.error("변경 실패: " + error.message);
    else load();
  };

  const remove = async (p: Product) => {
    if (!confirm(`'${p.name}' 상품을 삭제할까요?`)) return;
    const { error } = await (supabase as any).from("membership_products").delete().eq("id", p.id);
    if (error) toast.error("삭제 실패: " + error.message);
    else {
      toast.success("삭제했습니다");
      load();
    }
  };

  // 결제 전 전화번호 모달 JSX (회원 공용, 인라인 — 중첩 컴포넌트로 만들면 입력 포커스 튐)
  const phoneModalJsx = phoneModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setPhoneModal(null)}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">전화번호 확인</h2>
          <button onClick={() => setPhoneModal(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          결제·회원 관리를 위해 전화번호가 필요합니다. 번호를 입력하면 <b className="text-foreground">153복싱짐 선릉역점</b> 회원으로 등록되고 바로 결제가 진행됩니다.
        </p>
        <input
          type="tel"
          inputMode="numeric"
          value={phoneInput}
          onChange={(e) => setPhoneInput(formatPhone(e.target.value))}
          placeholder="010-0000-0000"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          onClick={savePhoneAndPay}
          disabled={savingPhone}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {savingPhone ? "처리 중..." : `${won(phoneModal.amount)} 결제하기`}
        </button>
      </div>
    </div>
  ) : null;

  // ── 회원 화면(가격표·결제) — 회원/관장/마스터 모두 동일하게 노출 ──
  //    스태프는 아래에서 관리 패널을 함께 보되, 이 미리보기는 회원이 실제로
  //    보는 것과 동일하도록 활성 상품만(비활성 제외) 기준으로 렌더한다.
  const memberBase = isStaff ? products.filter((p) => p.is_active) : products;
  // 데스크 결제 지점(칠금점) — 결제선생 결제를 열지 않는다
  const offlinePay = isOfflinePayBranch(branch);
  const memberView = (() => {
    if (offlinePay && branch) return <div ref={rootRef} className="scroll-mt-4"><OfflinePayCard branch={branch} /></div>;
    if (memberBase.length === 0) return null;
    const activeCats = CATS.filter((c) => memberBase.some((p) => c.match(p)));
    const cat = activeCats.find((c) => c.key === activeCatKey) ?? activeCats[0];
    const isMembership = cat?.key === "m5" || cat?.key === "m3";
    // 렌탈 탭: 운동복 · 락카는 장바구니(개월 고르기) 하나로, 그 밖의 렌탈 상품만 예전 카드로 (2026-10-27)
    const isRentalTab = cat?.key === "rental";
    const rentalCartKinds = (["sportswear", "locker"] as const).filter((k) => (rentalUnit[k] ?? 0) > 0);
    const list = (cat ? memberBase.filter(cat.match) : []).filter((p) => {
      const k = isRentalTab ? rentalKindOf(p.name) : null;
      return !k || !rentalCartKinds.includes(k);
    });
    const rentalPickTotal = isRentalTab ? checkoutTotal({ product: null, rentals: rentalPick }) : 0;

    return (
      <div ref={rootRef} className="scroll-mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-base font-bold text-foreground">153멤버십</h3>
        </div>

        {/* 카테고리 탭 */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {activeCats.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveCatKey(c.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 ${
                cat?.key === c.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* 이용 안내 (수강권 탭) */}
        {isMembership && (
          <div className="mb-3 rounded-2xl bg-muted/40 px-4 py-2">
            <div className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-muted-foreground">이용 시간</span>
              <span className="font-semibold text-foreground">매일 00:00 – 23:59</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 py-1.5 text-sm">
              <span className="text-muted-foreground">이용 지점</span>
              <span className="font-semibold text-foreground">153복싱짐 선릉역점</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 py-1.5 text-sm">
              <span className="text-muted-foreground">멤버십 종류</span>
              <span className="font-semibold text-foreground">{cat?.key === "m5" ? "주5회 기간권" : "주3회 기간권"}</span>
            </div>
          </div>
        )}

        {/* 공지·이벤트 배너 */}
        <div className="mb-3">
          <PromoBanner />
        </div>

        {isMembership && <p className="mb-2 px-0.5 text-base font-bold text-foreground">이용 기간</p>}

        {/* 렌탈 탭 — 운동복 · 락카만 연장 (수강권 없이, 링크 1개) */}
        {isRentalTab && rentalCartKinds.length > 0 && (
          <div className="mb-2.5">
            <RentalAddOns
              mode="standalone"
              maxMonths={MAX_RENTAL_MONTHS}
              value={rentalPick}
              onChange={setRentalPick}
              unitPrice={rentalUnit}
              currentEnd={{ sportswear: rentalEnds?.sportswear_end ?? null, locker: rentalEnds?.locker_end ?? null }}
              today={today}
            />
            <button
              onClick={() => askConfirm(null, rentalPick)}
              disabled={rentalPickTotal <= 0 || paying === "rental-cart"}
              className="mt-2.5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {paying === "rental-cart" ? "이동 중..." : rentalPickTotal > 0 ? `${won(rentalPickTotal)} 결제하기` : "개월을 골라 주세요"}
            </button>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
              수강권을 결제할 때 같이 담으면 수강권과 같은 개월로 한 번에 결제돼요.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          {list.map((p) => {
            const months = Math.max(1, Math.round(p.duration_days / 30));
            const perDay = p.duration_days > 0 ? Math.round(p.price / p.duration_days) : 0;
            const off = p.normal_price && p.normal_price > p.price ? Math.round((1 - p.price / p.normal_price) * 100) : 0;
            if (isMembership) {
              return (
                <div key={p.id} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-black text-foreground">{months}개월</span>
                        {off > 0 && <span className="text-sm font-bold text-[#f97316]">{off}% OFF</span>}
                      </div>
                      <p className="mt-1">
                        {p.normal_price ? <span className="text-sm text-muted-foreground line-through">{won(p.normal_price)}</span> : null}
                        <span className="ml-1.5 text-base font-bold text-foreground">{won(p.price)}</span>
                      </p>
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-right leading-none">
                      <span className="text-[28px] font-black text-foreground">{perDay.toLocaleString("ko-KR")}</span>
                      <span className="ml-0.5 text-sm font-bold text-muted-foreground">원/일</span>
                    </div>
                  </div>
                  <button
                    onClick={() => askConfirm(p)}
                    disabled={paying === p.id}
                    className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {paying === p.id ? "이동 중..." : "결제하기"}
                  </button>
                </div>
              );
            }
            return (
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-foreground">{p.name}</p>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">
                    {won(p.price)}
                    {p.duration_days > 0 ? <span className="font-normal text-muted-foreground"> · {p.duration_days}일</span> : null}
                  </p>
                </div>
                <button
                  onClick={() => askConfirm(p)}
                  disabled={paying === p.id}
                  className="shrink-0 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
                >
                  {paying === p.id ? "이동 중..." : "결제하기"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          결제하기를 누르면 안전한 결제창으로 이동합니다. 수강권은 결제 완료 시 기간이 자동 반영됩니다.
        </p>
        {phoneModalJsx}
        {checkout && (() => {
          const c = checkout;
          const p = c.product;
          const close = () => setCheckout(null);
          // 수강권만 환불 규정 확인 — PT·용품·렌탈·1일권은 금액 · 마일리지만 보고 결제 (2026-10-21)
          const isMem = p?.category === "membership";
          // 장바구니(수강권 + 운동복 · 락카, 또는 운동복 · 락카만) — 담은 줄 · 합계 · 끝나는 날 (2026-10-27)
          const lines = isCartCheckout(c) ? linesFor(c) : [];
          const hasRentals = lines.some((l) => l.kind !== "membership");
          const total = checkoutTotal(c);
          const memMonths = isMem && p ? membershipMonths(p.duration_days) : 0;
          const nd = isMem && p ? normalDailyRate(p.normal_price, p.duration_days) : 0;
          const months = memMonths;
          const off = p?.normal_price && p.normal_price > p.price ? Math.round((1 - p.price / p.normal_price) * 100) : 0;
          const discountAmt = isMem && p?.normal_price && p.normal_price > p.price ? p.normal_price - p.price : 0;
          const rows = isMem && p
            ? SIM_MONTHS.filter((m) => m * 30 < p.duration_days).map((m) => ({ m, ...calcRefund({ paid: p.price, normalDaily: nd, elapsedDays: m * 30 }) }))
            : [];
          const maxUse = maxMileageUse(mileageBalance, checkoutMileageBase(c));
          const usePts = clampMileageUse(mileagePts, maxUse);
          const payWon = won(total - usePts);
          const curEnd: Record<"membership" | RentalKind, string | null> = {
            membership: (profile as { membership_end?: string | null } | null)?.membership_end ?? null,
            sportswear: rentalEnds?.sportswear_end ?? null,
            locker: rentalEnds?.locker_end ?? null,
          };
          return (
            <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center" onClick={close}>
              <div
                className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-base font-black text-foreground">결제 확인</h3>
                  <button onClick={close} aria-label="닫기" className="rounded-lg p-1 text-muted-foreground active:scale-95"><X className="h-5 w-5" /></button>
                </div>
                {isMem && p ? (
                  <p className="text-sm text-muted-foreground">{p.name} · {months}개월 약정 · <span className="font-bold text-foreground">{won(p.price)}</span>{off > 0 ? ` · 정상가 ${won(p.normal_price ?? 0)} (${off}% 할인)` : ""}</p>
                ) : p ? (
                  <p className="text-sm text-muted-foreground">
                    {CAT_LABEL[p.category] ?? "상품"} · {p.name} · <span className="font-bold text-foreground">{won(p.price)}</span>
                    {p.duration_days > 0 ? ` · ${p.duration_days}일` : ""}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">운동복 · 락카 연장 · 결제 링크 하나로 한 번에</p>
                )}

                {/* 수강권과 같이 — 운동복 · 락카 담기 (수강권 개월만큼, 줄일 수 있게) */}
                {isMem && p && (
                  <RentalAddOns
                    className="mt-3"
                    mode="addon"
                    maxMonths={memMonths}
                    value={c.rentals}
                    onChange={(next) => setCheckout({ ...c, rentals: next })}
                    unitPrice={rentalUnit}
                    currentEnd={curEnd}
                    membership={{ months: memMonths, days: p.duration_days }}
                    today={today}
                  />
                )}

                {/* 장바구니 — 담은 것 · 끝나는 날 · 합계 (링크 1개) */}
                {(hasRentals || !p) && lines.length > 0 && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3" aria-label="결제할 것">
                    <p className="text-sm font-black text-foreground">결제할 것</p>
                    {lines.map((l) => (
                      <div key={l.kind} className="mt-2 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-bold text-foreground">{l.label}</p>
                          <p className="text-[11.5px] text-muted-foreground">{endText(extendedEnd(curEnd[l.kind], l.days, today), today)}까지</p>
                        </div>
                        <span className="shrink-0 text-[13.5px] font-black tabular-nums text-foreground">{won(l.amount)}</span>
                      </div>
                    ))}
                    <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2.5">
                      <span className="text-[13px] font-bold text-foreground">합계</span>
                      <span className="text-base font-black tabular-nums text-foreground">{won(total)}</span>
                    </div>
                  </div>
                )}

                {isMem && (rows.length > 0 || discountAmt > 0) && (
                  <p className="mt-4 text-sm font-black text-foreground">환불 규정</p>
                )}

                {discountAmt > 0 && (
                  <div className="mt-3 rounded-xl border border-[#f97316]/40 bg-[#f97316]/10 p-3">
                    <p className="text-sm font-bold text-[#f97316]">⚠️ 중도 해지 시 손해가 발생합니다</p>
                    <p className="mt-1 text-xs leading-relaxed text-foreground">이용하신 기간은 <b>할인 전 정상가</b>로 재산정됩니다. 지금 받으신 할인 혜택 <b>{won(discountAmt)}</b>이 사라져, 조기 환불 시 돌려받는 금액이 크게 줄어듭니다.</p>
                  </div>
                )}

                {rows.length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-border">
                    <div className="grid grid-cols-3 bg-muted/50 px-3 py-2 text-[11px] font-bold text-muted-foreground">
                      <span>환불 시점</span><span className="text-right">돌려받는 금액</span><span className="text-right">손해</span>
                    </div>
                    {rows.map((r) => (
                      <div key={r.m} className="grid grid-cols-3 border-t border-border px-3 py-2 text-sm">
                        <span className="text-foreground">{r.m}개월 사용 후</span>
                        <span className="text-right font-bold text-foreground">{won(r.refund)}</span>
                        <span className="text-right font-bold text-destructive">-{won(r.loss)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {isMem && p && (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">끝까지 이용하시면 하루 {(p.duration_days > 0 ? Math.round(p.price / p.duration_days) : 0).toLocaleString("ko-KR")}원으로 가장 이득입니다. 위약금(10%)·개인 위생용품은 별도이며, 최종 환불액은 관장님이 확정합니다.</p>
                )}
                {hasRentals && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    운동복 · 락카는 환불할 때 남은 기간만큼 날짜로 나눠 돌려 드려요.
                    {lines.some((l) => l.kind === "locker") && !(curEnd.locker && curEnd.locker >= today) ? " 락카 번호는 결제 후 데스크에서 정해 드려요." : ""}
                  </p>
                )}

                <MileagePayBox
                  className="mt-3"
                  price={checkoutMileageBase(c)}
                  payTotal={total}
                  baseLabel={isMem && hasRentals ? "수강권 금액" : undefined}
                  balance={mileageBalance}
                  loading={mileage.isLoading}
                  failed={mileage.isError}
                  isStaff={isStaff}
                  value={mileagePts}
                  onChange={setMileagePts}
                />

                {isMem && (
                  <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <input type="checkbox" checked={confirmAgree} onChange={(e) => setConfirmAgree(e.target.checked)} className="h-4 w-4 accent-primary" />
                    위 환불 규정을 확인했으며 이에 동의합니다.
                  </label>
                )}

                <button
                  onClick={() => {
                    close();
                    pay(c, clampMileageUse(mileagePts, maxMileageUse(mileageBalance, checkoutMileageBase(c))));
                  }}
                  disabled={(isMem && !confirmAgree) || total <= 0}
                  className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-40"
                >
                  {isMem ? `동의하고 ${payWon} 결제` : `${payWon} 결제하기`}
                </button>
                <button onClick={close} className="mt-2 w-full rounded-xl bg-muted py-2.5 text-sm font-bold text-muted-foreground active:scale-95">다시 볼게요</button>
              </div>
            </div>
          );
        })()}
      </div>
    );
  })();

  // 회원: 가격표·결제 화면만
  if (!isStaff) return memberView;

  // ── 관장·마스터: 회원과 동일한 가격표·결제 + 아래에 상품 관리 패널 ──
  return (
    <div className="space-y-3">
      {isAdmin && <PayssamInspectPanel />}
      {memberView}
      {isAdmin && (
        <button
          onClick={() => setShowProductAdmin((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-all active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">수강권·상품 설정</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">마스터</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showProductAdmin ? "rotate-180" : ""}`} />
        </button>
      )}
      {isAdmin && showProductAdmin && (
      <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">수강권·상품 관리</h3>
        </div>
        <button onClick={() => openEdit("new")} className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground active:scale-95">
          <Plus className="h-3.5 w-3.5" /> 추가
        </button>
      </div>

      {products.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">등록된 상품이 없습니다. '추가'로 상품을 만들어주세요.</p>
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {p.name}
                  {!p.is_active && <span className="ml-1.5 text-[10px] font-bold text-muted-foreground">(비활성)</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {CAT_LABEL[p.category] || p.category}
                  {p.pass_type ? ` ${p.pass_type}` : ""} · {won(p.price)}
                  {p.normal_price ? ` (정상 ${won(p.normal_price)})` : ""}
                  {p.duration_days > 0 ? ` · ${p.duration_days}일` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => toggleActive(p)} className="rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-foreground active:scale-95">
                  {p.is_active ? "숨김" : "노출"}
                </button>
                <button onClick={() => openEdit(p)} className="rounded-lg bg-muted p-1.5 text-muted-foreground active:scale-95">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(p)} className="rounded-lg bg-muted p-1.5 text-destructive active:scale-95">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 추가/수정 모달 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">{editing === "new" ? "상품 추가" : "상품 수정"}</h2>
              <button onClick={() => setEditing(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">상품명</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="예: 주5회 기간권 1개월" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">금액(원)</label>
                  <input type="number" inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="220000" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">기간(일)</label>
                  <input type="number" inputMode="numeric" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground" placeholder="30" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                기간(일)이 있으면 결제 시 수강권 만료일이 그만큼 연장됩니다(용품·PT는 0). 카테고리·정상가는 문의 시 일괄 설정해 드립니다.
              </p>
            </div>
            <button onClick={save} disabled={saving} className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
      )}
    </div>
  );
};

export default MembershipProducts;
