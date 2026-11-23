// 첫 화면 「네, 다니고 있어요」 다음 — 정보를 먼저 받아 기록을 찾고, 찾은 뒤에 로그인 방법을 고른다 (2026-11-22).
// 찾기 = claim-member-account check (이름 + 전화번호, 체육관에 생년월일이 있는 회원은 생년월일까지 — 서버가 판정).
// 결과에는 회원 정보가 담겨 오지 않는다 — 레벨 · 출석은 본인 로그인(카카오 · 아이디)이 끝난 뒤에만 보인다.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearLinkTicket, lookupStatusOf, saveLinkTicket, type LookupStatus } from "@/lib/memberEntry";

const digits = (s: string) => s.replace(/[^0-9]/g, "");
const formatPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type View = "form" | "found" | "notfound" | "registered";

interface Props {
  onBack: () => void;
  onLogin: () => void;
  onKakao: () => Promise<void>;
  kakaoBusy: boolean;
}

const MemberLookup = ({ onBack, onLogin, onKakao, kakaoBusy }: Props) => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // 이어받기 표 — 「카카오로 이어받기」를 누를 때만 기기에 둔다(찾기만 하고 떠나면 남지 않게, 2026-11-23 점검).
  const [ticket, setTicket] = useState<string | null>(null);

  const find = async () => {
    setErr("");
    if (!name.trim()) return setErr("이름(실명)을 넣어 주세요");
    if (!/^0\d{9,10}$/.test(digits(phone))) return setErr("체육관에 등록한 전화번호를 정확히 넣어 주세요");
    if (birth.length !== 8) return setErr("생년월일 8자리를 넣어 주세요 (예: 19990315)");
    setBusy(true);
    try {
      const { data } = await supabase.functions.invoke("claim-member-account", {
        body: { action: "check", phone: digits(phone), name: name.trim(), birthDate: birth, ticket: true },
      });
      const st: LookupStatus = lookupStatusOf(data);
      const got = (data as { ticket?: unknown } | null)?.ticket;
      if (st === "existing") {
        setTicket(typeof got === "string" ? got : null);
        setView("found");
        return;
      }
      setTicket(null);
      clearLinkTicket();
      if (st === "new") return setView("notfound");
      if (st === "registered") return setView("registered");
      const msg = (data as { error?: unknown } | null)?.error;
      setErr(typeof msg === "string" && msg ? msg : "확인 중 문제가 생겼어요. 잠시 뒤 다시 해 주세요.");
    } catch {
      setErr("확인 중 문제가 생겼어요. 인터넷 연결을 보고 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const toIdSignup = () => {
    clearLinkTicket();
    navigate("/signup", { state: { member: { name: name.trim(), phone: digits(phone), birth } } });
  };

  const header = (title: string, back: () => void) => (
    <div className="mb-4 flex items-center gap-2">
      <button type="button" onClick={back} aria-label="뒤로" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <h1 className="text-heading font-bold text-foreground">{title}</h1>
    </div>
  );

  if (view === "found") {
    return (
      <div className="w-full max-w-sm animate-slide-up">
        {header("기록을 찾았어요", () => {
          setTicket(null);
          clearLinkTicket();
          setView("form");
        })}
        <div className="rounded-2xl border border-primary/30 bg-card p-5 text-center shadow-elev-1">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-heading font-bold text-foreground">{name.trim()}님, 반가워요</p>
          <p className="mt-1 text-body text-muted-foreground">레벨 · 출석 · 수강권 기록을 그대로 이어받아요</p>
        </div>
        <p className="mb-2 mt-5 text-label font-bold text-muted-foreground">어떻게 로그인할까요?</p>
        <button
          type="button"
          disabled={kakaoBusy}
          onClick={() => {
            if (ticket) saveLinkTicket(ticket);
            void onKakao();
          }}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#FEE500] py-4 text-body font-bold text-black shadow-elev-1 transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
        >
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#000000" aria-hidden="true">
            <path d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.77-.2.74-.74 2.7-.85 3.12-.13.52.19.51.4.37.16-.11 2.6-1.77 3.66-2.49.69.1 1.4.15 2.13.15 5.52 0 10-3.58 10-8S17.52 3 12 3z" />
          </svg>
          카카오로 이어받기
        </button>
        <p className="mt-1.5 text-center text-label text-muted-foreground">가장 쉬워요 · 다음부터 카카오 버튼 하나로 들어와요</p>
        <button
          type="button"
          onClick={toIdSignup}
          className="mt-4 w-full rounded-xl border border-border bg-card py-3.5 text-body font-bold text-foreground transition-all active:scale-[0.98]"
        >
          아이디 · 비밀번호 만들기
        </button>
      </div>
    );
  }

  if (view === "notfound") {
    return (
      <div className="w-full max-w-sm animate-slide-up">
        {header("명단에서 못 찾았어요", () => setView("form"))}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
          <p className="text-body font-bold text-foreground">이렇게 확인해 보세요</p>
          <ul className="mt-2 space-y-1.5 text-body text-muted-foreground">
            <li>· 체육관에 등록할 때 쓴 번호인지 (보호자 번호 · 예전 번호)</li>
            <li>· 이름을 등록할 때와 똑같이 썼는지</li>
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setView("form")}
          className="mt-4 w-full rounded-xl bg-primary py-3.5 text-body font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98]"
        >
          다시 넣기
        </button>
        <button
          type="button"
          onClick={() => navigate("/signup")}
          className="mt-3 w-full rounded-xl border border-border bg-card py-3.5 text-body font-bold text-foreground active:scale-[0.98]"
        >
          처음이에요 · 신규 가입
        </button>
        <p className="mt-3 text-center text-label leading-relaxed text-muted-foreground">
          다니고 계신데 계속 안 찾아지면 지점 데스크에 말씀해 주세요
        </p>
      </div>
    );
  }

  if (view === "registered") {
    return (
      <div className="w-full max-w-sm animate-slide-up">
        {header("이미 앱 계정이 있어요", () => setView("form"))}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
          <p className="text-body text-foreground">이 번호로 이미 앱을 쓰고 계세요. 그때 쓰신 방법(카카오 또는 아이디)으로 로그인해 주세요.</p>
        </div>
        <button
          type="button"
          onClick={onLogin}
          className="mt-4 w-full rounded-xl bg-primary py-3.5 text-body font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98]"
        >
          로그인하러 가기
        </button>
        <p className="mt-3 text-center text-label text-muted-foreground">기억이 안 나면 로그인 화면의 「아이디 찾기」를 눌러 주세요</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm animate-slide-up">
      {header("기록 찾기", onBack)}
      <p className="mb-4 text-body text-muted-foreground">체육관에 등록할 때 쓴 정보를 넣어 주세요</p>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <div>
          <label htmlFor="lookup-name" className="mb-1 block text-body font-medium text-muted-foreground">이름(실명)</label>
          <input id="lookup-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="lookup-phone" className="mb-1 block text-body font-medium text-muted-foreground">등록한 전화번호</label>
          <input id="lookup-phone" type="tel" className={inputClass} value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" autoComplete="tel" />
        </div>
        <div>
          <label htmlFor="lookup-birth" className="mb-1 block text-body font-medium text-muted-foreground">생년월일</label>
          <input id="lookup-birth" className={inputClass} value={birth} onChange={(e) => setBirth(digits(e.target.value).slice(0, 8))} placeholder="19990315" inputMode="numeric" maxLength={8} />
        </div>
        {err && <p role="alert" className="text-body text-destructive">{err}</p>}
        <button
          type="submit"
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-body font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98] disabled:opacity-50"
        >
          <Search className="h-5 w-5" />
          {busy ? "찾는 중…" : "내 기록 찾기"}
        </button>
      </form>
    </div>
  );
};

export default MemberLookup;
