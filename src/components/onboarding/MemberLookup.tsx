// 첫 화면 「네, 다니고 있어요」 다음 — 정보를 먼저 받아 기록을 찾고, 찾은 뒤에 로그인 방법을 고른다 (2026-11-22).
// 찾기 = claim-member-account check (이름 + 전화번호, 체육관에 생년월일이 있는 회원은 생년월일까지 — 서버가 판정).
// 결과에는 회원 정보가 담겨 오지 않는다 — 레벨 · 출석은 본인 로그인(카카오 · 아이디)이 끝난 뒤에만 보인다.
// 못 찾으면 「데스크에 확인 부탁하기」(2026-11-22 확인 대기 — member-lookup-request): 지점이 회원을 찾아 연결하면
//   이 화면이 이어받기 표를 받아 카카오로 바로 이어받는다. 열쇠는 이 기기에 남아 앱을 다시 열어도 여기부터.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, CheckCircle2, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearLinkTicket,
  clearLookupRequest,
  lookupStatusOf,
  peekLookupRequest,
  requestStatusOf,
  saveLinkTicket,
  saveLookupRequest,
  type LookupStatus,
  type RequestStatus,
} from "@/lib/memberEntry";
import { SIGNUP_BRANCHES, branchShortName } from "@/lib/branchPayment";

const digits = (s: string) => s.replace(/[^0-9]/g, "");
const formatPhone = (v: string) => {
  const d = digits(v).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
};

const inputClass =
  "w-full rounded-xl border border-border bg-card px-4 py-3.5 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

type View = "form" | "found" | "notfound" | "registered" | "ask_desk" | "waiting";

const POLL_MS = 30_000;

const timeAgo = (iso: string | null | undefined, now = Date.now()) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const m = Math.max(0, Math.round((now - t) / 60_000));
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.round(h / 24)}일 전`;
};

interface Props {
  onBack: () => void;
  onLogin: () => void;
  onKakao: () => Promise<void>;
  kakaoBusy: boolean;
}

const MemberLookup = ({ onBack, onLogin, onKakao, kakaoBusy }: Props) => {
  const navigate = useNavigate();
  const [view, setView] = useState<View>(() => (peekLookupRequest() ? "waiting" : "form"));
  const [mismatchMsg, setMismatchMsg] = useState("");
  const [viaDesk, setViaDesk] = useState(false);
  const [deskBranch, setDeskBranch] = useState("");
  const [memo, setMemo] = useState("");
  const [req, setReq] = useState<{ status: RequestStatus; reply: string; branch: string; createdAt: string } | null>(null);
  const [checking, setChecking] = useState(false);
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
        setViaDesk(false);
        setView("found");
        return;
      }
      setTicket(null);
      clearLinkTicket();
      setViaDesk(false);
      if (st === "new" || st === "mismatch") {
        const m = (data as { error?: unknown } | null)?.error;
        setMismatchMsg(st === "mismatch" && typeof m === "string" ? m : "");
        return setView("notfound");
      }
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

  // ── 데스크 확인 부탁 (확인 대기) ──
  const checkRequest = useCallback(async () => {
    const saved = peekLookupRequest();
    if (!saved) return setView("form");
    setChecking(true);
    try {
      const { data } = await supabase.functions.invoke("member-lookup-request", { body: { op: "status", key: saved.key } });
      const st = requestStatusOf(data);
      const d = (data ?? {}) as { reply?: unknown; branch?: unknown; created_at?: unknown; ticket?: unknown };
      if (st === "gone") {
        clearLookupRequest();
        setReq(null);
        return setView("form");
      }
      if (st === "found" && typeof d.ticket === "string") {
        // 표는 「카카오로 이어받기」를 누를 때만 기기에 둔다(2026-11-23 보안 점검 — main 7048144 와 같은 규칙)
        setTicket(d.ticket);
        if (saved.name) setName(saved.name);
        setViaDesk(true);
        return setView("found");
      }
      setReq({
        status: st === "found" ? "error" : st,
        reply: typeof d.reply === "string" ? d.reply : "",
        branch: typeof d.branch === "string" ? d.branch : saved.branch,
        createdAt: typeof d.created_at === "string" ? d.created_at : new Date(saved.at).toISOString(),
      });
      setView("waiting");
    } catch {
      setReq((r) => r ?? { status: "error", reply: "", branch: saved.branch, createdAt: new Date(saved.at).toISOString() });
    } finally {
      setChecking(false);
    }
  }, []);

  // 확인 대기 화면이 보이는 동안 30초마다 · 다시 앱으로 돌아올 때 묻는다
  useEffect(() => {
    if (view !== "waiting") return;
    void checkRequest();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void checkRequest();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") void checkRequest();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [view, checkRequest]);

  const openAskDesk = () => {
    setErr("");
    if (!deskBranch && SIGNUP_BRANCHES.length === 1) setDeskBranch(SIGNUP_BRANCHES[0].name);
    setView("ask_desk");
  };

  const sendRequest = async () => {
    setErr("");
    if (!deskBranch) return setErr("다니는 지점을 골라 주세요");
    setBusy(true);
    try {
      const { data } = await supabase.functions.invoke("member-lookup-request", {
        body: { op: "create", name: name.trim(), phone: digits(phone), birthDate: birth, branch: deskBranch, memo: memo.trim() },
      });
      const d = (data ?? {}) as { ok?: unknown; key?: unknown; error?: unknown };
      if (d.ok === true && typeof d.key === "string") {
        saveLookupRequest({ key: d.key, name: name.trim(), branch: deskBranch });
        setReq({ status: "pending", reply: "", branch: deskBranch, createdAt: new Date().toISOString() });
        setView("waiting");
        return;
      }
      setErr(typeof d.error === "string" && d.error ? d.error : "보내는 중 문제가 생겼어요. 잠시 뒤 다시 해 주세요.");
    } catch {
      setErr("보내는 중 문제가 생겼어요. 인터넷 연결을 보고 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    clearLookupRequest();
    clearLinkTicket();
    setTicket(null);
    setReq(null);
    setViaDesk(false);
    setErr("");
    setView("form");
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
        {header("기록을 찾았어요", viaDesk ? startOver : () => {
          setTicket(null);
          clearLinkTicket();
          setView("form");
        })}
        <div className="rounded-2xl border border-primary/30 bg-card p-5 text-center shadow-elev-1">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-heading font-bold text-foreground">{name.trim()}님, 반가워요</p>
          <p className="mt-1 text-body text-muted-foreground">
            {viaDesk ? "지점에서 찾아 연결해 두었어요 · 기록을 그대로 이어받아요" : "레벨 · 출석 · 수강권 기록을 그대로 이어받아요"}
          </p>
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
        {viaDesk ? (
          <p className="mt-4 text-center text-label leading-relaxed text-muted-foreground">아이디 · 비밀번호로 쓰고 싶으면 지점 데스크에 말씀해 주세요</p>
        ) : (
          <button
            type="button"
            onClick={toIdSignup}
            className="mt-4 w-full rounded-xl border border-border bg-card py-3.5 text-body font-bold text-foreground transition-all active:scale-[0.98]"
          >
            아이디 · 비밀번호 만들기
          </button>
        )}
      </div>
    );
  }

  if (view === "notfound") {
    return (
      <div className="w-full max-w-sm animate-slide-up">
        {header(mismatchMsg ? "등록된 정보와 달라요" : "명단에서 못 찾았어요", () => setView("form"))}
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
        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-body font-bold text-foreground">다니고 있는데 안 찾아지나요?</p>
          <p className="mt-1 text-label leading-relaxed text-muted-foreground">지점에서 회원님 기록을 찾아 연결해 드려요. 이 화면에서 바로 이어받을 수 있어요.</p>
          <button
            type="button"
            onClick={openAskDesk}
            className="mt-3 w-full rounded-xl bg-foreground py-3.5 text-body font-bold text-background active:scale-[0.98]"
          >
            데스크에 확인 부탁하기
          </button>
        </div>
      </div>
    );
  }

  if (view === "ask_desk") {
    return (
      <div className="w-full max-w-sm animate-slide-up">
        {header("데스크에 확인 부탁", () => setView("notfound"))}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
          <p className="text-label font-bold text-muted-foreground">보낼 정보</p>
          <p className="mt-1 text-heading font-bold text-foreground">{name.trim()}</p>
          <p className="text-body text-muted-foreground">
            {formatPhone(phone)} · {birth.slice(0, 4)}.{birth.slice(4, 6)}.{birth.slice(6, 8)}
          </p>
        </div>
        <p className="mb-2 mt-5 text-label font-bold text-muted-foreground">다니는 지점</p>
        <div className="flex gap-2">
          {SIGNUP_BRANCHES.map((b) => (
            <button
              key={b.name}
              type="button"
              onClick={() => setDeskBranch(b.name)}
              aria-pressed={deskBranch === b.name}
              className={`flex-1 rounded-xl py-3 text-body font-bold transition-all active:scale-95 ${deskBranch === b.name ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {b.label}
            </button>
          ))}
        </div>
        <label htmlFor="lookup-memo" className="mb-2 mt-5 block text-label font-bold text-muted-foreground">
          남길 말 (선택)
        </label>
        <textarea
          id="lookup-memo"
          className={`${inputClass} min-h-[88px] resize-none`}
          value={memo}
          maxLength={200}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="예) 예전 번호로 등록했어요 · 보호자 번호로 등록했어요"
        />
        {err && <p role="alert" className="mt-2 text-body text-destructive">{err}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void sendRequest()}
          className="mt-4 w-full rounded-xl bg-primary py-4 text-body font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "보내는 중…" : "확인 부탁하기"}
        </button>
        <p className="mt-3 text-center text-label leading-relaxed text-muted-foreground">지점에서 전화나 데스크로 본인인지 확인한 뒤 연결해요</p>
      </div>
    );
  }

  if (view === "waiting") {
    const st = req?.status ?? "pending";
    const short = branchShortName(req?.branch || peekLookupRequest()?.branch);
    const reqName = peekLookupRequest()?.name || name.trim();
    const refreshBtn = (
      <button
        type="button"
        disabled={checking}
        onClick={() => void checkRequest()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-body font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98] disabled:opacity-50"
      >
        <RefreshCw className={`h-5 w-5 ${checking ? "animate-spin" : ""}`} />
        {checking ? "확인하는 중…" : "지금 확인하기"}
      </button>
    );
    const againBtn = (label: string) => (
      <button type="button" onClick={startOver} className="mt-3 w-full rounded-xl border border-border bg-card py-3.5 text-body font-bold text-foreground active:scale-[0.98]">
        {label}
      </button>
    );
    const signupBtn = (
      <button
        type="button"
        onClick={() => {
          clearLookupRequest();
          navigate("/signup");
        }}
        className="mt-3 w-full rounded-xl border border-border bg-card py-3.5 text-body font-bold text-foreground active:scale-[0.98]"
      >
        처음이에요 · 신규 가입
      </button>
    );
    const replyBox = req?.reply ? (
      <div className="mt-3 rounded-xl bg-muted px-4 py-3">
        <p className="text-label font-bold text-muted-foreground">{short} 답</p>
        <p className="mt-0.5 whitespace-pre-line text-body text-foreground">{req.reply}</p>
      </div>
    ) : null;

    if (st === "not_member") {
      return (
        <div className="w-full max-w-sm animate-slide-up">
          {header("명단에 없다고 해요", startOver)}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
            <p className="text-body text-foreground">{short}에서 확인해 보니 회원 명단에 없어요. 처음이시면 신규 가입으로 시작해 주세요.</p>
            {replyBox}
          </div>
          {signupBtn}
          {againBtn("다른 정보로 다시 찾기")}
        </div>
      );
    }
    if (st === "done") {
      return (
        <div className="w-full max-w-sm animate-slide-up">
          {header("이미 이어받았어요", startOver)}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
            <p className="text-body text-foreground">이 기록은 이미 앱 계정에 이어졌어요. 그때 쓰신 방법으로 로그인해 주세요.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearLookupRequest();
              onLogin();
            }}
            className="mt-4 w-full rounded-xl bg-primary py-3.5 text-body font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98]"
          >
            로그인하러 가기
          </button>
        </div>
      );
    }
    if (st === "closed" || st === "expired") {
      return (
        <div className="w-full max-w-sm animate-slide-up">
          {header(st === "expired" ? "연결 시간이 지났어요" : "지점에서 처리했어요", startOver)}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-elev-1">
            <p className="text-body text-foreground">
              {st === "expired"
                ? "지점에서 연결해 둔 지 7일이 지났어요. 다시 부탁하거나 데스크에 말씀해 주세요."
                : "데스크에서 안내해 드렸어요. 안내대로 다시 찾아 주세요."}
            </p>
            {replyBox}
          </div>
          {againBtn("다시 찾기")}
          {signupBtn}
        </div>
      );
    }
    return (
      <div className="w-full max-w-sm animate-slide-up">
        {header("확인 대기 중", startOver)}
        <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-elev-1">
          <Clock className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 text-heading font-bold text-foreground">{short}에서 확인하고 있어요</p>
          <p className="mt-1 text-body text-muted-foreground">
            {reqName ? `${reqName}님 · ` : ""}
            {timeAgo(req?.createdAt) || "방금"} 부탁함
          </p>
          <p className="mt-3 text-label leading-relaxed text-muted-foreground">
            연결되면 이 화면에서 바로 이어받아요. 앱을 닫아도 괜찮아요 · 다시 열면 여기부터 보여요
          </p>
          {st === "error" && <p className="mt-2 text-label text-destructive">지금은 상태를 못 불러왔어요. 잠시 뒤 다시 확인해 주세요.</p>}
        </div>
        {refreshBtn}
        {againBtn("다른 정보로 다시 찾기")}
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
