// 「기록 찾기」 휴대폰 인증 창 (2026-11-24 보안 점검 ③ — 생년월일이 등록되지 않은 회원)
// claim-member-account 가 need_sms 를 내면 이 창을 띄운다: 등록된 번호로 6자리 인증번호(sms_send) → 넣기(sms_verify)
// → 15분짜리 smsProof 를 onVerified 로 돌려준다. 부르는 쪽은 그 표를 같은 요청(check · claim)에 붙여 다시 보낸다.
// 쓰는 곳: 첫 화면 기록 찾기(MemberLookup) · 회원 등록 확인(LinkAccountPrompt) · 가입 신청(SignupApply).
import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  name: string;
  phone: string; // 숫자만
  birth: string; // 8자리
  phoneMasked?: string | null;
  /** 인증 통과 표. 서버가 "인증이 필요 없다"(existing)고 하면 null — 부르는 쪽은 그냥 다시 확인한다. */
  onVerified: (smsProof: string | null) => void;
  onClose: () => void;
}

const RESEND_SEC = 60;

const ClaimSmsStep = ({ name, phone, birth, phoneMasked, onVerified, onClose }: Props) => {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [left, setLeft] = useState(0);
  const [masked, setMasked] = useState(phoneMasked ?? "");

  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);

  const call = async (action: "sms_send" | "sms_verify") => {
    const { data } = await supabase.functions.invoke("claim-member-account", {
      body: { action, phone, name: name.trim(), birthDate: birth, ...(action === "sms_verify" ? { code } : {}) },
    });
    return (data ?? null) as { ok?: boolean; status?: string; error?: string; phoneMasked?: string; smsProof?: string } | null;
  };

  const send = async () => {
    if (busy || left > 0) return;
    setErr("");
    setInfo("");
    setBusy(true);
    try {
      const r = await call("sms_send");
      if (r?.status === "existing") return onVerified(null);
      if (r?.ok && r.status === "sms_sent") {
        setSent(true);
        setCode("");
        setLeft(RESEND_SEC);
        if (r.phoneMasked) setMasked(r.phoneMasked);
        setInfo("인증번호를 보냈어요. 문자로 받은 6자리를 5분 안에 넣어 주세요.");
        return;
      }
      if (r?.status === "sms_wait") setLeft(RESEND_SEC);
      setErr(r?.error || "인증번호를 보내지 못했어요. 잠시 뒤 다시 해 주세요.");
    } catch {
      setErr("인증번호를 보내지 못했어요. 인터넷 연결을 보고 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (busy) return;
    setErr("");
    if (code.length !== 6) return setErr("문자로 받은 인증번호 6자리를 넣어 주세요.");
    setBusy(true);
    try {
      const r = await call("sms_verify");
      if (r?.ok && r.status === "sms_ok" && typeof r.smsProof === "string") return onVerified(r.smsProof);
      if (r?.status === "existing") return onVerified(null);
      if (r?.status === "sms_expired") setSent(false);
      setErr(r?.error || "확인하지 못했어요. 잠시 뒤 다시 해 주세요.");
    } catch {
      setErr("확인하지 못했어요. 인터넷 연결을 보고 다시 해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="claim-sms-title" className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-elev-3">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <h2 id="claim-sms-title" className="text-body font-bold text-foreground">휴대폰 인증</h2>
        </div>
        <p className="text-label leading-relaxed text-muted-foreground">
          체육관에 <b className="text-foreground">생년월일이 등록되지 않은 회원</b>이라 본인 확인이 한 번 더 필요해요.
          등록된 번호{masked ? <b className="text-foreground"> {masked}</b> : ""}로 인증번호를 보내 드릴게요.
        </p>
        {sent && (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void verify();
            }}
            placeholder="인증번호 6자리"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            aria-label="인증번호 6자리"
            className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-heading tracking-[0.4em] text-foreground placeholder:tracking-normal placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        )}
        {info && !err && <p role="status" className="mt-2 text-label text-primary">{info}</p>}
        {err && <p role="alert" className="mt-2 text-label text-destructive">{err}</p>}
        <button
          type="button"
          onClick={() => void (sent ? verify() : send())}
          disabled={busy || (!sent && left > 0)}
          className="mt-4 w-full rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground shadow-glow-soft active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "잠시만요…" : sent ? "확인" : left > 0 ? `${left}초 뒤 다시 받기` : "인증번호 받기"}
        </button>
        {sent && (
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || left > 0}
            className="mt-3 w-full text-center text-label text-muted-foreground underline disabled:no-underline disabled:opacity-60"
          >
            {left > 0 ? `인증번호 다시 받기 (${left}초)` : "인증번호 다시 받기"}
          </button>
        )}
        <button type="button" onClick={onClose} className="mt-3 w-full text-center text-label text-muted-foreground underline">
          닫기 · 안 되면 지점 데스크에 말씀해 주세요
        </button>
      </div>
    </div>
  );
};

export default ClaimSmsStep;
