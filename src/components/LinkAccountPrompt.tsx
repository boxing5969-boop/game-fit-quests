// 소셜(구글/카카오) 첫 로그인 시 전화번호로 기존 일괄등록 계정 연동 (권장·스킵 가능).
// 대상: role=member 이고 프로필에 전화번호가 없는 회원(소셜 가입자). 일괄등록 회원은 전화번호가 있어 제외.
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { runInviteClaim } from "@/components/InviteRewardBridge";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { clearLinkTicket, markLoggedIn, peekLinkTicket } from "@/lib/memberEntry";

const formatPhone = (val: string) => {
  const d = val.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

const LinkAccountPrompt = () => {
  const { user, profile, role, refreshProfile, refreshProgress } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsLink = !!user && !!profile && role === "member" && !profile.phone_number;
  // 2026-11-22 첫 사용 순서: 이 기기에서 로그인한 적이 있으면 다음부터 첫 질문 없이 로그인 화면부터.
  useEffect(() => {
    if (user) markLoggedIn();
  }, [user]);
  // 「기록을 찾았어요 → 카카오로 이어받기」로 돌아왔으면 이어받기 표로 바로 합친다(번호를 다시 묻지 않음).
  const autoTried = useRef(false);
  const [autoLinking, setAutoLinking] = useState(false);
  useEffect(() => {
    if (!user || !profile || autoTried.current) return;
    const ticket = peekLinkTicket();
    if (!ticket) return;
    if (!needsLink) {
      clearLinkTicket(); // 이미 번호가 붙은 계정(예전에 합친 계정) — 표는 쓸 일이 없다
      return;
    }
    autoTried.current = true;
    setAutoLinking(true);
    void link({ ticket }).finally(() => {
      clearLinkTicket();
      setAutoLinking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, needsLink]);
  if (!needsLink || dismissed || location.pathname === "/signup" || location.pathname === "/login") return null;

  const submit = async () => {
    setError("");
    if (phone.replace(/\D/g, "").length < 10) {
      setError("전화번호를 정확히 입력해주세요.");
      return;
    }
    await link({ phone: phone.replace(/\D/g, "") });
  };

  async function link(body: { phone: string } | { ticket: string }) {
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("link-imported-by-phone", { body });
      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(data.error);
        return;
      }
      if (data?.matched === false) {
        setError(data.message || "해당 전화번호로 등록된 계정이 없습니다.");
        return;
      }
      await refreshProfile();
      // 기존 계정의 레벨·XP·젬·출석 기록이 이 계정으로 합쳐졌다 — 화면에 남은 예전 값(Lv.1 등)을 모두 새로 읽는다.
      await refreshProgress();
      void queryClient.invalidateQueries();
      toast.success("기존 레벨·출석 기록까지 연동되었습니다 🥊");
      // 초대받은 회원이면 초대한 사람에게 보상 (합친 뒤 전화번호로 맞춘다, 2026-10-18)
      void runInviteClaim();
      setDismissed(true);
    } catch {
      setError("연동 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  if (autoLinking) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
        <div role="status" className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-elev-3">
          <Link2 className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-heading font-bold text-foreground">기록을 이어받는 중이에요</p>
          <p className="mt-1 text-body text-muted-foreground">레벨 · 출석 기록을 옮기고 있어요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Link2 className="h-4 w-4" />
          </span>
          <h2 className="text-body font-bold text-foreground">회원 등록 확인</h2>
        </div>
        <p className="mb-3 text-label leading-relaxed text-muted-foreground">
          <b className="text-foreground">153복싱짐 회원</b>이시면 <b className="text-foreground">체육관에 등록된 전화번호</b>를 넣어 주세요 — 레벨·출석 기록이 그대로 이어져요. 체육관에 처음 오셨다면 아래에서 <b className="text-foreground">가입 신청</b>을 진행해주세요.
        </p>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010-0000-0000"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        {error && <p className="mt-2 text-label text-destructive">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground shadow-glow-soft transition-all hover:shadow-glow-primary active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "연동 중..." : "기존 회원 연동하기"}
        </button>
        <div className="my-3 flex items-center gap-2 text-label text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> 또는 <div className="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            navigate("/signup");
          }}
          className="w-full rounded-xl border border-primary/40 bg-primary/5 py-3 text-body font-bold text-primary transition-all active:scale-[0.98]"
        >
          신규 회원이에요 · 가입 신청하기
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="mt-3 w-full text-center text-label text-muted-foreground underline"
        >
          나중에 할게요 · 수강권 결제 시 번호를 입력하면 자동 등록돼요
        </button>
      </div>
    </div>
  );
};

export default LinkAccountPrompt;
