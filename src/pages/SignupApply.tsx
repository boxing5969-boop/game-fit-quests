// 신규 회원 가입 신청 (앱으로 가입신청서 작성) — 153복싱짐 선릉역점.
// 계정정보 → 추가정보(성별·목표·건강) → 규정·동의(약관·개인정보·스파링·면책) → 수강권(개월수) 선택 → 바로 결제.
// 결제 진행 시 create-bill 이 회원을 자동 승인(가입 확정)하고 결제선생 결제창으로 이동한다.
import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GYM_POLICIES } from "@/data/gymPolicies";
import { toast } from "sonner";

const BRANCH = "153복싱짐 선릉역점";
const toFakeEmail = (id: string) => `${id.toLowerCase().trim()}@153rankup.app`;
const rawDigits = (s: string) => s.replace(/[^0-9]/g, "");
const formatPhone = (v: string) => {
  const d = rawDigits(v).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};
const won = (n: number) => n.toLocaleString("ko-KR") + "원";

interface Product {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground";
const STEPS = ["계정 정보", "추가 정보", "규정 동의", "수강권 선택"];

const SignupApply = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const loggedIn = !!user; // 소셜(구글/카카오) 로그인 후 가입 신청 → 계정 생성 단계 건너뜀
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 계정
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [gender, setGender] = useState("");
  // 추가
  const [goal, setGoal] = useState("");
  const [health, setHealth] = useState("");
  // 동의
  const [agree, setAgree] = useState<Record<string, boolean>>({});
  const [openPolicy, setOpenPolicy] = useState<string | null>(null);
  // 상품
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("membership_products")
        .select("id, name, price, duration_days")
        .eq("is_active", true)
        .gt("duration_days", 0)
        .order("sort_order", { ascending: true });
      setProducts((data as Product[]) || []);
    })();
  }, []);

  // 소셜 로그인 사용자: 기존 프로필 값 프리필(사용자가 입력 중이면 덮어쓰지 않음)
  useEffect(() => {
    if (!profile) return;
    const p = profile as { name?: string; nickname?: string; phone_number?: string; birth_date?: string; gender?: string };
    if (p.name) setName((v) => v || (p.name as string));
    if (p.nickname) setNickname((v) => v || (p.nickname as string));
    if (p.phone_number) setPhone((v) => v || formatPhone(p.phone_number as string));
    if (p.birth_date) setBirth((v) => v || (p.birth_date as string).replace(/[^0-9]/g, "").slice(0, 8));
    if (p.gender) setGender((v) => v || (p.gender as string));
  }, [profile]);

  const allAgreed = GYM_POLICIES.every((p) => !p.required || agree[p.key]);
  const setAllAgree = (v: boolean) => setAgree(Object.fromEntries(GYM_POLICIES.map((p) => [p.key, v])));

  const validateStep1 = () => {
    if (!loggedIn) {
      if (!/^[a-z0-9_]{4,}$/.test(username.trim())) return "아이디는 영문·숫자·밑줄(_) 4자 이상이어야 합니다";
      if (password.length < 6) return "비밀번호는 6자 이상이어야 합니다";
      if (password !== confirm) return "비밀번호가 일치하지 않습니다";
    }
    if (!name.trim()) return "이름을 입력해주세요";
    if (!nickname.trim()) return "닉네임을 입력해주세요";
    if (rawDigits(phone).length < 10) return "전화번호를 정확히 입력해주세요";
    if (birth.length !== 8) return "생년월일 8자리를 입력해주세요 (예: 19990315)";
    if (!gender) return "성별을 선택해주세요";
    return "";
  };

  const next = () => {
    setErr("");
    if (step === 1) {
      const e = validateStep1();
      if (e) return setErr(e);
    }
    if (step === 3 && !allAgreed) return setErr("필수 약관에 모두 동의해주세요");
    setStep((s) => Math.min(4, s + 1));
  };
  const back = () => {
    setErr("");
    if (step === 1) navigate(loggedIn ? "/home" : "/login");
    else setStep((s) => s - 1);
  };

  const submit = async () => {
    if (!productId) return setErr("수강권(개월수)을 선택해주세요");
    setErr("");
    setSubmitting(true);
    try {
      const phoneDigits = rawDigits(phone);
      // 전화번호 중복 체크 (소셜 로그인 본인은 제외)
      let dupQ = supabase.from("profiles").select("user_id").eq("phone_number", phoneDigits);
      if (loggedIn && user) dupQ = dupQ.neq("user_id", user.id);
      const { data: dup } = await dupQ.maybeSingle();
      if (dup) {
        setErr("이미 등록된 전화번호입니다. 한 번호당 하나의 계정만 가능합니다.");
        setSubmitting(false);
        return;
      }

      let uid: string | null = user?.id ?? null;
      if (!loggedIn) {
        const email = toFakeEmail(username);
        const { data: su, error: suErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name.trim(),
              nickname: nickname.trim(),
              phone_number: phoneDigits,
              branch_name: BRANCH,
              birth_date: birth,
              is_coach_request: false,
            },
          },
        });
        if (suErr) {
          setErr(/registered|already/i.test(suErr.message) ? "이미 사용 중인 아이디입니다." : "가입 처리 중 오류가 발생했습니다. 아이디나 전화번호가 사용 중일 수 있습니다.");
          setSubmitting(false);
          return;
        }
        uid = su.user?.id ?? null;
        if (!su.session) await supabase.auth.signInWithPassword({ email, password });
      }
      if (uid) {
        await supabase
          .from("profiles")
          .update({
            name: name.trim(),
            nickname: nickname.trim(),
            phone_number: phoneDigits,
            branch_name: BRANCH,
            birth_date: birth,
            gender,
            fitness_goal: goal.trim() || null,
            health_notes: health.trim() || null,
            signup_agreements: { ...agree, version: "2026-06" },
            signup_agreed_at: new Date().toISOString(),
            gym_reg_date: new Date().toISOString().slice(0, 10),
          } as never)
          .eq("user_id", uid);
      }
      const { data, error } = await supabase.functions.invoke("payssam-create-bill", { body: { product_id: productId } });
      if (error || (data && (data as { error?: string }).error)) {
        toast.error((data as { error?: string })?.error || "결제 요청에 실패했습니다. 로그인 후 수강권 탭에서 결제할 수 있습니다.");
        navigate("/membership", { replace: true });
        return;
      }
      const shortUrl = (data as { shortUrl?: string })?.shortUrl;
      if (shortUrl) {
        window.location.replace(shortUrl); // 결제창으로 이동(뒤로가기로 가입폼에 안 돌아오게)
      } else {
        toast.success("가입 신청이 완료되었습니다. 수강권 탭에서 결제를 진행해주세요.");
        navigate("/membership", { replace: true });
      }
    } catch (e) {
      setErr("처리 중 오류가 발생했습니다: " + ((e as Error)?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === productId);

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-4">
      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={back} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">신규 회원 가입 신청</h1>
          <p className="text-[11px] text-muted-foreground">153복싱짐 선릉역점</p>
        </div>
      </div>

      {/* 진행바 */}
      <div className="mb-5 flex gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${i + 1 <= step ? "bg-primary" : "bg-muted"}`} />
            <p className={`mt-1 text-center text-[10px] ${i + 1 === step ? "font-bold text-primary" : "text-muted-foreground"}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* STEP 1 — 계정 */}
      {step === 1 && (
        <div className="space-y-3">
          {loggedIn ? (
            <div className="rounded-xl bg-primary/5 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">소셜 계정으로 로그인됨 — 아래 가입 정보만 작성하면 됩니다.</div>
          ) : (
            <>
              <Field label="아이디"><input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="영문·숫자 4자 이상" autoCapitalize="none" autoCorrect="off" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="비밀번호"><input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" /></Field>
                <Field label="비밀번호 확인"><input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="다시 입력" /></Field>
              </div>
            </>
          )}
          <Field label="이름(실명)"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="실명" /></Field>
          <Field label="닉네임"><input className={inputClass} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="링 위의 이름" /></Field>
          <Field label="전화번호"><input type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="생년월일"><input className={inputClass} value={birth} onChange={(e) => setBirth(rawDigits(e.target.value).slice(0, 8))} placeholder="19990315" inputMode="numeric" maxLength={8} /></Field>
            <Field label="성별">
              <div className="flex gap-2">
                {["남", "여"].map((g) => (
                  <button key={g} onClick={() => setGender(g)} className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${gender === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{g}</button>
                ))}
              </div>
            </Field>
          </div>
        </div>
      )}

      {/* STEP 2 — 추가 정보 */}
      {step === 2 && (
        <div className="space-y-3">
          <Field label="운동 목표 (선택)">
            <input className={inputClass} value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="예: 다이어트 / 체력 / 취미 / 선수 준비" />
          </Field>
          <Field label="건강 특이사항 (선택)">
            <textarea rows={4} className={`${inputClass} resize-none`} value={health} onChange={(e) => setHealth(e.target.value)} placeholder="부상·질환·수술 이력 등 운동 전 알아야 할 내용이 있으면 적어주세요. 없으면 비워두셔도 됩니다." />
          </Field>
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">건강 특이사항은 안전한 지도를 위해서만 사용되며, 본인·관장·지도자만 확인합니다.</p>
        </div>
      )}

      {/* STEP 3 — 규정 동의 */}
      {step === 3 && (
        <div className="space-y-2.5">
          <button onClick={() => setAllAgree(!allAgreed)} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold transition-all active:scale-[0.99] ${allAgreed ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-md ${allAgreed ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{allAgreed && <Check className="h-3.5 w-3.5" />}</span>
            전체 동의
          </button>
          {GYM_POLICIES.map((p) => {
            const on = !!agree[p.key];
            const open = openPolicy === p.key;
            return (
              <div key={p.key} className="rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <button onClick={() => setAgree((a) => ({ ...a, [p.key]: !on }))} className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${on ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{on && <Check className="h-3.5 w-3.5" />}</button>
                  <button onClick={() => setOpenPolicy(open ? null : p.key)} className="flex flex-1 items-center justify-between text-left">
                    <span className="text-sm font-semibold text-foreground">{p.title}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {open && <p className="whitespace-pre-line border-t border-border px-3 py-3 text-xs leading-relaxed text-muted-foreground">{p.body}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 4 — 수강권 선택 */}
      {step === 4 && (
        <div className="space-y-2.5">
          <p className="px-1 text-xs text-muted-foreground">등록하실 수강권을 선택하세요. 다음 단계에서 안전한 결제창으로 이동합니다.</p>
          {products.map((p) => (
            <button key={p.id} onClick={() => setProductId(p.id)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${productId === p.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <div>
                <p className="text-sm font-bold text-foreground">{p.name}</p>
                <p className="text-[11px] text-muted-foreground">{p.duration_days}일 이용</p>
              </div>
              <span className="text-sm font-black text-primary">{won(p.price)}</span>
            </button>
          ))}
          {products.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">등록 가능한 수강권이 없습니다. 관장님께 문의해주세요.</p>}
        </div>
      )}

      {err && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{err}</p>}

      {/* 하단 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-border bg-card p-4 safe-area-bottom">
        {step < 4 ? (
          <button onClick={next} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98]">다음</button>
        ) : (
          <button onClick={submit} disabled={submitting || !productId} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
            {submitting ? "처리 중..." : selectedProduct ? `${won(selectedProduct.price)} 결제하고 가입` : "수강권을 선택하세요"}
          </button>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
);

export default SignupApply;
