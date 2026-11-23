// 소셜(구글/카카오) 첫 로그인 시 기존 일괄등록 계정 연동 (권장·스킵 가능).
// 대상: role=member 이고 프로필에 전화번호가 없는 회원(소셜 가입자). 일괄등록 회원은 전화번호가 있어 제외.
// 2026-11-23 보안 점검(CRITICAL): 번호만 넣으면 남의 계정을 합칠 수 있었다 → 이름 · 번호 · 생년월일로 「기록 찾기」
//   (claim-member-account check — 틀리면 잠금)를 거쳐 받은 표로만 합친다. 첫 화면에서 찾은 표는 합치기 전에 한 번 묻는다
//   (공용 기기에서 다음 사람 계정에 앞사람 기록이 합쳐지지 않게).
import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { runInviteClaim } from "@/components/InviteRewardBridge";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { clearLinkTicket, lookupStatusOf, markLoggedIn, peekLinkTicket } from "@/lib/memberEntry";

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
  const [name, setName] = useState("");
  const [birth, setBirth] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const needsLink = !!user && !!profile && role === "member" && !profile.phone_number;
  // 2026-11-22 첫 사용 순서: 이 기기에서 로그인한 적이 있으면 다음부터 첫 질문 없이 로그인 화면부터.
  useEffect(() => {
    if (user) markLoggedIn();
  }, [user]);
  useEffect(() => {
    if (profile?.name) setName((v) => v || String(profile.name));
  }, [profile?.name]);
  // 「기록을 찾았어요 → 카카오로 이어받기」로 돌아왔으면 그 표로 합칠지 한 번 묻는다(번호를 다시 묻지는 않음).
  //   묻지 않고 합치면, 공용 기기에서 앞사람이 찾기만 하고 떠난 표가 다음 로그인 계정에 합쳐질 수 있었다(2026-11-23 점검).
  const autoTried = useRef(false);
  const [autoLinking, setAutoLinking] = useState(false);
  const [pendingTicket, setPendingTicket] = useState<string | null>(null);
  useEffect(() => {
    if (!user || !profile || autoTried.current) return;
    const ticket = peekLinkTicket();
    if (!ticket) return;
    if (!needsLink) {
      clearLinkTicket(); // 이미 번호가 붙은 계정(예전에 합친 계정) — 표는 쓸 일이 없다
      return;
    }
    autoTried.current = true;
    setPendingTicket(ticket);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, needsLink]);

  const acceptPending = () => {
    const ticket = pendingTicket;
    setPendingTicket(null);
    clearLinkTicket();
    if (!ticket) return;
    setAutoLinking(true);
    void link({ ticket }).finally(() => setAutoLinking(false));
  };
  const rejectPending = () => {
    setPendingTicket(null);
    clearLinkTicket();
  };

  if (!needsLink || dismissed) return null;
  if (!pendingTicket && !autoLinking && (location.pathname === "/signup" || location.pathname === "/login")) return null;

  // 이름 · 번호 · 생년월일로 기록 찾기 → 이 계정에 묶인 표(10분) → 합치기
  const submit = async () => {
    setError("");
    const p = phone.replace(/\D/g, "");
    if (!name.trim()) return setError("체육관에 등록한 이름(실명)을 넣어 주세요.");
    if (!/^0\d{9,10}$/.test(p)) return setError("체육관에 등록한 전화번호를 정확히 넣어 주세요.");
    if (birth.length !== 8) return setError("생년월일 8자리를 넣어 주세요. (예: 19990315)");
    setLoading(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("claim-member-account", {
        body: { action: "check", phone: p, name: name.trim(), birthDate: birth, ticket: true },
      });
      if (fnErr) throw fnErr;
      const st = lookupStatusOf(data);
      const ticket = (data as { ticket?: unknown } | null)?.ticket;
      if (st === "existing" && typeof ticket === "string") {
        await link({ ticket });
        return;
      }
      if (st === "new") {
        setError("체육관에 등록된 회원 번호가 아니에요. 체육관에 처음 오셨다면 아래 가입 신청을 진행해 주세요.");
        return;
      }
      const msg = (data as { error?: unknown } | null)?.error;
      setError(typeof msg === "string" && msg ? msg : "확인 중 문제가 생겼어요. 잠시 뒤 다시 해 주세요.");
    } catch {
      setError("확인 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  async function link(body: { ticket: string }) {
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

  if (pendingTicket) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
        <div role="dialog" aria-modal="true" aria-labelledby="link-confirm-title" className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Link2 className="h-4 w-4" />
            </span>
            <h2 id="link-confirm-title" className="text-body font-bold text-foreground">찾은 기록을 이 계정으로 옮길까요?</h2>
          </div>
          <p className="text-label leading-relaxed text-muted-foreground">
            방금 「기록 찾기」에서 찾은 <b className="text-foreground">레벨 · 출석 · 수강권 기록</b>을 지금 로그인한 계정으로 옮겨요.
            <b className="text-foreground"> 내가 찾은 기록이 아니면</b> 「아니에요」를 눌러 주세요.
          </p>
          <button
            type="button"
            onClick={acceptPending}
            className="mt-4 w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98]"
          >
            네, 내 기록이에요 · 옮기기
          </button>
          <button
            type="button"
            onClick={rejectPending}
            className="mt-3 w-full rounded-xl border border-border bg-card py-3 text-body font-bold text-foreground active:scale-[0.98]"
          >
            아니에요
          </button>
        </div>
      </div>
    );
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
          <b className="text-foreground">153복싱짐 회원</b>이시면 <b className="text-foreground">체육관에 등록한 이름 · 전화번호 · 생년월일</b>을 넣어 주세요 — 레벨·출석 기록이 그대로 이어져요. 체육관에 처음 오셨다면 아래에서 <b className="text-foreground">가입 신청</b>을 진행해주세요.
        </p>
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름(실명)"
            autoComplete="name"
            aria-label="이름(실명)"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            aria-label="체육관에 등록한 전화번호"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
          <input
            value={birth}
            onChange={(e) => setBirth(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
            placeholder="생년월일 8자리 (예: 19990315)"
            inputMode="numeric"
            maxLength={8}
            aria-label="생년월일"
            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
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
