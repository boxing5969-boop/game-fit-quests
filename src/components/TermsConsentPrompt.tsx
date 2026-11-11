// 이용약관 동의 창 (2026-11-11 대표님 「앱에서 동의 받기 (추천)」) — 규칙은 lib/termsConsent.
//   · 대상: 승인된 일반 회원 · 선릉역점 · 지금 판(GYM_POLICY_VERSION) 동의 기록이 없음
//     (데스크에서 등록해 앱 가입 신청서를 거치지 않은 회원 — 환불 · 지급 장비 · 홀딩 규정 동의 기록을 남기려고)
//   · 언제: 홈(/home · /myboxer)에서, 다른 창이 없을 때, 한 접속에 한 번 · '나중에'는 3일 뒤 다시
//   · 아이디·비밀번호 변경 창 · 전화번호 연동 창이 먼저 — 그 일이 남아 있으면 기다린다
//   · 앱 사용은 막지 않는다. 동의 = profiles.signup_agreements(판 · 문구 지문 · source app_prompt · 옛 기록 history) + signup_agreed_at
//   · 운영진 미리 보기: /home?terms=preview (저장 안 함)
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, ChevronDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { GYM_POLICIES } from "@/data/gymPolicies";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { isStaffProfile } from "@/lib/staffDisplay";
import {
  TERMS_PROMPT_ROUTES,
  TERMS_SNOOZE_MS,
  buildAgreementRecord,
  hasCurrentConsent,
  isTermsAudience,
  policyFingerprint,
  termsPromptDue,
  termsSessionKey,
  termsSnoozeKey,
} from "@/lib/termsConsent";

const SHOW_DELAY_MS = 2500; // 홈이 다 그려지고 다른 창(편지 · 환영)이 먼저 뜰 틈
const RETRY_MS = 4000;
const MAX_TRIES = 6; // 다른 창이 계속 열려 있으면 이번 접속은 넘긴다

const STAFF_ROLES = ["super_admin", "admin", "branch_manager", "coach"];

type ConsentProfile = {
  is_approved?: boolean | null;
  branch_name?: string | null;
  signup_agreements?: unknown;
  signup_agreed_at?: string | null;
  must_change_credentials?: boolean | null;
  phone_number?: string | null;
};

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, val: string) {
  try {
    window.localStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}
function ssGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function ssSet(key: string, val: string) {
  try {
    window.sessionStorage.setItem(key, val);
  } catch {
    /* ignore */
  }
}

/** 다른 창(편지 · 환영 · 시트)이 떠 있나 — 겹쳐 띄우지 않는다 */
function otherModalOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.body.style.overflow === "hidden" || !!document.querySelector('[aria-modal="true"]');
}

const TermsConsentPrompt = () => {
  const { user, profile, role, realRole, refreshProfile } = useAuth();
  const { pathname, search } = useLocation();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [agree, setAgree] = useState<Record<string, boolean>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const doneRef = useRef(false); // 이번 화면에서 이미 띄웠거나 넘김

  const p = profile as unknown as ConsentProfile | null;
  const uid = user?.id ?? null;
  const onHome = (TERMS_PROMPT_ROUTES as readonly string[]).includes(pathname);
  const audience =
    !!p &&
    isTermsAudience({
      isApproved: !!p.is_approved,
      role,
      realRole,
      isStaff: isStaffProfile(profile),
      branchName: p.branch_name,
    });
  const consented = hasCurrentConsent(p?.signup_agreements);
  const waitOther = !!p?.must_change_credentials || !(p?.phone_number ?? "").trim();
  const wantsPreview = onHome && new URLSearchParams(search).get("terms") === "preview";
  const staffish = isStaffProfile(profile) || STAFF_ROLES.includes(realRole ?? "");
  const allAgreed = GYM_POLICIES.every((x) => !x.required || agree[x.key]);

  // 운영진 미리 보기 — 회원에게 어떻게 보이는지 (저장 안 함)
  useEffect(() => {
    if (!wantsPreview || !uid || !staffish) return;
    setPreview(true);
    setAgree({});
    setOpenKey(null);
    setOpen(true);
  }, [wantsPreview, uid, staffish]);

  // 회원 — 조건이 맞으면 잠깐 기다렸다가, 다른 창이 없을 때 한 번
  useEffect(() => {
    if (doneRef.current || open || !uid || !audience || consented || !onHome || waitOther) return;
    const due = termsPromptDue({
      snoozedUntil: Number(lsGet(termsSnoozeKey(uid))) || null,
      shownThisSession: ssGet(termsSessionKey(uid)) === "1",
      now: Date.now(),
    });
    if (!due) return;
    let tries = 0;
    let timer = 0;
    const attempt = () => {
      if (otherModalOpen()) {
        tries += 1;
        if (tries < MAX_TRIES) timer = window.setTimeout(attempt, RETRY_MS);
        else doneRef.current = true;
        return;
      }
      doneRef.current = true;
      ssSet(termsSessionKey(uid), "1");
      setPreview(false);
      setAgree({});
      setOpenKey(null);
      setOpen(true);
    };
    timer = window.setTimeout(attempt, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [uid, audience, consented, onHome, waitOther, open]);

  const later = () => {
    if (!preview && uid) lsSet(termsSnoozeKey(uid), String(Date.now() + TERMS_SNOOZE_MS));
    setOpen(false);
  };
  useModalDismiss(open, later);

  const submit = async () => {
    if (!allAgreed || saving) return;
    if (preview || !uid) {
      toast("미리 보기라 저장하지 않았어요");
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const hash = await policyFingerprint();
      const record = buildAgreementRecord({
        agree: Object.fromEntries(GYM_POLICIES.map((x) => [x.key, !!agree[x.key]])),
        hash,
        source: "app_prompt",
        previous: p?.signup_agreements,
        previousAt: p?.signup_agreed_at ?? null,
      });
      const { error } = await supabase
        .from("profiles")
        .update({ signup_agreements: record, signup_agreed_at: new Date().toISOString() } as never)
        .eq("user_id", uid);
      if (error) throw error;
      await refreshProfile();
      toast.success("동의를 저장했어요. 감사합니다");
      setOpen(false);
    } catch (e) {
      console.error("[TermsConsentPrompt] 동의 저장 실패:", e);
      toast.error("저장하지 못했어요. 잠시 후 다시 눌러 주세요.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const setAll = (v: boolean) => setAgree(Object.fromEntries(GYM_POLICIES.map((x) => [x.key, v])));

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 px-4 pb-4 pt-10 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-consent-title"
        className="flex max-h-[86vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elev-3"
      >
        <div className="overflow-y-auto p-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <h2 id="terms-consent-title" className="text-heading font-bold text-foreground">
              이용약관 확인
            </h2>
          </div>
          <p className="mb-4 text-label leading-relaxed text-muted-foreground">
            환불 · 지급 장비 · 홀딩 규정을 앱에 정리했어요. 읽어 보시고 동의해 주세요.
          </p>
          {preview && (
            <p className="mb-3 rounded-lg bg-muted px-3 py-2 text-label font-bold text-foreground">
              운영진 미리 보기 — 저장하지 않아요
            </p>
          )}

          <button
            type="button"
            onClick={() => setAll(!allAgreed)}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-3 text-body font-bold transition-all active:scale-[0.99] ${
              allAgreed ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"
            }`}
          >
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-md ${
                allAgreed ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}
            >
              {allAgreed && <Check className="h-3.5 w-3.5" />}
            </span>
            전체 동의
          </button>

          <div className="mt-2.5 space-y-2.5">
            {GYM_POLICIES.map((x) => {
              const on = !!agree[x.key];
              const expanded = openKey === x.key;
              return (
                <div key={x.key} className="rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      aria-label={`${x.title} 동의`}
                      aria-pressed={on}
                      onClick={() => setAgree((a) => ({ ...a, [x.key]: !on }))}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                        on ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenKey(expanded ? null : x.key)}
                      className="flex flex-1 items-center justify-between gap-2 text-left"
                    >
                      <span className="text-body font-semibold text-foreground">{x.title}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>
                  {expanded && (
                    <p className="whitespace-pre-line border-t border-border px-3 py-3 text-label leading-relaxed text-muted-foreground">
                      {x.body}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2 border-t border-border p-4 safe-area-bottom">
          <button
            type="button"
            onClick={later}
            className="flex-1 rounded-xl border border-border py-3 text-body font-medium text-muted-foreground transition-all active:scale-[0.98]"
          >
            나중에
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!allAgreed || saving}
            className="flex-1 rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "저장 중..." : "동의하기"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsConsentPrompt;
