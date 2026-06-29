// 소셜(구글/카카오) 첫 로그인 시 전화번호로 기존 일괄등록 계정 연동 (권장·스킵 가능).
// 대상: role=member 이고 프로필에 전화번호가 없는 회원(소셜 가입자). 일괄등록 회원은 전화번호가 있어 제외.
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link2 } from "lucide-react";

const formatPhone = (val: string) => {
  const d = val.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

const LinkAccountPrompt = () => {
  const { user, profile, role, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsLink = !!user && !!profile && role === "member" && !profile.phone_number;
  if (!needsLink || dismissed || location.pathname === "/signup" || location.pathname === "/login") return null;

  const submit = async () => {
    setError("");
    if (phone.replace(/\D/g, "").length < 10) {
      setError("전화번호를 정확히 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("link-imported-by-phone", {
        body: { phone: phone.replace(/\D/g, "") },
      });
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
      toast.success("기존 등록 정보가 연동되었습니다 🥊");
      setDismissed(true);
    } catch {
      setError("연동 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Link2 className="h-4 w-4" />
          </span>
          <h2 className="text-base font-bold text-foreground">회원 등록 확인</h2>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          <b className="text-foreground">기존 153복싱짐 회원</b>이시면 가입하신 전화번호로 연동하세요. 처음이시면 아래에서 <b className="text-foreground">가입 신청</b>을 진행해주세요.
        </p>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          placeholder="010-0000-0000"
          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft transition-all hover:shadow-glow-primary active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "연동 중..." : "기존 회원 연동하기"}
        </button>
        <div className="my-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> 또는 <div className="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            navigate("/signup");
          }}
          className="w-full rounded-xl border border-primary/40 bg-primary/5 py-3 text-sm font-bold text-primary transition-all active:scale-[0.98]"
        >
          신규 회원이에요 · 가입 신청하기
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">153복싱짐 등록 회원만 앱을 이용할 수 있어요.</p>
      </div>
    </div>
  );
};

export default LinkAccountPrompt;
