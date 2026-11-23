/**
 * 설정 › 「엄마 · 아빠 연결」 — 회원이 보호자에게 링크를 보낸다 (2026-11-23 대표님 「추천대로」).
 *
 * 링크 만들기(서버 · 7일 · 한 번) → 「카톡으로 보내기」(휴대폰 공유 창은 누른 순간에만 열려서 두 번에 나눈다) · 「링크 복사」.
 * 연결된 보호자 목록 · 데스크에서 온 요청 수락 · 끊기(성인 회원만 — 미성년 · 나이를 모르면 데스크에서).
 * 서버에 함수가 없거나 보호자 기능이 꺼져 있으면 카드를 안 그린다. 지도진 계정도 안 그린다(서버 is_member=false).
 * 예시: /settings?guardiandemo=1 (서버를 안 부른다).
 */
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, Copy, HeartHandshake, Send, X } from "lucide-react";
import { copyText } from "@/lib/appInvite";
import { useAuth } from "@/contexts/AuthContext";
import {
  RELATION_LABEL,
  guardianInviteUrl,
  guardianShareText,
  type GuardianLinkRow,
  type GuardianState,
} from "@/lib/guardian";
import { createGuardianInvite, guardianDemo, useGuardianActions, useMyGuardianState, type InviteMade } from "@/services/guardianService";

const DEMO_STATE: GuardianState = {
  on: true,
  isMember: true,
  guardianAccount: false,
  kids: 0,
  minor: true,
  links: [{ id: "demo-1", relation: "mom", status: "active", via: "child_invite", name: "민준 엄마", since: "2026-11-20" }],
  hasGuardian: true,
  canUnlink: false,
  prompt: true,
  promptMin: 50,
  promptMaxMin: 180,
  snoozeMin: 20,
};

const SUB_BTN =
  "flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-body font-bold text-foreground transition-all hover:bg-muted active:scale-[0.98] disabled:opacity-60";

const sinceText = (d: string | null) => (d ? `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일부터` : null);

const GuardianLinkCard = () => {
  const demo = guardianDemo("guardiandemo");
  const { profile } = useAuth();
  const { data } = useMyGuardianState(!demo);
  const { respond, unlink } = useGuardianActions();
  const [params] = useSearchParams();
  const cardRef = useRef<HTMLDivElement>(null);
  const [made, setMade] = useState<InviteMade | null>(null);
  const [making, setMaking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);

  const state = demo ? DEMO_STATE : data?.available ? data.state : null;
  const show = !!state && state.on && state.isMember;

  // 알림(/settings?guardian=1)으로 왔으면 이 카드로
  useEffect(() => {
    if (!show || params.get("guardian") !== "1") return;
    const t = window.setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    return () => window.clearTimeout(t);
  }, [show, params]);

  if (!show || !state) return null;

  const myName = profile?.name?.trim() || "저";
  const url = made ? guardianInviteUrl(made.token, typeof window !== "undefined" ? window.location.origin : undefined) : "";

  const make = async () => {
    if (making) return;
    if (demo) {
      setMade({ token: "0123456789abcdef0123456789abcdef", expiresAt: null, name: myName });
      return;
    }
    setMaking(true);
    try {
      setMade(await createGuardianInvite());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "링크를 만들지 못했어요");
    } finally {
      setMaking(false);
    }
  };

  const share = async () => {
    if (!made) return;
    const text = guardianShareText(made.name || myName);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "마이복서153 보호자 연결", text, url });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    // 공유 창이 없는 화면(일부 컴퓨터 · 앱 안 브라우저) — 글과 링크를 복사
    if (await copyText(`${text}\n${url}`)) toast.success("글과 링크를 복사했어요 · 카톡에 붙여 넣어 주세요");
    else toast.error("복사하지 못했어요 · 링크 복사를 눌러 주세요");
  };

  const copy = async () => {
    if (!made) return;
    if (await copyText(url)) toast.success("링크를 복사했어요");
    else toast.error("복사하지 못했어요");
  };

  const doRespond = (link: GuardianLinkRow, accept: boolean) => {
    if (demo) return;
    respond.mutate(
      { linkId: link.id, accept },
      {
        onSuccess: () => toast.success(accept ? `${RELATION_LABEL[link.relation]}와 연결됐어요` : "요청을 거절했어요"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "처리하지 못했어요"),
      },
    );
  };

  const doUnlink = (link: GuardianLinkRow) => {
    if (confirmUnlink !== link.id) {
      setConfirmUnlink(link.id);
      return;
    }
    setConfirmUnlink(null);
    if (demo) return;
    unlink.mutate(link.id, {
      onSuccess: () => toast.success("연결을 끊었어요"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "연결을 끊지 못했어요"),
    });
  };

  const pending = state.links.filter((l) => l.status === "pending");
  const active = state.links.filter((l) => l.status === "active");

  return (
    <div ref={cardRef} className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HeartHandshake className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-bold text-foreground">엄마 · 아빠 연결</h2>
          <p className="mt-0.5 text-label text-muted-foreground [text-wrap:pretty]">
            연결하면 체육관에 온 시각과 운동이 끝난 시각이 보호자 휴대폰에 알림으로 가요. 메시지 · 글 · 몸무게는 안 보여요.
          </p>
        </div>
      </div>

      {pending.length > 0 && (
        <ul className="mt-4 space-y-2" aria-label="연결 요청">
          {pending.map((l) => (
            <li key={l.id} className="rounded-xl bg-primary/5 p-3">
              <p className="text-body font-bold text-foreground">
                {RELATION_LABEL[l.relation]} · {l.name}님이 연결을 요청했어요
              </p>
              <p className="mt-0.5 text-label text-muted-foreground">데스크에서 받은 QR로 들어온 요청이에요</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => doRespond(l, false)} disabled={respond.isPending} className={SUB_BTN}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  거절
                </button>
                <button
                  type="button"
                  onClick={() => doRespond(l, true)}
                  disabled={respond.isPending}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  수락
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {active.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border" aria-label="연결된 보호자">
          {active.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-body font-bold text-foreground">
                  {RELATION_LABEL[l.relation]} · {l.name}
                </p>
                {sinceText(l.since) && <p className="text-label text-muted-foreground">{sinceText(l.since)}</p>}
              </div>
              {state.canUnlink ? (
                <button
                  type="button"
                  onClick={() => doUnlink(l)}
                  disabled={unlink.isPending}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-label font-bold transition-all active:scale-95 disabled:opacity-60 ${
                    confirmUnlink === l.id ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {confirmUnlink === l.id ? "한 번 더 누르면 끊겨요" : "연결 끊기"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {active.length > 0 && !state.canUnlink && (
        <p className="mt-2 text-label text-muted-foreground">연결을 끊으려면 데스크에 말씀해 주세요.</p>
      )}

      {!made ? (
        <button
          type="button"
          onClick={() => void make()}
          disabled={making}
          className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-body font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {making ? "링크 만드는 중" : active.length > 0 ? "다른 보호자에게 링크 보내기" : "엄마 · 아빠에게 연결 링크 보내기"}
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-muted/60 p-3">
          <p className="text-body font-bold text-foreground">링크가 만들어졌어요</p>
          <p className="mt-0.5 text-label text-muted-foreground">
            엄마 · 아빠가 열고 카카오로 시작하면 연결돼요. 7일 동안 한 분만 쓸 수 있어요.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void copy()} className={SUB_BTN}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              링크 복사
            </button>
            <button
              type="button"
              onClick={() => void share()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-body font-bold text-primary-foreground transition-all active:scale-[0.98]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              카톡으로 보내기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardianLinkCard;
