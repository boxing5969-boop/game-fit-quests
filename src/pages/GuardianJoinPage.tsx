/**
 * /guardian/join?t=… — 보호자 연결 링크 · 데스크 QR 이 여는 화면 (2026-11-23 대표님 「추천대로」).
 *
 * 로그인 전: 안내 + 「카카오로 시작하기」 — 링크를 이 기기(하루) · 이 탭(10분)에 적어 두고 카카오 로그인 → "/" → 여기로 돌아온다.
 * 로그인 뒤: 서버에 링크 확인(guardian_invite_peek) → 「엄마 · 아빠 · 보호자」 고르기 → 연결(guardian_invite_accept) → /guardian.
 * 이 화면은 ProtectedRoute 밖이다 — 지점 고르기 · 승인 기다림으로 보내지 않는다(보호자 계정은 회원 승인이 없다).
 * 예시: /guardian/join?demo=1
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, HeartHandshake } from "lucide-react";
import AppPage from "@/components/ui/rankingup/AppPage";
import MyBoxerWordmark from "@/components/brand/MyBoxerWordmark";
import RouteLoader from "@/components/splash/RouteLoader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isIosApp, loadIosAppNative } from "@/lib/iosApp";
import { clearPostLoginPath, rememberPostLoginPath } from "@/lib/postLoginRedirect";
import {
  GUARDIAN_JOIN_PATH,
  GUARDIAN_RELATIONS,
  RELATION_LABEL,
  clearGuardianToken,
  isGuardianToken,
  readGuardianToken,
  rememberGuardianToken,
  type GuardianRelation,
} from "@/lib/guardian";
import { GUARDIAN_KEY, acceptGuardianInvite, guardianDemo, peekGuardianInvite, type PeekCode, type PeekResult } from "@/services/guardianService";

type PeekFail = Extract<PeekResult, { ok: false }>;
type PeekOk = Extract<PeekResult, { ok: true }>;
const isPeekFail = (r: PeekResult | undefined): r is PeekFail => !!r && r.ok === false;

const CODE_TEXT: Record<Exclude<PeekCode, "login">, { title: string; body: string }> = {
  bad: { title: "링크를 찾을 수 없어요", body: "아이에게 새 링크를 받거나 데스크에 말씀해 주세요." },
  used: { title: "이미 쓴 링크예요", body: "링크는 한 분만 쓸 수 있어요. 아이에게 새 링크를 받아 주세요." },
  done: { title: "이미 연결한 링크예요", body: "「우리 아이」 화면에서 기록을 볼 수 있어요." },
  expired: { title: "기한이 지난 링크예요", body: "아이에게 새 링크를 받거나 데스크에서 QR을 다시 받아 주세요." },
  self: { title: "내가 만든 링크예요", body: "엄마 · 아빠 휴대폰으로 보내서 열어 주세요." },
  missing: { title: "아직 준비 중인 기능이에요", body: "곧 열려요. 조금만 기다려 주세요." },
};

const GuardianJoinPage = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const demo = guardianDemo("demo");
  const qToken = params.get("t");
  const token = useMemo(() => (isGuardianToken(qToken) ? qToken : readGuardianToken()), [qToken]);
  const [relation, setRelation] = useState<GuardianRelation | null>(null);
  const [busy, setBusy] = useState(false);
  const [kakaoBusy, setKakaoBusy] = useState(false);

  // 로그인하러 다녀오는 동안 잊지 않게 — 링크가 주소에 있으면 바로 적어 둔다
  useEffect(() => {
    if (token && !demo) rememberGuardianToken(token);
  }, [token, demo]);

  const peek = useQuery({
    queryKey: [...GUARDIAN_KEY, "peek", token ?? "", user?.id ?? "anon"],
    enabled: !demo && !!user && !!token,
    retry: false,
    staleTime: 60_000,
    queryFn: () => peekGuardianInvite(token as string),
  });

  // 더는 쓸 수 없는 링크면 기억을 지운다(다음 로그인 때 또 여기로 오지 않게)
  useEffect(() => {
    const r = peek.data;
    if (isPeekFail(r) && r.code !== "login") {
      clearGuardianToken();
      clearPostLoginPath();
    }
  }, [peek.data]);

  const startKakao = async () => {
    if (!token) return;
    rememberGuardianToken(token);
    rememberPostLoginPath(`${GUARDIAN_JOIN_PATH}?t=${token}`);
    setKakaoBusy(true);
    try {
      if (isIosApp()) {
        const err = await (await loadIosAppNative()).signInWithOAuthInApp("kakao", "profile_nickname");
        if (err) toast.error("카카오 로그인에 실패했어요");
        return;
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: window.location.origin, scopes: "profile_nickname" },
      });
      if (error) toast.error("카카오 로그인에 실패했어요");
    } catch {
      toast.error("카카오 로그인에 실패했어요");
    } finally {
      setKakaoBusy(false);
    }
  };

  const goLogin = () => {
    if (token) {
      rememberGuardianToken(token);
      rememberPostLoginPath(`${GUARDIAN_JOIN_PATH}?t=${token}`);
    }
    navigate("/");
  };

  const accept = async () => {
    if (!relation || busy) return;
    if (demo) {
      toast.success("연결됐어요");
      navigate("/guardian?demo=1", { replace: true });
      return;
    }
    if (!token) return;
    setBusy(true);
    try {
      const r = await acceptGuardianInvite(token, relation);
      clearGuardianToken();
      clearPostLoginPath();
      await refreshProfile();
      await qc.invalidateQueries({ queryKey: GUARDIAN_KEY });
      if (r.status === "pending") toast.success("요청을 보냈어요 · 회원이 앱에서 수락하면 이어져요");
      else toast.success("연결됐어요 · 체육관에 오면 알림이 가요");
      navigate("/guardian", { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "연결하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  const shell = (body: React.ReactNode) => (
    <AppPage noBottomPad>
      <div className="mx-auto flex min-h-[80vh] max-w-sm flex-col justify-center">
        <div className="mb-6 flex justify-center">
          <MyBoxerWordmark size="md" align="center" />
        </div>
        {demo && <p className="mb-3 text-center text-label font-bold text-muted-foreground">예시 화면이에요 · 이름은 가상이에요</p>}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-elev-1">{body}</div>
        <p className="mt-6 text-center text-label text-muted-foreground">153 건강과 행복. 153복싱짐</p>
      </div>
    </AppPage>
  );

  const icon = (
    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
      <HeartHandshake className="h-7 w-7" aria-hidden="true" />
    </span>
  );

  if (loading) return <RouteLoader />;

  if (!token && !demo) {
    return shell(
      <div className="text-center">
        {icon}
        <p className="mt-4 text-heading font-black text-foreground">{CODE_TEXT.bad.title}</p>
        <p className="mt-1 text-body text-muted-foreground">{CODE_TEXT.bad.body}</p>
      </div>,
    );
  }

  // 로그인 전 — 카카오로 시작 (예시: ?demo=1&step=login)
  if ((!user && !demo) || (demo && params.get("step") === "login")) {
    return shell(
      <div className="text-center">
        {icon}
        <p className="mt-4 text-heading font-black text-foreground [text-wrap:balance]">아이의 153복싱짐 운동 기록을 받아 보세요</p>
        <ul className="mt-4 space-y-2 text-left">
          {["체육관에 온 시각 · 운동이 끝난 시각 알림", "이번 달 운동한 날과 시간", "레벨 · 코치 한마디 · 153 PB 기록"].map((x) => (
            <li key={x} className="flex items-start gap-2 text-body text-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} aria-hidden="true" />
              <span>{x}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void startKakao()}
          disabled={kakaoBusy}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl bg-[#FEE500] text-body font-black text-[#191919] transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {kakaoBusy ? "카카오로 가는 중" : "카카오로 시작하기"}
        </button>
        <button type="button" onClick={goLogin} className="mt-3 w-full py-2 text-label font-bold text-muted-foreground underline underline-offset-4">
          이미 마이복서153 회원이에요 · 로그인
        </button>
        <p className="mt-3 text-label text-muted-foreground">메시지 · 커뮤니티 글 · 몸무게는 보이지 않아요.</p>
      </div>,
    );
  }

  if (!demo && peek.isLoading) return <RouteLoader />;
  if (!demo && (peek.error || !peek.data)) {
    return shell(
      <div className="text-center">
        {icon}
        <p className="mt-4 text-heading font-black text-foreground">링크를 확인하지 못했어요</p>
        <button type="button" onClick={() => void peek.refetch()} className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-body font-bold text-primary-foreground active:scale-95">
          다시 확인하기
        </button>
      </div>,
    );
  }

  const res: PeekResult = demo
    ? { ok: true, name: "김민준", branch: "선릉역점", via: "child_invite", linked: null, needsAccept: false }
    : (peek.data as PeekResult);

  if (isPeekFail(res)) {
    const fail = res;
    const c = fail.code === "login" ? CODE_TEXT.bad : CODE_TEXT[fail.code];
    return shell(
      <div className="text-center">
        {icon}
        <p className="mt-4 text-heading font-black text-foreground">{c.title}</p>
        <p className="mt-1 text-body text-muted-foreground [text-wrap:pretty]">{c.body}</p>
        <button
          type="button"
          onClick={() => navigate(fail.code === "done" ? "/guardian" : "/", { replace: true })}
          className="mt-5 rounded-xl bg-muted px-4 py-2.5 text-body font-bold text-foreground active:scale-95"
        >
          {fail.code === "done" ? "우리 아이 기록 보기" : "처음 화면으로"}
        </button>
      </div>,
    );
  }

  const r = res as PeekOk;
  if (r.linked) {
    return shell(
      <div className="text-center">
        {icon}
        <p className="mt-4 text-heading font-black text-foreground">{r.linked === "pending" ? "회원 수락을 기다리고 있어요" : "이미 연결돼 있어요"}</p>
        <p className="mt-1 text-body text-muted-foreground [text-wrap:pretty]">
          {r.linked === "pending" ? `${r.name} 회원이 앱에서 수락하면 이어져요.` : `${r.name} 회원의 기록을 「우리 아이」에서 볼 수 있어요.`}
        </p>
        <button
          type="button"
          onClick={() => {
            clearGuardianToken();
            clearPostLoginPath();
            navigate("/guardian", { replace: true });
          }}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98]"
        >
          우리 아이 기록 보기
        </button>
      </div>,
    );
  }

  return shell(
    <div>
      <div className="text-center">
        {icon}
        <p className="mt-4 text-label font-bold text-primary">{r.branch ?? "153복싱짐"}</p>
        <p className="mt-1 text-heading font-black text-foreground [text-wrap:balance]">{r.name} 회원과 연결할까요?</p>
        <p className="mt-1 text-body text-muted-foreground">{r.name} 회원에게 어떤 분이세요?</p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="관계">
        {GUARDIAN_RELATIONS.map((rel) => (
          <button
            key={rel}
            type="button"
            role="radio"
            aria-checked={relation === rel}
            onClick={() => setRelation(rel)}
            className={`h-12 rounded-xl border text-body font-bold transition-all active:scale-[0.98] ${
              relation === rel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"
            }`}
          >
            {RELATION_LABEL[rel]}
          </button>
        ))}
      </div>
      {r.needsAccept && (
        <p className="mt-3 text-label text-muted-foreground [text-wrap:pretty]">성인 회원이라 회원 본인이 앱에서 수락하면 이어져요.</p>
      )}
      <button
        type="button"
        onClick={() => void accept()}
        disabled={!relation || busy}
        className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "연결하는 중" : relation ? `${RELATION_LABEL[relation]}로 연결하기` : "관계를 골라 주세요"}
      </button>
      <p className="mt-3 text-center text-label text-muted-foreground">체육관에 온 시각 · 운동 시간 · 레벨 · 코치 한마디만 보여요.</p>
    </div>,
  );
};

export default GuardianJoinPage;
