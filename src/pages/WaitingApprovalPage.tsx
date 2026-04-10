import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const WaitingApprovalPage = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="animate-bounce-in text-center">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-primary/20 text-5xl">⏳</div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">승인 대기 중</h1>
        <p className="mb-2 text-muted-foreground">
          관장님이 가입을 승인하면 로그인할 수 있습니다.
        </p>
        <p className="mb-6 text-sm text-muted-foreground">
          소속: <span className="font-medium text-foreground">{profile?.branch_name || "미지정"}</span>
        </p>
        <button
          onClick={handleLogout}
          className="rounded-xl border border-border px-8 py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted active:scale-[0.98]"
        >
          로그아웃
        </button>
      </div>
    </div>
  );
};

export default WaitingApprovalPage;
