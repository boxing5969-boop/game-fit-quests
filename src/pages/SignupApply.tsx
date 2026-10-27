// 신규 회원 가입 신청 (앱으로 가입신청서 작성) — 153복싱짐 선릉역점.
// 계정정보 → 추가정보(성별·목표·건강) → 규정·동의(약관·개인정보·스파링·면책) → 수강권(개월수) 선택 → 바로 결제.
// 결제 진행 시 create-bill 이 회원을 자동 승인(가입 확정)하고 결제선생 결제창으로 이동한다.
//
// 기존 회원(2026-10-07): 체육관에 등록된 회원은 자동 동기화로 앱 계정이 이미 있다(아직 넘겨받지 않은 계정).
//   1단계 '다음'에서 전화번호·이름(·생년월일)을 서버(claim-member-account)에 확인해 기존 회원이면
//   수강권 선택·결제 없이 [계정 정보 → 추가 정보 → 규정 동의 → 가입 완료]로 끝난다.
//   · 방문자: 그 계정을 내가 정한 아이디·비밀번호로 넘겨받는다(레벨·출석·수강권 기록 그대로) → 바로 로그인.
//   · 소셜 로그인 회원: 기존 연동(link-imported-by-phone)으로 기존 계정의 기록을 이 계정에 합친다.
// 지점 고르기(2026-10-21 대표님: "칠금점 수강권은 따로 결제선생을 통해서 구축해야 돼. 일단 계좌이체와 오프라인 결제만"):
//   1단계 맨 위에서 지점을 고른다(선릉역점 · 칠금점). 선릉역점은 지금과 똑같이 수강권 선택 → 결제선생.
//   칠금점은 결제 단계 대신 '계좌이체 · 현장 결제' 안내 → 가입 신청만 하고 승인 대기 (데스크가 결제 확인 후 승인).
import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GYM_POLICIES } from "@/data/gymPolicies";
import { kstToday } from "@/lib/levelPractice";
import { toast } from "sonner";
import { SIGNUP_BRANCHES, branchShortName, isOfflinePayBranch } from "@/lib/branchPayment";
import OfflinePayCard from "@/components/membership/OfflinePayCard";

const AGREEMENT_VERSION = "2026-06";
const toFakeEmail = (id: string) => `${id.toLowerCase().trim()}@153rankup.app`;
const rawDigits = (s: string) => s.replace(/[^0-9]/g, "");
const formatPhone = (v: string) => {
  const d = rawDigits(v).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};
const won = (n: number) => n.toLocaleString("ko-KR") + "원";
const toIsoBirth = (b: string) => `${b.slice(0, 4)}-${b.slice(4, 6)}-${b.slice(6, 8)}`;

interface Product {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

/** claim-member-account 응답 — 회원 정보는 담겨 오지 않는다(판정 결과만). */
interface ClaimResponse {
  ok?: boolean;
  status?: string;
  error?: string;
  membershipActive?: boolean;
}

type MemberMode = "new" | "existing";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-body text-foreground placeholder:text-muted-foreground";
const STEPS_NEW = ["계정 정보", "추가 정보", "규정 동의", "수강권 선택"];
/** 데스크 결제 지점(칠금점) 신규 회원 — 결제 대신 결제 안내 */
const STEPS_NEW_OFFLINE = ["계정 정보", "추가 정보", "규정 동의", "결제 안내"];
const STEPS_EXISTING = ["계정 정보", "추가 정보", "규정 동의"];

const SignupApply = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, refreshProfile, refreshProgress } = useAuth();
  const loggedIn = !!user; // 소셜(구글/카카오) 로그인 후 가입 신청 → 계정 생성 단계 건너뜀
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 기존 회원 확인 — 1단계 '다음'에서 서버가 판정한다. existing 이면 결제 단계가 없다.
  const [memberMode, setMemberMode] = useState<MemberMode>("new");
  const [checking, setChecking] = useState(false);
  const [registeredPhone, setRegisteredPhone] = useState(false); // 이미 앱 계정이 있는 번호 → 로그인 안내 버튼
  // 다닐 지점 — 소셜 로그인 회원은 이미 고른 지점이 목록에 있으면 그대로, 아니면 직접 고른다
  const [branch, setBranch] = useState<string>(() => {
    const mine = (profile as { branch_name?: string | null } | null)?.branch_name ?? "";
    return SIGNUP_BRANCHES.some((b) => b.name === mine) ? mine : "";
  });
  const offline = isOfflinePayBranch(branch);
  const steps = memberMode === "existing" ? STEPS_EXISTING : offline ? STEPS_NEW_OFFLINE : STEPS_NEW;
  const lastStep = steps.length;

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
      const { data, error } = await (supabase as any)
        .from("membership_products")
        .select("id, name, price, duration_days")
        .eq("is_active", true)
        .gt("duration_days", 0)
        .order("sort_order", { ascending: true });
      // 조회가 막히면(RLS 등) 조용히 빈 목록이 되어 "수강권이 없습니다" 로만 보인다.
      // 원인을 남겨야 다음에 같은 일로 헤매지 않는다.
      if (error) console.error("[SignupApply] 수강권 목록 조회 실패:", error);
      setProducts((data as Product[]) || []);
    })();
  }, []);

  // 소셜 로그인 사용자: 기존 프로필 값 프리필(사용자가 입력 중이면 덮어쓰지 않음)
  useEffect(() => {
    if (!profile) return;
    const p = profile as { name?: string; nickname?: string; phone_number?: string; birth_date?: string; gender?: string; branch_name?: string | null };
    if (p.branch_name && SIGNUP_BRANCHES.some((b) => b.name === p.branch_name)) setBranch((v) => v || (p.branch_name as string));
    if (p.name) setName((v) => v || (p.name as string));
    if (p.nickname) setNickname((v) => v || (p.nickname as string));
    if (p.phone_number) setPhone((v) => v || formatPhone(p.phone_number as string));
    if (p.birth_date) setBirth((v) => v || (p.birth_date as string).replace(/[^0-9]/g, "").slice(0, 8));
    if (p.gender) setGender((v) => v || (p.gender as string));
  }, [profile]);

  const allAgreed = GYM_POLICIES.every((p) => !p.required || agree[p.key]);
  const setAllAgree = (v: boolean) => setAgree(Object.fromEntries(GYM_POLICIES.map((p) => [p.key, v])));

  const validateStep1 = () => {
    if (!branch) return "다니실 지점을 골라 주세요";
    if (!loggedIn) {
      const id = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{4,20}$/.test(id)) return "아이디는 영문·숫자·밑줄(_) 4~20자여야 합니다";
      // {전화번호}@153rankup.app 은 체육관 등록 회원 계정이 쓰는 주소 — 아이디로 쓰면 그 회원 계정과 부딪힌다.
      if (/^0\d{9,10}$/.test(id)) return "전화번호는 아이디로 쓸 수 없어요. 다른 아이디를 정해 주세요";
      if (password.length < 6) return "비밀번호는 6자 이상이어야 합니다";
      if (password !== confirm) return "비밀번호가 일치하지 않습니다";
    }
    if (!name.trim()) return "이름을 입력해주세요";
    if (!nickname.trim()) return "닉네임을 입력해주세요";
    // 닉네임은 TV·순위에 그대로 나간다 — 12자를 넘으면 프로필 저장이 서버에서 거절된다.
    if ([...nickname.trim()].length > 12) return "닉네임은 12자 이내로 정해 주세요";
    if (rawDigits(phone).length < 10) return "전화번호를 정확히 입력해주세요";
    if (birth.length !== 8) return "생년월일 8자리를 입력해주세요 (예: 19990315)";
    if (!gender) return "성별을 선택해주세요";
    return "";
  };

  // 기존 회원 확인 — 서버는 판정(new/existing/…)만 돌려주고 회원 정보는 주지 않는다.
  const checkMember = async (): Promise<boolean> => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("claim-member-account", {
        body: { action: "check", phone: rawDigits(phone), name: name.trim(), birthDate: birth },
      });
      const r = (data ?? null) as ClaimResponse | null;
      if (error || !r?.status) {
        setErr("회원 확인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      if (r.status === "new" || r.status === "existing") {
        setMemberMode(r.status);
        return true;
      }
      setMemberMode("new");
      setRegisteredPhone(r.status === "registered");
      setErr(r.error || "가입을 진행할 수 없어요. 지점 데스크에 문의해 주세요.");
      return false;
    } catch {
      setErr("회원 확인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
      return false;
    } finally {
      setChecking(false);
    }
  };

  const next = async () => {
    if (checking) return;
    setErr("");
    setRegisteredPhone(false);
    if (step === 1) {
      const e = validateStep1();
      if (e) return setErr(e);
      if (!(await checkMember())) return;
    }
    if (step === 3 && !allAgreed) return setErr("필수 약관에 모두 동의해주세요");
    setStep((s) => Math.min(lastStep, s + 1));
  };
  const back = () => {
    setErr("");
    setRegisteredPhone(false);
    if (step === 1) navigate(loggedIn ? "/home" : "/login");
    else setStep((s) => s - 1);
  };

  const submit = async () => {
    if (!branch) return setErr("다니실 지점을 골라 주세요");
    if (!offline && !productId) return setErr("수강권(개월수)을 선택해주세요");
    setErr("");
    setSubmitting(true);
    try {
      const phoneDigits = rawDigits(phone);
      // 전화번호 중복 확인 — 반드시 서버 함수로 물어본다.
      // profiles 를 직접 조회하면 비로그인 방문자에게는 RLS 가 0행을 주므로
      // 중복이 있어도 "없음" 으로 통과해 버린다(조용한 실패). check_phone_available 은
      // 회원 정보를 일절 돌려주지 않고 사용 가능 여부만 판정한다.
      if (!(loggedIn && user)) {
        const { data: usable, error: chkErr } = await (supabase as any).rpc("check_phone_available", {
          p_phone: phoneDigits,
        });
        if (chkErr) {
          setErr("전화번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
          setSubmitting(false);
          return;
        }
        if (usable !== true) {
          setErr("이미 등록된 전화번호입니다. 한 번호당 하나의 계정만 가능합니다.");
          setSubmitting(false);
          return;
        }
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
              branch_name: branch,
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
        const { error: pErr } = await supabase
          .from("profiles")
          .update({
            name: name.trim(),
            nickname: nickname.trim(),
            phone_number: phoneDigits,
            branch_name: branch,
            birth_date: birth,
            gender,
            fitness_goal: goal.trim() || null,
            health_notes: health.trim() || null,
            signup_agreements: { ...agree, version: AGREEMENT_VERSION },
            signup_agreed_at: new Date().toISOString(),
            gym_reg_date: new Date().toISOString().slice(0, 10),
          } as never)
          .eq("user_id", uid);
        if (pErr) {
          console.error("[SignupApply] 가입 정보 저장 실패:", pErr);
          // 소셜 계정은 저장이 안 되면 결제로 넘기지 않는다 — 전화번호가 안 붙은 계정으로 결제되는 것을 막는다.
          if (loggedIn) {
            setErr("가입 정보를 저장하지 못했어요. 잠시 후 다시 시도하거나 지점 데스크에 문의해 주세요.");
            return;
          }
        }
      }
      // 데스크 결제 지점(칠금점) — 결제선생으로 가지 않는다. 가입 신청만 하고 승인 대기 (데스크가 결제 확인 후 승인)
      if (offline) {
        if (!uid) {
          setErr("가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }
        await refreshProfile();
        toast.success(`가입 신청이 끝났어요. ${branchShortName(branch)} 데스크에서 결제(계좌이체 · 현장)가 확인되면 승인돼요.`);
        navigate("/waiting-approval", { replace: true });
        return;
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

  // 기존 회원 가입 완료 — 결제 없이. 이용 중인 수강권이 확인되지 않는 회원(만료·기록 없음)은
  // 수강권 탭으로 안내한다(결제는 강요하지 않는다).
  const finishExisting = (membershipActive: boolean) => {
    if (membershipActive) {
      toast.success("기존 회원 확인 완료! 결제 없이 가입됐어요 🥊");
      navigate("/home", { replace: true });
    } else {
      toast.success("가입 완료! 이용 중인 수강권이 확인되지 않아 수강권 탭으로 안내해 드려요.");
      navigate("/membership", { replace: true });
    }
  };

  const submitExisting = async () => {
    if (!allAgreed) return setErr("필수 약관에 모두 동의해주세요");
    setErr("");
    setSubmitting(true);
    const agreements = { ...agree, version: AGREEMENT_VERSION };
    try {
      if (loggedIn && user) {
        // 소셜 로그인 회원 — 전화번호로 기존 계정의 레벨·출석·수강권 기록을 이 계정에 합친다(기존 연동 경로).
        const { data, error } = await supabase.functions.invoke("link-imported-by-phone", {
          body: { phone: rawDigits(phone) },
        });
        const r = (data ?? null) as { ok?: boolean; matched?: boolean; error?: string; message?: string } | null;
        if (error || !r) {
          setErr("기존 회원 연동 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
          return;
        }
        if (r.error) return setErr(r.error);
        if (r.matched === false) return setErr(r.message || "해당 전화번호로 등록된 기존 회원 계정이 없어요. 지점 데스크에 문의해 주세요.");
        // 회원이 입력한 가입 정보만 저장 — 전화·지점·등록일·수강권은 기존 계정 값이 이미 옮겨졌다.
        const { error: pErr } = await supabase
          .from("profiles")
          .update({
            name: name.trim(),
            nickname: nickname.trim(),
            gender,
            ...(goal.trim() ? { fitness_goal: goal.trim() } : {}),
            ...(health.trim() ? { health_notes: health.trim() } : {}),
            signup_agreements: agreements,
            signup_agreed_at: new Date().toISOString(),
          } as never)
          .eq("user_id", user.id);
        if (pErr) console.error("[SignupApply] 연동 후 가입 정보 저장 실패:", pErr);
        // 생년월일이 비어 있던 회원만 채운다(있는 값은 건드리지 않는다).
        await supabase
          .from("profiles")
          .update({ birth_date: toIsoBirth(birth) } as never)
          .eq("user_id", user.id)
          .is("birth_date", null);
        await refreshProfile();
        await refreshProgress();
        void queryClient.invalidateQueries();
        const { data: me } = await supabase.from("profiles").select("membership_end").eq("user_id", user.id).maybeSingle();
        const end = (me as { membership_end?: string | null } | null)?.membership_end;
        finishExisting(!!end && end.slice(0, 10) >= kstToday());
        return;
      }

      // 방문자 — 기존 계정을 내가 정한 아이디·비밀번호로 넘겨받는다(서버가 처음부터 다시 확인한다).
      const id = username.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke("claim-member-account", {
        body: {
          action: "claim",
          phone: rawDigits(phone),
          name: name.trim(),
          birthDate: birth,
          username: id,
          password,
          nickname: nickname.trim(),
          gender,
          fitnessGoal: goal.trim(),
          healthNotes: health.trim(),
          agreements,
        },
      });
      const r = (data ?? null) as ClaimResponse | null;
      if (error || !r?.status) {
        setErr("가입 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      if (!r.ok) {
        // 아이디 문제는 아이디를 고치는 1단계로 돌려보낸다.
        if (r.status === "username_taken" || r.status === "invalid") setStep(1);
        if (r.status === "registered") {
          setMemberMode("new");
          setStep(1);
          setRegisteredPhone(true);
        }
        // 그사이 기존 회원 계정이 없어졌다면 일반 가입(수강권 선택)으로 이어 간다.
        if (r.status === "new") setMemberMode("new");
        return setErr(r.error || "가입을 진행할 수 없어요. 지점 데스크에 문의해 주세요.");
      }
      const { error: siErr } = await supabase.auth.signInWithPassword({ email: toFakeEmail(id), password });
      if (siErr) {
        toast.success("가입이 완료됐어요. 새 아이디로 로그인해 주세요.");
        navigate("/", { replace: true });
        return;
      }
      finishExisting(r.membershipActive === true);
    } catch (e) {
      setErr("처리 중 오류가 발생했습니다: " + ((e as Error)?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => p.id === productId);
  const existing = memberMode === "existing";

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-28 pt-4">
      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-3">
        <button onClick={back} className="rounded-full bg-secondary p-2 active:scale-95">
          <ArrowLeft className="h-5 w-5 text-secondary-foreground" />
        </button>
        <div>
          <h1 className="text-heading font-bold text-foreground">{existing ? "기존 회원 앱 가입" : "신규 회원 가입 신청"}</h1>
          <p className="text-label text-muted-foreground">{branch ? branch : "다니실 지점을 골라 주세요"}</p>
        </div>
      </div>

      {/* 진행바 */}
      <div className="mb-5 flex gap-1.5">
        {steps.map((label, i) => (
          <div key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${i + 1 <= step ? "bg-primary" : "bg-muted"}`} />
            <p className={`mt-1 text-center text-label ${i + 1 === step ? "font-bold text-primary" : "text-muted-foreground"}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* 기존 회원 확인됨 — 결제 단계 없음 */}
      {existing && step >= 2 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3.5 w-3.5" />
          </span>
          <p className="text-label leading-relaxed text-foreground">
            <b className="text-primary">기존 회원으로 확인됐어요.</b> 수강권 결제 없이 가입이 끝나요. 레벨·출석·수강권 기록도 그대로 이어져요.
          </p>
        </div>
      )}

      {/* STEP 1 — 계정 */}
      {step === 1 && (
        <div className="space-y-3">
          {/* 지점 — 선릉역점은 앱 결제, 칠금점은 계좌이체 · 현장 결제 (2026-10-21) */}
          <Field label="다니실 지점">
            <div className="flex gap-2">
              {SIGNUP_BRANCHES.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => { setBranch(b.name); setProductId(""); }}
                  aria-pressed={branch === b.name}
                  className={`flex-1 rounded-xl py-2.5 text-body font-bold transition-all active:scale-95 ${branch === b.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {offline && (
              <p className="mt-1 px-1 text-label leading-relaxed text-muted-foreground">{branchShortName(branch)}은 앱 결제 대신 계좌이체 · 현장 결제로 받아요. 가입 신청 뒤 데스크에서 승인해 드려요.</p>
            )}
          </Field>
          {loggedIn ? (
            <div className="rounded-xl bg-primary/5 px-3 py-2.5 text-micro leading-relaxed text-muted-foreground">소셜 계정으로 로그인됨 — 아래 가입 정보만 작성하면 됩니다.</div>
          ) : (
            <>
              <Field label="아이디"><input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="영문·숫자 4~20자" autoCapitalize="none" autoCorrect="off" maxLength={20} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="비밀번호"><input type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" /></Field>
                <Field label="비밀번호 확인"><input type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="다시 입력" /></Field>
              </div>
            </>
          )}
          <Field label="이름(실명)"><input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="실명" /></Field>
          <Field label="닉네임"><input className={inputClass} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="링 위의 이름 (12자 이내)" maxLength={12} /></Field>
          <Field label="전화번호">
            <input type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" />
            <p className="mt-1 px-1 text-label leading-relaxed text-muted-foreground">이미 체육관에 다니고 계신가요? 등록된 번호를 입력하면 결제 없이 가입돼요.</p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="생년월일"><input className={inputClass} value={birth} onChange={(e) => setBirth(rawDigits(e.target.value).slice(0, 8))} placeholder="19990315" inputMode="numeric" maxLength={8} /></Field>
            <Field label="성별">
              <div className="flex gap-2">
                {["남", "여"].map((g) => (
                  <button key={g} onClick={() => setGender(g)} className={`flex-1 rounded-xl py-2.5 text-body font-bold transition-all active:scale-95 ${gender === g ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{g}</button>
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
          <p className="px-1 text-label leading-relaxed text-muted-foreground">건강 특이사항은 안전한 지도를 위해서만 사용되며, 본인·관장·지도자만 확인합니다.</p>
        </div>
      )}

      {/* STEP 3 — 규정 동의 */}
      {step === 3 && (
        <div className="space-y-2.5">
          <button onClick={() => setAllAgree(!allAgreed)} className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-body font-bold transition-all active:scale-[0.99] ${allAgreed ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>
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
                    <span className="text-body font-semibold text-foreground">{p.title}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {open && <p className="whitespace-pre-line border-t border-border px-3 py-3 text-label leading-relaxed text-muted-foreground">{p.body}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* STEP 4 — 결제 안내 (데스크 결제 지점 신규 회원) */}
      {step === 4 && !existing && offline && <OfflinePayCard branch={branch} context="signup" />}

      {/* STEP 4 — 수강권 선택 (신규 회원 · 앱 결제 지점) */}
      {step === 4 && !existing && !offline && (
        <div className="space-y-2.5">
          <p className="px-1 text-label text-muted-foreground">등록하실 수강권을 선택하세요. 다음 단계에서 안전한 결제창으로 이동합니다.</p>
          {products.map((p) => (
            <button key={p.id} onClick={() => setProductId(p.id)} className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${productId === p.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
              <div>
                <p className="text-body font-bold text-foreground">{p.name}</p>
                <p className="text-label text-muted-foreground">{p.duration_days}일 이용</p>
              </div>
              <span className="text-body font-black text-primary">{won(p.price)}</span>
            </button>
          ))}
          {products.length === 0 && <p className="py-6 text-center text-body text-muted-foreground">등록 가능한 수강권이 없습니다. 관장님께 문의해주세요.</p>}
          <p className="px-1 pt-1 text-label leading-relaxed text-muted-foreground">이미 체육관에 등록된 회원인데 이 화면이 보이면 등록된 전화번호가 다를 수 있어요. 결제하지 말고 지점 데스크에 문의해 주세요.</p>
        </div>
      )}

      {err && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-label font-medium text-destructive">{err}</p>}
      {registeredPhone && !loggedIn && (
        <button onClick={() => navigate("/", { replace: true })} className="mt-2 w-full rounded-xl border border-border bg-card py-2.5 text-body font-bold text-foreground transition-all active:scale-[0.98]">
          로그인 화면으로 가기 (아이디·비밀번호 찾기)
        </button>
      )}

      {/* 하단 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t border-border bg-card p-4 safe-area-bottom">
        {step < lastStep ? (
          <button onClick={next} disabled={checking} className="w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
            {checking ? "회원 정보 확인 중..." : "다음"}
          </button>
        ) : existing ? (
          <button onClick={submitExisting} disabled={submitting} className="w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
            {submitting ? "처리 중..." : "가입 완료 (결제 없음)"}
          </button>
        ) : offline ? (
          <button onClick={submit} disabled={submitting} className="w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
            {submitting ? "처리 중..." : "가입 신청하기 (결제는 데스크에서)"}
          </button>
        ) : (
          <button onClick={submit} disabled={submitting || !productId} className="w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50">
            {submitting ? "처리 중..." : selectedProduct ? `${won(selectedProduct.price)} 결제하고 가입` : "수강권을 선택하세요"}
          </button>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <label className="mb-1 block text-label font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
);

export default SignupApply;
