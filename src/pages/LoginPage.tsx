import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, name, nickname);
        if (error) {
          setError(error.message);
          return;
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
          return;
        }
      }
      navigate("/home");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {/* Logo */}
      <div className="mb-8 animate-bounce-in text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary text-5xl shadow-lg">
          🥊
        </div>
        <h1 className="text-3xl tracking-tight text-foreground">153 QUEST</h1>
        <p className="mt-2 text-base text-muted-foreground">
          오늘의 퀘스트를 깨고 레벨업하세요
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 animate-slide-up">
        {isSignUp && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="실명을 입력하세요"
                required
                className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">닉네임</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="링 위의 이름을 정하세요"
                required
                className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 입력"
            required
            className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            required
            minLength={6}
            className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] hover:shadow-xl disabled:opacity-50"
        >
          {isLoading ? "처리 중..." : isSignUp ? "회원가입 🥊" : "로그인 🥊"}
        </button>

        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
          className="w-full py-2 text-center text-sm text-muted-foreground"
        >
          {isSignUp ? "이미 계정이 있나요? 로그인" : "계정이 없나요? 회원가입"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
