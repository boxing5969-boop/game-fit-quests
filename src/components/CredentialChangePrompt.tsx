// 최초 로그인 아이디·비밀번호 변경 프롬프트 (권장·스킵 가능).
// 일괄등록 회원은 아이디·비번이 전화번호라, must_change_credentials=true 시 노출.
// "나중에" = 이번 세션 스킵(플래그 유지 → 다음 로그인 때 다시 권장).
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";

const USERNAME_RE = /^[a-z0-9_]{4,20}$/;

const CredentialChangePrompt = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const mustChange = !!(profile as { must_change_credentials?: boolean } | null)?.must_change_credentials;
  if (!user || !mustChange || dismissed) return null;

  const currentId = profile?.phone_number || "전화번호";

  const submit = async () => {
    setError("");
    const uname = newUsername.toLowerCase().trim();
    if (!USERNAME_RE.test(uname)) {
      setError("아이디는 영문·숫자·밑줄(_) 4~20자만 가능합니다.");
      return;
    }
    if (newPassword.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPw) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("change-credentials", {
        body: { newUsername: uname, newPassword },
      });
      if (fnErr) throw fnErr;
      if (data?.error) {
        setError(data.error);
        return;
      }
      await refreshProfile();
      toast.success("아이디·비밀번호가 변경되었습니다 🥊");
    } catch {
      setError("변경 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-4 w-4" />
          </span>
          <h2 className="text-base font-bold text-foreground">아이디·비밀번호 변경</h2>
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          지금은 아이디·비밀번호가 <b className="text-foreground">전화번호({currentId})</b> 로 설정돼 있어요.
          안전을 위해 나만의 아이디·비밀번호로 바꿔주세요.
        </p>
        <div className="space-y-2.5">
          <input
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="새 아이디 (영문·숫자 4~20자)"
            className={inputCls}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호 (6자 이상)"
            className={inputCls}
          />
          <input
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="새 비밀번호 확인"
            className={inputCls}
          />
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-all active:scale-[0.98]"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="flex-1 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft transition-all hover:shadow-glow-primary active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? "변경 중..." : "변경하기"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CredentialChangePrompt;
