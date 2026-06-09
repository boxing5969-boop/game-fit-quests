import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SelectBranchPage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // 이미 체육관이 등록된(프로필 완성) 사용자는 이 화면에 갇히지 않도록 홈으로 보냄.
  // (소셜 재로그인 시 이 화면에 빠지면 뒤로가기가 없어 갇히고, 등록완료 시 승인이 풀리는 문제 방지)
  useEffect(() => {
    if (profile && (profile as any).branch_name) {
      navigate("/home", { replace: true });
    }
  }, [profile, navigate]);
  const [branch, setBranch] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [isCoach, setIsCoach] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branch) { toast.error("소속 체육관을 선택해주세요"); return; }
    if (!name.trim()) { toast.error("이름을 입력해주세요"); return; }
    if (!nickname.trim()) { toast.error("닉네임을 입력해주세요"); return; }

    setIsLoading(true);
    try {
      const rawPhone = phone.replace(/-/g, "");

      // Update profile with branch info
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          branch_name: branch,
          name: name.trim(),
          nickname: nickname.trim(),
          phone_number: rawPhone || null,
          is_approved: false, // needs manager approval
        })
        .eq("user_id", user!.id);

      if (profileError) throw profileError;

      // If coach request, insert coach_requests
      if (isCoach) {
        const { error: coachErr } = await supabase.from("coach_requests").insert({ user_id: user!.id, status: "pending" });
        if (coachErr) throw coachErr;
      }

      await refreshProfile();
      toast.success("체육관 등록 완료! 관장님 승인을 기다려주세요.");
      // Sign out so they wait for approval
      await supabase.auth.signOut();
      navigate("/", { replace: true });
    } catch (err: any) {
      const msg = err?.message || err?.details || String(err);
      toast.error(`오류: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-4xl shadow-glow-primary">🥊</div>
        <h1 className="text-2xl font-bold text-foreground">체육관 등록</h1>
        <p className="mt-1 text-sm text-muted-foreground">소셜 로그인 후 추가 정보를 입력해주세요</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
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
          <input type="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" className={inputClass} />
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

        {/* Coach toggle */}
        <div
          onClick={() => setIsCoach(!isCoach)}
          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
            isCoach ? "border-primary/30 bg-primary/10" : "border-border bg-card"
          }`}
        >
          <span className="text-lg">{isCoach ? "✅" : "👤"}</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">관장님으로 가입</p>
            <p className="text-xs text-muted-foreground">관리자 승인 후 관장 권한이 부여됩니다</p>
          </div>
        </div>

        {isCoach && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            ⚠️ 관장님 가입은 관리자 승인 후 코치 권한이 부여됩니다.
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-xl bg-primary py-4 text-lg font-bold text-primary-foreground shadow-glow-primary transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {isLoading ? "등록 중..." : "등록 완료 🥊"}
        </button>
      </form>
    </div>
  );
};

export default SelectBranchPage;
