// 수강권 결제 상품 — 회원: 상품 선택 후 '결제하기'(결제선생 결제창으로 이동) / 관장·마스터: 상품 관리.
// 결제는 payssam-create-bill 엣지함수가 결제선생 청구서를 만들고 결제 URL(shortUrl)을 반환 → 그 URL 로 이동.
import { useState, useEffect, useCallback } from "react";
import { CreditCard, Plus, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Product {
  id: string;
  branch_name: string | null;
  name: string;
  price: number;
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

const MembershipProducts = () => {
  const { profile, role, refreshProfile, user } = useAuth();
  const isStaff = isManagerRole(role);
  const isAdmin = role === "admin" || role === "super_admin";
  const branch = profile?.branch_name ?? null;
  const memberPhone = ((profile as { phone_number?: string } | null)?.phone_number || "").replace(/\D/g, "");

  const [products, setProducts] = useState<Product[]>([]);
  const [paying, setPaying] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [phoneModal, setPhoneModal] = useState<Product | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);

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

  // ── 회원 결제 ──
  // 전화번호가 있으면 바로 결제, 없으면(카톡/구글 가입자) 번호 입력 모달을 먼저 띄운다.
  const pay = (p: Product) => {
    if (memberPhone.length < 10) {
      setPhoneInput("");
      setPhoneModal(p);
      return;
    }
    runBill(p);
  };

  const runBill = async (p: Product) => {
    setPaying(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("payssam-create-bill", { body: { product_id: p.id } });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (data?.shortUrl) {
        window.location.href = data.shortUrl as string; // 결제선생 결제창으로 이동
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
      const target = phoneModal;
      setPhoneModal(null);
      if (target) runBill(target);
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
          branch_name: isAdmin ? null : branch, // 마스터=전 지점 공통, 관장=본인 지점
        });
        if (error) throw error;
        toast.success("상품을 추가했습니다");
      } else if (editing) {
        const { error } = await (supabase as any)
          .from("membership_products")
          .update({ name, price, duration_days: duration })
          .eq("id", editing.id);
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

  // ── 회원 화면 ──
  if (!isStaff) {
    if (products.length === 0) return null;
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">수강권 결제</h3>
        </div>
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{p.duration_days}일 · {won(p.price)}</p>
              </div>
              <button
                onClick={() => pay(p)}
                disabled={paying === p.id}
                className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                {paying === p.id ? "이동 중..." : "결제하기"}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          결제하기를 누르면 안전한 결제창으로 이동합니다. 결제가 완료되면 수강권 기간이 자동으로 반영됩니다.
        </p>

        {/* 카톡/구글 가입자: 전화번호 없을 때 결제 전 간편 등록 */}
        {phoneModal && (
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
                {savingPhone ? "처리 중..." : `${won(phoneModal.price)} 결제하기`}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 관장·마스터 상품 관리 화면 ──
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">수강권 상품 관리</h3>
        </div>
        <button
          onClick={() => openEdit("new")}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" /> 추가
        </button>
      </div>

      {products.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">등록된 상품이 없습니다. '추가'로 수강권 상품을 만들어주세요.</p>
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
                  {p.duration_days}일 · {won(p.price)} · {p.branch_name ? p.branch_name : "전 지점 공통"}
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
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                  placeholder="예: 1개월 자유수강"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">금액(원)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                    placeholder="120000"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">기간(일)</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={form.duration_days}
                    onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                    placeholder="30"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                결제 완료 시 회원 수강권 만료일이 기간(일)만큼 자동 연장됩니다. {isAdmin ? "(전 지점 공통 상품으로 등록)" : "(본인 지점 상품으로 등록)"}
              </p>
            </div>
            <button
              onClick={save}
              disabled={saving}
              className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipProducts;
