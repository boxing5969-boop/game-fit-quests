import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const WaitingApprovalPage = () => {
  const { profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // 결제로 가입하는 회원은 결제 완료 통보(결제선생 콜백)가 도착하는 순간 승인된다(2026-09-28).
  // 결제 직후 잠깐 이 화면에 머물 수 있으니 몇 초마다 다시 확인해, 승인되면 바로 들여보낸다.
  useEffect(() => {
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      if (tries > 90) { clearInterval(t); return; } // 약 6분까지만
      void refreshProfile();
    }, 4000);
    return () => clearInterval(t);
  }, [refreshProfile]);

  useEffect(() => {
    if (!profile?.is_approved) return;
    let cancelled = false;
    void (async () => {
      // 방금 결제로 승인된 경우엔 결제 완료 화면으로, 아니면 홈으로.
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      // payment_orders 는 생성 타입에 없어 any 로 부른다(RLS: 본인 주문만 읽힘).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("payment_orders").select("id").eq("status", "paid").gte("paid_at", since).limit(1);
      if (!cancelled) navigate(data && data.length > 0 ? "/membership?paid=1" : "/", { replace: true });
    })();
    return () => { cancelled = true; };
  }, [profile?.is_approved, navigate]);

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
        <p className="mb-2 text-sm text-muted-foreground">
          수강권을 결제하셨다면 결제가 확인되는 대로 자동으로 들어가요.
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
