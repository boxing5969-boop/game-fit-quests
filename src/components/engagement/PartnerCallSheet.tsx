/**
 * 오늘 같이 해요 (운동 모집) — 시트.
 *
 * 규약 (CornermanSheet 와 동일): z-[100] / role='dialog' / aria-modal / useModalDismiss.
 *
 * 2026-10-28 1단계 (대표님 "추천대로가자" — 「마이복서153 운동 모집 업그레이드 보고서」):
 *   · 모집 카드에 올린 사람 사진 · 이름(닉네임, 없으면 이름) · 레벨 · 코치 표시 — 누르면 회원 카드
 *   · 저요한 사람 얼굴 · 이름 — 내 모집이면 한 사람씩 '메시지'(1:1 메시지)로 몇 시에 어디서 만날지 정한다
 *   · 저요를 누르면 올린 사람에게 알림이 간다(서버 join_partner_call)
 *   · 올리기: 종류 두 개(미트 · 같이 운동) · 시간은 내가 평소 오는 시간 앞뒤 칩 + '다른 시간' · 한 줄(선택)
 *     스파링은 코치님 · 운영진만(서버도 막는다) · 닉네임이 없으면 처음 한 번 정하고 올린다
 *   · 올리기 칸은 접어 두고 '모집 올리기' 단추 하나 — 모집이 있으면 '지금 운동 중인 동료'는 목록 아래로
 *
 * 2단계 (미리보기 preview/partner-call — v2 함수):
 *   · '지금' 모집 — 체육관에 있으면(3시간 안 출석) '지금' 칩이 먼저, 30분 동안만 보인다 (남은 분 표시)
 *   · 코치님 · 운영진 모집 정원(제한 없음 · 4 · 6 · 8명) — 다 차면 '마감'
 *   · 운동 시간이 되면 올린 사람 · 저요한 사람에게 '같이 했어요' — 둘 다 누르면 서로 153 + 각자 챔피언 머니 +30(하루 1번)
 *   · 지난 모집 · 끝난 '지금' 모집에는 저요가 없다 (서버 join_partner_call_v2 도 막는다)
 *   · 우리 지점에 모집이 5개 올라올 때까지 '이렇게 올려 보세요' 예시(점선 · '예시' 표시 · 이름 없음) — 누르면 올리기 칸이 채워진다
 *     (2026-10-28 대표님 "게시물5개 올라올때까지는 다양한 예시 넣어놓자", src/lib/partnerCallExamples.ts)
 *
 * 안전 규칙: 하루에 한 사람이 한 건만(DB unique) — 다시 올리면 바뀐다. 지점 격리는 서버가 한다.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { usePartnerCallActions, usePartnerCalls } from "@/hooks/useCommunityHub";
import NicknameEditSheet from "@/components/license/NicknameEditSheet";
import { openMemberCard } from "@/lib/appEvents";
import { defaultHour, formatHour, hourChips, kstHour, laterHours } from "@/lib/partnerCallTime";
import { examplesFor, showPartnerExamples, type PartnerCallExample } from "@/lib/partnerCallExamples";
import WorkingOutNowCard from "./WorkingOutNow";
import {
  MEMBER_PURPOSES,
  PURPOSE_LABEL,
  STAFF_PURPOSES,
  shortBranchName,
  type PartnerCall,
  type PartnerPurpose,
} from "@/services/communityHubService";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 커뮤니티 맨 위 카드의 예시에서 열었으면 올리기 칸을 그 내용으로 채워 연다 */
  example?: PartnerCallExample | null;
}

/** 사진 — 없으면 이름 첫 글자 (커뮤니티 맨 위 모집 카드도 같이 쓴다) */
export const PartnerFace = ({ name, url, size = 44, ring = false }: { name: string; url?: string | null; size?: number; ring?: boolean }) => (
  <span
    className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-black text-muted-foreground ${
      ring ? "ring-2 ring-card" : ""
    }`}
    style={{ width: size, height: size }}
  >
    {url ? (
      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
    ) : (
      <span className={size >= 36 ? "text-body" : "text-micro"}>{name.slice(0, 1)}</span>
    )}
  </span>
);

const PartnerCallSheet = ({ open, onClose, example = null }: Props) => {
  useModalDismiss(open, onClose);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data, isLoading } = usePartnerCalls(open);
  const { create, join, leave, close, done } = usePartnerCallActions();

  const calls = data?.calls ?? [];
  const mine = calls.find((c) => c.isMine);
  // 운영진(전 지점 보기): 전 지점 모집을 본다 — 저요는 서버가 같은 지점만 받는다 (2026-09-30)
  const allBranches = data?.all_branches === true;
  const myBranch = data?.branch ?? null;
  const purposes = data?.canSpar ? STAFF_PURPOSES : MEMBER_PURPOSES;
  // 닉네임이 없으면 처음 한 번 정하고 올린다 — 방금 정했으면(프로필에 들어왔으면) 다시 묻지 않는다
  const needsNick = !!data?.needsNickname && !(profile?.nickname ?? "").trim();

  const [formOpen, setFormOpen] = useState(false);
  const [purpose, setPurpose] = useState<PartnerPurpose>("mitt");
  const [hour, setHour] = useState<number | null>(null);
  const [otherOpen, setOtherOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [nickOpen, setNickOpen] = useState(false);
  const postAfterNick = useRef(false);
  // 2단계: '지금' 모집(30분) · 코치님 모집 정원
  const [nowPick, setNowPick] = useState(false);
  const [capacity, setCapacity] = useState<number | null>(null);
  // '지금' 모집 남은 시간이 흐르게 — 시트가 열려 있는 동안 30초마다 다시 그린다
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, [open]);

  const now = kstHour();
  const formRef = useRef<HTMLDivElement>(null);
  // 예시 — 우리 지점 모집이 5개가 될 때까지, 내 모집이 없을 때만
  const examplesOn = showPartnerExamples(data?.branchPosts) && !mine;

  /** 예시를 누르면 올리기 칸을 그 내용으로 채운다 — 올리는 것은 본인이 '모집 올리기'를 눌러야 */
  const applyExample = (ex: PartnerCallExample) => {
    const t = kstHour();
    setPurpose(ex.purpose);
    setNote(ex.note);
    setOtherOpen(false);
    if (ex.hour == null && data?.atGym) {
      setNowPick(true);
    } else {
      setNowPick(false);
      setHour(ex.hour != null && laterHours(t).includes(ex.hour) ? ex.hour : defaultHour(data?.usualHour, t));
    }
    setFormOpen(true);
    window.requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  // 시트를 열 때마다 처음 값 — 내 모집이 있으면 그 값, 없으면 미트 · (체육관에 있으면 '지금', 아니면 평소 시간)
  // 커뮤니티 맨 위 카드의 예시로 열었으면 그 예시로 채운다
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      seededFor.current = null;
      setFormOpen(false);
      setOtherOpen(false);
      return;
    }
    const key = `${mine?.id ?? "none"}:${example?.id ?? ""}`;
    if (!data || seededFor.current === key) return;
    seededFor.current = key;
    setPurpose(mine && purposes.includes(mine.purpose) ? mine.purpose : "mitt");
    setHour(mine ? mine.slotHour : defaultHour(data.usualHour, kstHour()));
    setNowPick(mine ? !!mine.isNow : !!data.atGym);
    setCapacity(mine?.capacity ?? null);
    setNote(mine?.note ?? "");
    if (example && !mine) applyExample(example);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data, mine, purposes, example]);

  const chips = useMemo(() => {
    const base = hourChips(data?.usualHour, now);
    return hour != null && !base.includes(hour) ? [...base, hour].sort((a, b) => a - b) : base;
  }, [data?.usualHour, now, hour]);

  const run = async (fn: () => Promise<unknown>, id: string, fail: string) => {
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fail);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    if (!nowPick && hour == null) {
      toast.error("오늘은 모집할 수 있는 시간이 지났어요");
      return;
    }
    if (needsNick) {
      postAfterNick.current = true;
      setNickOpen(true);
      return;
    }
    try {
      await create.mutateAsync({
        purpose,
        slotHour: nowPick ? kstHour() : (hour as number),
        note: note.trim() || null,
        now: nowPick,
        capacity: data?.canCapacity ? capacity : null,
      });
      toast.success(nowPick ? "지금 모집을 올렸어요 — 30분 동안 보여요" : mine ? "모집을 바꿨어요" : "모집을 올렸어요");
      setFormOpen(false);
      setOtherOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "모집을 올리지 못했어요");
    }
  };

  // 닉네임을 정하고 창을 닫으면 그대로 올린다 (안 정하고 닫았으면 아무것도 안 한다)
  useEffect(() => {
    if (nickOpen || !postAfterNick.current) return;
    postAfterNick.current = false;
    if ((profile?.nickname ?? "").trim()) void handleCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nickOpen, profile?.nickname]);

  const openMessage = (userId: string) => {
    onClose();
    navigate(`/messages/to/${userId}`);
  };

  const renderAction = (c: PartnerCall) => {
    const base =
      "inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-pill px-4 text-label font-bold active:scale-95 disabled:opacity-60";
    if (c.isMine) {
      return (
        <button
          type="button"
          disabled={busyId === c.id}
          onClick={() => run(() => close.mutateAsync(c.id), c.id, "모집을 내리지 못했어요")}
          className={`${base} border border-border text-muted-foreground`}
        >
          내리기
        </button>
      );
    }
    // 운영진 전 지점 보기 — 다른 지점 모집에는 저요가 없다
    if (allBranches && c.branch && c.branch !== myBranch) return null;
    if (c.joined) {
      // 운동이 시작된 뒤에는 취소 대신 아래 '같이 했어요'
      if (c.started) return null;
      return (
        <button
          type="button"
          disabled={busyId === c.id}
          onClick={() => run(() => leave.mutateAsync(c.id), c.id, "취소하지 못했어요")}
          className={`${base} border border-border text-muted-foreground`}
        >
          참여 취소
        </button>
      );
    }
    // 지난 모집 · 끝난 '지금' 모집에는 저요가 없다
    if (c.joinable === false) return null;
    if (c.full) {
      return (
        <button type="button" disabled className={`${base} border border-border text-muted-foreground`}>
          마감
        </button>
      );
    }
    return (
      <button
        type="button"
        disabled={busyId === c.id}
        onClick={() =>
          run(async () => {
            await join.mutateAsync(c.id);
            toast.success(c.isNow ? "저요 했어요 — 지금 체육관에서 만나요" : `저요 했어요 — ${formatHour(c.slotHour)}에 만나요`);
          }, c.id, "참여하지 못했어요")
        }
        className={`${base} bg-primary text-primary-foreground`}
      >
        저요
      </button>
    );
  };

  const renderJoiners = (c: PartnerCall) => {
    const people = c.joiners ?? [];
    if (c.joinCount === 0) {
      return c.isMine ? <p className="mt-3 text-label text-muted-foreground">아직 저요가 없어요</p> : null;
    }
    const count = c.capacity ? `${c.joinCount}/${c.capacity}명` : `${c.joinCount}명`;
    // 내 모집 — 한 사람씩 이름과 메시지 단추
    if (c.isMine && people.length > 0) {
      return (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-label font-bold text-foreground">저요한 사람 {count}</p>
          <ul className="mt-2 space-y-2">
            {people.map((p) => (
              <li key={p.userId} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => openMemberCard(p.userId)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <PartnerFace name={p.nickname} url={p.avatarUrl} size={36} />
                  <span className="truncate text-body font-semibold text-foreground">{p.nickname}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openMessage(p.userId)}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-pill border border-primary/40 px-3.5 text-label font-bold text-primary active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" />
                  메시지
                </button>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    // 남의 모집 — 얼굴 겹쳐 세 명까지 + 몇 명
    const shown = people.slice(0, 3);
    return (
      <div className="mt-3 flex items-center gap-2.5 border-t border-border pt-3">
        {shown.length > 0 && (
          <span className="flex -space-x-2">
            {shown.map((p) => (
              <button
                key={p.userId}
                type="button"
                onClick={() => openMemberCard(p.userId)}
                className="rounded-full"
                aria-label={`${p.nickname} 회원 카드`}
              >
                <PartnerFace name={p.nickname} url={p.avatarUrl} size={30} ring />
              </button>
            ))}
          </span>
        )}
        <span className="min-w-0 truncate text-label font-semibold text-foreground">
          {shown.length === 1 && c.joinCount === 1 && !c.capacity ? `${shown[0].nickname}님 저요` : `${count} 저요`}
          {c.joined && <span className="font-normal text-muted-foreground"> · 나도</span>}
        </span>
      </div>
    );
  };

  /** '같이 했어요' (2단계) — 운동 시간이 된 뒤 올린 사람 · 저요한 사람에게 */
  const renderDone = (c: PartnerCall) => {
    if (!(c.isMine || c.joined) || c.joinCount === 0 || !c.started) return null;
    if (c.myDone) {
      const paired = (c.pairs ?? 0) > 0 && (c.isMine || (c.userId != null && (c.doneUsers ?? []).includes(c.userId)));
      return (
        <p className="mt-3 border-t border-border pt-3 text-label font-bold text-primary">
          같이 했어요{paired ? " — 서로 153을 보냈어요" : " — 상대가 누르면 서로 153이 가요"}
        </p>
      );
    }
    return (
      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
        <span className="min-w-0 flex-1 text-label text-muted-foreground">둘 다 누르면 서로 153 · 머니 +30</span>
        <button
          type="button"
          disabled={busyId === `done:${c.id}`}
          onClick={() =>
            run(async () => {
              const r = await done.mutateAsync(c.id);
              if ((r.paired ?? 0) > 0) {
                toast.success(r.reward ? "같이 운동 완료! 서로 153 · 챔피언 머니 +30" : "같이 운동 완료! 서로 153을 보냈어요");
              } else {
                toast.success("기록했어요 — 상대도 누르면 서로 153이 가요");
              }
            }, `done:${c.id}`, "기록하지 못했어요")
          }
          className="inline-flex min-h-[40px] shrink-0 items-center rounded-pill bg-primary px-4 text-label font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
        >
          같이 했어요
        </button>
      </div>
    );
  };

  /** '지금' 모집 남은 분 — 끝났으면 0 */
  const minutesLeft = (c: PartnerCall) =>
    c.expiresAt ? Math.max(0, Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / 60_000)) : 0;

  const renderCall = (c: PartnerCall) => {
    const canOpenCard = !c.isMine && !!c.userId;
    return (
      <div key={c.id} className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canOpenCard}
            onClick={() => canOpenCard && openMemberCard(c.userId)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
            aria-label={canOpenCard ? `${c.nickname} 회원 카드` : undefined}
          >
            <PartnerFace name={c.nickname} url={c.avatarUrl} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-body font-bold text-foreground">{c.isMine ? "내 모집" : c.nickname}</span>
                {c.isStaff ? (
                  <span className="shrink-0 rounded-pill bg-primary/10 px-2 py-0.5 text-micro font-bold text-primary">
                    {c.staffTitle || "코치"}
                  </span>
                ) : c.level ? (
                  <span className="number-font shrink-0 text-label text-muted-foreground">Lv.{c.level}</span>
                ) : null}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-label font-semibold text-muted-foreground">
                {c.isNow && (
                  <span className="shrink-0 rounded-pill bg-primary px-2 py-0.5 text-micro font-bold text-primary-foreground">지금</span>
                )}
                <span className="truncate">
                  {c.isNow
                    ? `${PURPOSE_LABEL[c.purpose]} · ${minutesLeft(c) > 0 ? `${minutesLeft(c)}분 남음` : "끝남"}`
                    : `${formatHour(c.slotHour)} · ${PURPOSE_LABEL[c.purpose]}`}
                  {allBranches && c.branch ? ` · ${shortBranchName(c.branch)}` : ""}
                </span>
              </span>
            </span>
          </button>
          {renderAction(c)}
        </div>
        {c.note && <p className="mt-3 line-clamp-2 text-body text-foreground">“{c.note}”</p>}
        {renderJoiners(c)}
        {renderDone(c)}
      </div>
    );
  };

  const working = (
    <WorkingOutNowCard
      branch={null}
      title="지금 운동 중인 동료"
      emptyText="지금은 운동 중인 동료가 없어요. 모집을 올리면 오늘 오는 동료가 볼 수 있어요"
      onOpenMember={(m) => openMemberCard(m.id)}
    />
  );

  const submitLabel = create.isPending
    ? "올리는 중…"
    : needsNick
      ? "닉네임 정하고 올리기"
      : mine
        ? "모집 바꾸기"
        : "모집 올리기";

  const renderForm = () => {
    if (!formOpen) {
      return (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground active:scale-[0.99]"
        >
          {mine ? "내 모집 바꾸기" : "모집 올리기"}
        </button>
      );
    }
    const chipCls = (on: boolean) =>
      `min-h-[40px] rounded-pill border px-4 text-label font-bold transition-colors ${
        on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
      }`;
    return (
      <div ref={formRef} className="rounded-2xl border border-border bg-muted/20 p-4">
        <p className="text-label font-bold text-foreground">무엇을 함께 하나요</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {purposes.map((p) => (
            <button key={p} type="button" onClick={() => setPurpose(p)} className={chipCls(purpose === p)}>
              {PURPOSE_LABEL[p]}
            </button>
          ))}
        </div>

        <p className="mt-4 text-label font-bold text-foreground">몇 시에 오시나요</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {/* 체육관에 있으면(3시간 안 출석) '지금' — 30분 동안만 보이는 모집 (2단계) */}
          {(data?.atGym || nowPick) && (
            <button type="button" onClick={() => setNowPick(true)} className={chipCls(nowPick)}>
              지금
            </button>
          )}
          {chips.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => {
                setNowPick(false);
                setHour(h);
              }}
              className={chipCls(!nowPick && hour === h)}
            >
              {formatHour(h)}
            </button>
          ))}
          <button type="button" onClick={() => setOtherOpen((v) => !v)} className={chipCls(otherOpen)}>
            다른 시간
          </button>
        </div>
        {nowPick && <p className="mt-2 text-label text-muted-foreground">지금 체육관에 있는 동료에게 30분 동안 보여요</p>}
        {otherOpen && (
          <select
            value={hour ?? ""}
            onChange={(e) => {
              setNowPick(false);
              setHour(Number(e.target.value));
            }}
            className="mt-2 h-12 w-full rounded-xl border border-border bg-card px-3 text-body font-bold text-foreground"
            aria-label="시간 고르기"
          >
            {laterHours(now).map((h) => (
              <option key={h} value={h}>
                {formatHour(h)}
              </option>
            ))}
          </select>
        )}

        {/* 코치님 · 운영진 모집 정원 (2단계) — 다 차면 '마감' */}
        {data?.canCapacity && (
          <>
            <p className="mt-4 text-label font-bold text-foreground">몇 명까지 받을까요</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[null, 4, 6, 8].map((n) => (
                <button key={n ?? "none"} type="button" onClick={() => setCapacity(n)} className={chipCls(capacity === n)}>
                  {n == null ? "제한 없음" : `${n}명`}
                </button>
              ))}
            </div>
          </>
        )}

        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 120))}
          placeholder="한 줄 (예: 3라운드만 미트 부탁드려요)"
          className="mt-4 h-12 w-full rounded-xl border border-border bg-card px-3 text-body text-foreground placeholder:text-muted-foreground"
          aria-label="한 줄"
        />

        {needsNick && (
          <p className="mt-3 text-label text-muted-foreground">모집에는 닉네임이 보여요 — 처음 한 번만 정해 주세요</p>
        )}
        <button
          type="button"
          onClick={handleCreate}
          disabled={create.isPending || (!nowPick && hour == null)}
          className="mt-3 h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    );
  };

  /** '이렇게 올려 보세요' 예시 — 점선 · '예시' 표시 · 이름 없음, 누르면 올리기 칸이 채워진다 */
  const renderExamples = (n: number) => (
    <div>
      <p className="text-label font-bold text-foreground">이렇게 올려 보세요</p>
      <div className="mt-2 space-y-2">
        {examplesFor(n, { now, atGym: !!data?.atGym }).map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => applyExample(ex)}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-3 text-left active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="shrink-0 rounded-pill border border-border bg-card px-2 py-0.5 text-micro font-bold text-muted-foreground">
                  예시
                </span>
                <span className="truncate text-label font-semibold text-muted-foreground">
                  {ex.hour == null ? "지금" : formatHour(ex.hour)} · {PURPOSE_LABEL[ex.purpose]}
                </span>
              </span>
              <span className="mt-1 block text-body text-foreground">“{ex.note}”</span>
            </span>
            <span className="shrink-0 text-label font-bold text-primary">쓰기</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderBody = () => {
    if (isLoading) {
      return <p className="py-8 text-center text-label text-muted-foreground">불러오는 중…</p>;
    }
    if (calls.length === 0) {
      // 우리 지점 모집이 5개가 될 때까지 — 빈 칸 대신 예시 (2026-10-28 대표님)
      if (examplesOn) {
        return (
          <>
            <p className="mb-3 text-body font-bold text-foreground">아직 오늘 모집이 없어요</p>
            <div className="mb-4">{renderExamples(4)}</div>
            {renderForm()}
            <div className="mt-5">{working}</div>
          </>
        );
      }
      return (
        <>
          <div className="mb-4">{working}</div>
          <div className="mb-4 rounded-2xl border border-border bg-muted/20 px-4 py-6 text-center">
            <p className="text-body font-bold text-foreground">아직 오늘 모집이 없어요</p>
            <p className="mt-1 text-label text-muted-foreground">
              {allBranches ? "전 지점에 오늘 올라온 모집이 없어요" : "첫 모집을 올리면 같은 지점 동료가 볼 수 있어요"}
            </p>
          </div>
          {renderForm()}
        </>
      );
    }
    return (
      <>
        <div className="space-y-3">{calls.map(renderCall)}</div>
        {examplesOn && <div className="mt-5">{renderExamples(3)}</div>}
        <div className="mt-4">{renderForm()}</div>
        <div className="mt-5">{working}</div>
      </>
    );
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="오늘 같이 해요"
              className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-heading font-bold text-foreground">오늘 같이 해요</h2>
                  <p className="mt-0.5 text-label text-muted-foreground">
                    {allBranches ? "전 지점 · 저요는 같은 지점끼리" : "같은 지점 · 오늘만 보여요"}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                  aria-label="닫기"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">{renderBody()}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <NicknameEditSheet open={nickOpen} onClose={() => setNickOpen(false)} />
    </>
  );
};

export default PartnerCallSheet;
