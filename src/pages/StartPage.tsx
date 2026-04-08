import { useState } from "react";
import { useNavigate } from "react-router-dom";

const StartPage = () => {
  const [inviteCode, setInviteCode] = useState("");
  const [nickname, setNickname] = useState("");
  const navigate = useNavigate();

  const handleStart = () => {
    navigate("/home");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {/* Logo area */}
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
      <div className="w-full max-w-sm space-y-4 animate-slide-up">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-muted-foreground">초대코드</label>
          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="코치에게 받은 초대코드 입력"
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
            className="w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <button
          onClick={handleStart}
          className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-lg transition-all active:scale-[0.98] hover:shadow-xl"
        >
          시작하기 🥊
        </button>

        <p className="text-center text-xs text-muted-foreground">
          시작하기를 누르면 서비스 이용약관에 동의하게 됩니다
        </p>
      </div>
    </div>
  );
};

export default StartPage;
