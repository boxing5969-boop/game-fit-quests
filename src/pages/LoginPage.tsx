import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import LoginErrorModal, { classifyLoginError } from "@/components/LoginErrorModal";
import { translateAuthError } from "@/lib/errorMessages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tab = "login" | "member" | "coach";

const useBranches = () =>
  useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

// ─── Signature Pad ────
const SignaturePad = ({ onSignatureChange }: { onSignatureChange: (data: string | null) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setHasDrawn(true);
  };

  const endDraw = () => {
    setIsDrawing(false);
    if (hasDrawn && canvasRef.current) {
      onSignatureChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onSignatureChange(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(2, 2);
  }, []);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="h-28 w-full rounded-xl border border-border bg-card touch-none cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      {hasDrawn && (
        <button type="button" onClick={clear} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          서명 지우기
        </button>
      )}
    </div>
  );
};

// ─── Privacy Modal ────
const PrivacyConsentModal = ({ onAccept, onClose }: { onAccept: (sig: string) => void; onClose: () => void }) => {
  const [signature, setSignature] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-elev-3">
        <h2 className="mb-4 text-lg font-bold text-foreground">📋 개인정보 수집·이용 동의</h2>
        <div className="mb-4 max-h-48 overflow-y-auto rounded-xl bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">1. 수집 항목</p>
          <p className="mb-3">이름, 닉네임, 아이디, 전화번호, 소속 지점</p>
          <p className="mb-2 font-semibold text-foreground">2. 수집 목적</p>
          <p className="mb-3">서비스 제공, 회원 관리, 레벨/랭킹 운영, 본인 확인</p>
          <p className="mb-2 font-semibold text-foreground">3. 보유 기간</p>
          <p className="mb-3">회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다.</p>
          <p className="mb-2 font-semibold text-foreground">4. 동의 거부 권리</p>
          <p>동의를 거부할 수 있으나, 이 경우 회원가입이 제한됩니다.</p>
        </div>

        <p className="mb-2 text-sm font-medium text-foreground">아래에 서명해주세요</p>
        <SignaturePad onSignatureChange={setSignature} />

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-all active:scale-[0.98]">
            취소
          </button>
          <button
            type="button"
            onClick={() => signature && onAccept(signature)}
            disabled={!signature}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98] disabled:opacity-50"
          >
            동의 및 서명 완료
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main LoginPage ────
const LoginPage = () => {
  const [tab, setTab] = useState<Tab>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [branch, setBranch] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotUsername, setForgotUsername] = useState("");
  const [forgotName, setForgotName] = useState("");
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotBirthDate, setForgotBirthDate] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotStep, setForgotStep] = useState<"verify" | "success">("verify");
  const [forgotError, setForgotError] = useState("");
  const [error, setError] = useState("");
  const [loginErrorType, setLoginErrorType] = useState<ReturnType<typeof classifyLoginError> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { data: branches } = useBranches();

  const isSignUp = tab === "member" || tab === "coach";

  const toFakeEmail = (id: string) => `${id.toLowerCase().trim()}@153rankup.app`;

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const resetForm = () => {
    setUsername(""); setPassword(""); setConfirmPassword(""); setName(""); setNickname("");
    setPhone(""); setBranch(""); setBirthDate(""); setSignatureData(null); setError(""); setSignUpSuccess(false);
    setLoginErrorType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isSignUp) {
      if (!username.trim()) { setError("아이디를 입력해주세요"); return; }
      setIsLoading(true);
      try {
        const { error } = await signIn(toFakeEmail(username), password);
        if (error) {
          // classifyLoginError 는 영어 키워드로 타입 판정 — 원문으로 분류 유지
          const errorType = classifyLoginError(error.message);
          setLoginErrorType(errorType);
          // 회원에게 노출되는 메시지는 한국어로 변환
          setError(translateAuthError(error));
          return;
        }
        navigate("/home");
      } finally { setIsLoading(false); }
      return;
    }

    // Signup validations
    if (!username.trim()) { setError("아이디를 입력해주세요"); return; }
    if (/[^a-zA-Z0-9_]/.test(username.trim())) { setError("아이디는 영문, 숫자, 밑줄(_)만 사용 가능합니다"); return; }
    if (username.trim().length < 4) { setError("아이디는 4자 이상이어야 합니다"); return; }
    if (password !== confirmPassword) { setError("비밀번호가 일치하지 않습니다"); return; }
    if (password.length < 6) { setError("비밀번호는 6자 이상이어야 합니다"); return; }
    const rawPhone = phone.replace(/-/g, "");
    if (rawPhone.length < 10) { setError("올바른 전화번호를 입력해주세요"); return; }
    if (!branch) { setError("소속 체육관을 선택해주세요"); return; }
    if (!signatureData) { setShowPrivacy(true); return; }

    // Proceed with signup
    setIsLoading(true);
    try {
      const { error } = await signUp(toFakeEmail(username), password, name, nickname, rawPhone, branch, tab === "coach", birthDate);
      if (error) { setError(translateAuthError(error)); return; }
      setSignUpSuccess(true);
      toast.success(tab === "coach" ? "가입 완료! 관리자 승인을 기다려주세요" : "가입 완료! 관장님 승인을 기다려주세요 🥊");
    } finally { setIsLoading(false); }
  };

  const handlePrivacyAccept = (sig: string) => {
    setSignatureData(sig);
    setShowPrivacy(false);
  };

  const handleForgotPassword = async () => {
    setForgotError("");
    if (!forgotUsername.trim() || !forgotName.trim() || !forgotPhone.trim()) {
      setForgotError("아이디, 이름, 전화번호를 모두 입력해주세요");
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError("새 비밀번호는 6자 이상이어야 합니다");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("비밀번호가 일치하지 않습니다");
      return;
    }
    setForgotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-identity-reset", {
        body: {
          username: forgotUsername.trim(),
          name: forgotName.trim(),
          phone: forgotPhone.trim(),
          birthDate: forgotBirthDate.trim() || null,
          newPassword: forgotNewPassword,
        },
      });
      if (error) throw error;
      if (data?.error) {
        setForgotError(data.error);
        return;
      }
      setForgotStep("success");
    } catch (err: any) {
      setForgotError("처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setForgotLoading(false);
    }
  };

  if (signUpSuccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <div className="animate-bounce-in text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/20 text-5xl">✅</div>
          <h1 className="mb-2 text-2xl text-foreground">가입이 완료되었습니다!</h1>
          <p className="mb-6 text-muted-foreground">
            {tab === "coach" ? (
              <>관리자 승인 후 로그인할 수 있습니다.<br />승인 완료 시 알림을 받으실 수 있습니다.</>
            ) : (
              <>관장님이 가입을 승인하면 로그인할 수 있습니다.<br />승인까지 잠시 기다려주세요.</>
            )}
          </p>
          {tab === "coach" && (
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
              관장님 권한은 관리자 승인 후 부여됩니다.
            </div>
          )}
          <button
            onClick={() => { setTab("login"); resetForm(); }}
            className="rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98]"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const inputClass = "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-8">
      {/* Logo — 새 MY BOXER 풀 로고 (아이콘 + 텍스트 합본) */}
      <div className="mb-5 animate-bounce-in text-center">
        <img
          src="/assets/brand/myboxer_logo_full.png"
          alt="MY BOXER 마이복서 by 153 BOXING GYM"
          draggable={false}
          className="mx-auto mb-2 h-24 w-auto select-none object-contain"
          style={{ filter: "drop-shadow(0 4px 14px rgba(0,0,0,0.35))" }}
        />
        <p className="mt-1.5 text-sm text-muted-foreground">
          153복싱짐 회원을 위한 복싱 성장 퀘스트 앱
        </p>
      </div>

      {/* Tab */}
      <div className="mb-4 flex w-full max-w-sm gap-1 rounded-xl bg-muted p-1">
        {([["login", "로그인"], ["member", "회원가입"], ["coach", "관장님 가입"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setError(""); }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all ${
              tab === key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3 animate-slide-up">
        {isSignUp && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">이름</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="실명을 입력하세요" required className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">닉네임</label>
              <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="링 위의 이름을 정하세요" required className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">전화번호</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" required className={inputClass} />
              <p className="mt-0.5 text-xs text-muted-foreground">한 번호당 하나의 계정만 가능합니다</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">소속 체육관</label>
              {branches && branches.length > 0 ? (
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="체육관을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-3 text-center text-sm text-muted-foreground">등록된 체육관이 없습니다</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">생년월일</label>
              <input type="text" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="예: 19990315" required className={inputClass} maxLength={8} inputMode="numeric" />
              <p className="mt-0.5 text-xs text-muted-foreground">비밀번호 분실 시 본인확인에 사용됩니다</p>
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">아이디</label>
          <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={isSignUp ? "영문, 숫자 4자 이상" : "아이디 입력"} required className={inputClass} autoCapitalize="none" autoCorrect="off" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-muted-foreground">비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 입력" required minLength={6} className={inputClass} />
        </div>
        {isSignUp && (
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">비밀번호 확인</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" required className={inputClass} />
          </div>
        )}

        {/* Privacy consent status */}
        {isSignUp && (
          <div
            onClick={() => setShowPrivacy(true)}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
              signatureData
                ? "border-green-500/30 bg-green-500/10"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            <span className="text-lg">{signatureData ? "✅" : "📋"}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">개인정보 수집·이용 동의</p>
              <p className="text-xs text-muted-foreground">
                {signatureData ? "동의 및 서명 완료" : "터치하여 동의서 확인 및 서명"}
              </p>
            </div>
          </div>
        )}

        {tab === "coach" && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            ⚠️ 관장님 가입은 관리자 승인 후 코치 권한이 부여됩니다.
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-glow-primary transition-all active:scale-[0.98] hover:shadow-glow-primary disabled:opacity-50"
        >
          {isLoading ? "처리 중..." : isSignUp ? (tab === "coach" ? "관장님 가입 🥊" : "회원가입 🥊") : "로그인 🥊"}
        </button>

        {tab === "login" && (
          <>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-3 text-muted-foreground">또는</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={isLoading}
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const result = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin,
                    });
                    if (result.error) {
                      setError("Google 로그인에 실패했습니다.");
                      return;
                    }
                    if (result.redirected) return;
                    navigate("/home");
                  } catch {
                    setError("Google 로그인에 실패했습니다.");
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.98]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    const result = await lovable.auth.signInWithOAuth("apple", {
                      redirect_uri: window.location.origin,
                    });
                    if (result.error) {
                      setError("Apple 로그인에 실패했습니다.");
                      return;
                    }
                    if (result.redirected) return;
                    navigate("/home");
                  } catch {
                    setError("Apple 로그인에 실패했습니다.");
                  } finally {
                    setIsLoading(false);
                  }
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card py-3.5 text-sm font-medium text-foreground transition-all hover:bg-muted active:scale-[0.98]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                Apple
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              disabled={isLoading}
              className="w-full py-2 text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              비밀번호를 잊으셨나요?
            </button>
          </>
        )}
      </form>

      {/* Login Error Modal */}
      {loginErrorType && (
        <LoginErrorModal
          type={loginErrorType}
          onClose={() => setLoginErrorType(null)}
          onRetry={loginErrorType !== "approval_pending" && loginErrorType !== "coach_approval_pending" ? () => { setLoginErrorType(null); setError(""); } : undefined}
        />
      )}

      {/* Privacy consent modal */}
      {showPrivacy && (
        <PrivacyConsentModal
          onAccept={handlePrivacyAccept}
          onClose={() => setShowPrivacy(false)}
        />
      )}

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-elev-3">
            {forgotStep === "success" ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/20 text-3xl">✅</div>
                <h2 className="mb-2 text-lg font-bold text-foreground">비밀번호 변경 완료!</h2>
                <p className="mb-4 text-sm text-muted-foreground">새 비밀번호로 로그인해주세요.</p>
                <button type="button" onClick={() => { setShowForgotPassword(false); setForgotStep("verify"); setForgotUsername(""); setForgotName(""); setForgotPhone(""); setForgotBirthDate(""); setForgotNewPassword(""); setForgotConfirmPassword(""); setForgotError(""); }}
                  className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary active:scale-[0.98]">
                  확인
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-2 text-lg font-bold text-foreground">🔑 비밀번호 찾기</h2>
                <p className="mb-4 text-sm text-muted-foreground">가입 시 등록한 아이디, 이름, 전화번호를 입력하세요.</p>
                <div className="space-y-3">
                  <input type="text" value={forgotUsername} onChange={(e) => setForgotUsername(e.target.value)} placeholder="아이디" className={inputClass} autoCapitalize="none" autoCorrect="off" />
                  <input type="text" value={forgotName} onChange={(e) => setForgotName(e.target.value)} placeholder="이름" className={inputClass} />
                  <input type="tel" value={forgotPhone} onChange={(e) => setForgotPhone(formatPhone(e.target.value))} placeholder="전화번호 (010-0000-0000)" className={inputClass} />
                  <input type="text" value={forgotBirthDate} onChange={(e) => setForgotBirthDate(e.target.value)} placeholder="생년월일 (선택, 예: 19990315)" className={inputClass} maxLength={8} inputMode="numeric" />
                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-sm font-medium text-foreground">새 비밀번호 설정</p>
                    <input type="password" value={forgotNewPassword} onChange={(e) => setForgotNewPassword(e.target.value)} placeholder="새 비밀번호 (6자 이상)" className={inputClass} />
                  </div>
                  <input type="password" value={forgotConfirmPassword} onChange={(e) => setForgotConfirmPassword(e.target.value)} placeholder="새 비밀번호 확인" className={inputClass} />
                </div>
                {forgotError && <p className="mt-2 text-sm text-destructive">{forgotError}</p>}
                <div className="mt-4 flex gap-3">
                  <button type="button" onClick={() => { setShowForgotPassword(false); setForgotError(""); setForgotUsername(""); setForgotName(""); setForgotPhone(""); setForgotBirthDate(""); setForgotNewPassword(""); setForgotConfirmPassword(""); }}
                    className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-all active:scale-[0.98]">
                    취소
                  </button>
                  <button type="button" onClick={handleForgotPassword} disabled={forgotLoading}
                    className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft hover:shadow-glow-primary transition-all active:scale-[0.98] disabled:opacity-50">
                    {forgotLoading ? "확인 중..." : "비밀번호 변경"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
