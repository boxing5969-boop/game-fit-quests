import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tab = "login" | "member" | "coach";

const LoginPage = () => {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const isSignUp = tab === "member" || tab === "coach";

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const resetForm = () => {
    setEmail(""); setPassword(""); setConfirmPassword(""); setName(""); setNickname(""); setPhone(""); setError(""); setSignUpSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          setError("비밀번호가 일치하지 않습니다");
          return;
        }
        if (password.length < 6) {
          setError("비밀번호는 6자 이상이어야 합니다");
          return;
        }
        const rawPhone = phone.replace(/-/g, "");
        if (rawPhone.length < 10) {
          setError("올바른 전화번호를 입력해주세요");
          return;
        }
        const { error } = await signUp(email, password, name, nickname, rawPhone, tab === "coach");
        if (error) {
          setError(error.message);
          return;
        }
        setSignUpSuccess(true);
        toast.success("가입 완료! 이메일 인증을 확인해주세요 📧");
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
          return;
        }
        navigate("/home");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("비밀번호를 재설정할 이메일을 입력해주세요");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("비밀번호 재설정 링크를 이메일로 보냈습니다 📧");
    } catch (err: any) {
      setError(err.message || "요청 실패");
    } finally {
      setIsLoading(false);
    }
  };

  if (signUpSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="animate-bounce-in text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/20 text-5xl">📧</div>
          <h1 className="mb-2 text-2xl text-foreground">이메일 인증을 확인하세요</h1>
          <p className="mb-6 text-muted-foreground">
            <strong>{email}</strong>로 인증 메일을 보냈습니다.<br />
            메일의 링크를 클릭하면 가입이 완료됩니다.
          </p>
          {tab === "coach" && (
            <div className="mb-6 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700">
              관장님 권한은 관리자 승인 후 부여됩니다.
            </div>
          )}
          <button
            onClick={() => { setTab("login"); resetForm(); }}
            className="rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98]"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-6 animate-bounce-in text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-5xl shadow-lg">
          🥊
        </div>
        <h1 className="text-3xl tracking-tight text-foreground">153 QUEST</h1>
        <p className="mt-2 text-base text-muted-foreground">
          오늘의 퀘스트를 깨고 레벨업하세요
        </p>
      </div>

      {/* Tab selector */}
      <div className="mb-5 flex w-full max-w-sm gap-1 rounded-xl bg-muted p-1">
        {([["login", "로그인"], ["member", "회원가입"], ["coach", "관장님 가입"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setError(""); }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3.5 animate-slide-up">
        {isSignUp && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">이름</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="실명을 입력하세요" required className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">닉네임</label>
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="링 위의 이름을 정하세요" required className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">전화번호</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" required className={inputClass} />
              <p className="mt-1 text-xs text-muted-foreground">한 번호당 하나의 계정만 가능합니다</p>
            </div>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 입력" required className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 입력" required minLength={6} className={inputClass} />
        </div>

        {isSignUp && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-muted-foreground">비밀번호 확인</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" required className={inputClass} />
          </div>
        )}

        {tab === "coach" && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-700">
            ⚠️ 관장님 가입은 관리자 승인 후 코치 권한이 부여됩니다.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] hover:shadow-xl disabled:opacity-50"
        >
          {isLoading ? "처리 중..." : isSignUp ? (tab === "coach" ? "관장님 가입 🥊" : "회원가입 🥊") : "로그인 🥊"}
        </button>

        {tab === "login" && (
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={isLoading}
            className="w-full py-2 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            비밀번호를 잊으셨나요?
          </button>
        )}
      </form>
    </div>
  );
};

export default LoginPage;
