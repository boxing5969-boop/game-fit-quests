import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const ResetPasswordPage = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("recovery=true")) {
      setIsRecovery(true);
    }

    // Re-establish session from the recovery token if needed
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsRecovery(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Restore the original auth email (fake email) after password reset
      try {
        await supabase.functions.invoke("restore-auth-email");
      } catch (restoreErr) {
        console.error("Failed to restore auth email:", restoreErr);
        // Non-critical — don't block the user
      }

      toast.success("비밀번호가 변경되었습니다 ✅");
      await supabase.auth.signOut();
      navigate("/");
    } catch (err: any) {
      setError(err.message || "비밀번호 변경 실패");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-destructive/20 text-5xl">🔒</div>
          <h1 className="mb-2 text-xl text-foreground">잘못된 접근입니다</h1>
          <p className="mb-6 text-muted-foreground">이메일의 비밀번호 재설정 링크를 통해 접근해주세요.</p>
          <button
            onClick={() => navigate("/")}
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
      <div className="animate-bounce-in text-center mb-8">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/20 text-5xl">🔑</div>
        <h1 className="text-2xl text-foreground">새 비밀번호 설정</h1>
        <p className="mt-2 text-muted-foreground">새로운 비밀번호를 입력해주세요</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 animate-slide-up">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">새 비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상 입력" required minLength={6} className={inputClass} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">비밀번호 확인</label>
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" required className={inputClass} />
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? "처리 중..." : "비밀번호 변경 🥊"}
        </button>
      </form>
    </div>
  );
};

export default ResetPasswordPage;
