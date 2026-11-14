/**
 * 💬 카드 시트 아래 반응 칸 — 영상으로 배우기 3단계 (2026-11-15 대표님 「3단계시작」)
 *
 *   회원님: 제목 옆 ♥(숫자는 5명 넘을 때만) · 「이 동작, 어땠어요?」 쉬워요 · 딱 좋아요 · 어려워요 ·
 *           「코치님께 의견 보내기」(그 지점 코치님 · 대표님만 봐요) · 보낸 의견과 코치님 답 · 영상 없는 카드는 「영상 찍어 주세요」
 *   코치진: 「회원 반응」 숫자(0인 칸은 빼고) · 회원님 의견(이름 · 답 남기기 · 내가 단 답은 고치기)
 *   감정 설계: 내 말이 수업을 바꾼다는 존중 · 작은 숫자는 숨김 · 코치님 답이 감 · 못한 것은 말하지 않는다
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Clapperboard, Heart, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { noteWhen } from "@/lib/myClass";
import {
  FEELS,
  OPINION_MAX,
  countChips,
  hardPercent,
  heartCountText,
  opinionError,
  replyError,
  type CardOpinion,
  type CardSocial,
  type Feel,
  type StaffOpinion,
} from "@/lib/cardReact";
import { useCardReactActions } from "@/services/cardReactService";

/* ───────── ♥ (회원님 · 제목 옆) ───────── */

export function CardHeartButton({ item, social }: { item: string; social: CardSocial }) {
  const actions = useCardReactActions();
  const on = social.me.heart;
  const count = heartCountText(social.hearts);
  const toggle = () => {
    actions.react(item, { heart: !on }).catch((e: Error) => toast.error(e.message));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "좋아요 취소" : "좋아요"}
      className={cn(
        "flex h-11 min-w-[2.75rem] shrink-0 items-center justify-center gap-1 rounded-full border px-3 transition-all active:scale-90",
        on ? "border-rose-200 bg-rose-50 text-rose-500" : "border-border bg-card text-muted-foreground",
      )}
    >
      <Heart className={cn("h-5 w-5", on && "fill-current")} aria-hidden />
      {count && <span className="text-label font-bold">{count}</span>}
    </button>
  );
}

/* ───────── 칸 하나 (회원님 / 코치진) ───────── */

export function CardReactSection({ item, social, noVideo }: { item: string; social: CardSocial; noVideo: boolean }) {
  return social.viewer === "staff" && social.staff ? (
    <StaffReact item={item} staff={social.staff} />
  ) : (
    <MemberReact item={item} social={social} noVideo={noVideo} />
  );
}

/* ───────── 회원님 ───────── */

function MemberReact({ item, social, noVideo }: { item: string; social: CardSocial; noVideo: boolean }) {
  const actions = useCardReactActions();
  const [compose, setCompose] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { me, opinions } = social;

  // 답을 보면 읽음 — 한 번만
  const seenRef = useRef<string | null>(null);
  const unseen = opinions.some((o) => o.reply && !o.seen);
  useEffect(() => {
    if (!unseen || seenRef.current === item) return;
    seenRef.current = item;
    void actions.seen(item).catch(() => undefined);
  }, [unseen, item, actions]);

  const pickFeel = (f: Feel) => {
    actions.react(item, { feel: me.feel === f ? null : f }).catch((e: Error) => toast.error(e.message));
  };

  const send = async () => {
    const err = opinionError(text);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      await actions.opinion(item, text.trim());
      setText("");
      setCompose(false);
      toast.success("코치님께 보냈어요", { description: "답이 오면 알려 드릴게요" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const askFilm = async () => {
    try {
      await actions.askFilm({ item });
      toast.success("요청했어요", { description: "많이 요청한 동작부터 찍어요" });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section aria-label="반응" className="mt-5 space-y-3 border-t border-border pt-5">
      <p className="text-body font-black text-foreground">이 동작, 어땠어요?</p>
      <div role="radiogroup" aria-label="이 동작, 어땠어요?" className="grid grid-cols-3 gap-2">
        {FEELS.map((f) => {
          const on = me.feel === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pickFeel(f.id)}
              className={cn(
                "h-11 rounded-2xl border text-body font-bold transition-all active:scale-95",
                on ? "border-transparent bg-foreground text-background" : "border-border bg-card text-foreground",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      {me.feel && <p className="text-label text-muted-foreground">고마워요 — 코치님이 수업 때 참고해요</p>}

      {compose ? (
        <div className="rounded-2xl border border-border bg-card p-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, OPINION_MAX))}
            rows={3}
            autoFocus
            aria-label="코치님께 의견"
            placeholder="예: 발 순서가 헷갈려요 · 천천히 하는 영상도 보고 싶어요"
            className="w-full resize-none bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="min-w-0 text-label text-muted-foreground">그 지점 코치님 · 대표님만 봐요</span>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCompose(false);
                  setText("");
                }}
                className="h-10 rounded-full px-3 text-label font-bold text-muted-foreground active:scale-95"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={busy || !text.trim()}
                className="h-10 rounded-full bg-primary px-4 text-label font-bold text-primary-foreground active:scale-95 disabled:opacity-50"
              >
                보내기
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCompose(true)}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-body font-bold text-foreground transition-all active:scale-[0.98]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> 코치님께 의견 보내기
        </button>
      )}

      {opinions.length > 0 && (
        <ul className="space-y-2">
          {opinions.map((o) => (
            <MyOpinion key={o.id} o={o} item={item} />
          ))}
        </ul>
      )}

      {noVideo &&
        (me.asked ? (
          <p className="flex items-center justify-center gap-1.5 rounded-2xl bg-secondary px-4 py-3 text-label font-bold text-foreground">
            <Check className="h-4 w-4 text-primary" strokeWidth={3} aria-hidden /> 영상 요청했어요 · 많이 요청한 동작부터 찍어요
          </p>
        ) : (
          <button
            type="button"
            onClick={() => void askFilm()}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-secondary text-body font-bold text-foreground transition-all active:scale-[0.98]"
          >
            <Clapperboard className="h-4 w-4" aria-hidden /> 이 동작 영상 찍어 주세요
          </button>
        ))}
    </section>
  );
}

function MyOpinion({ o, item }: { o: CardOpinion; item: string }) {
  const actions = useCardReactActions();
  const [ask, setAsk] = useState(false);
  const remove = async () => {
    try {
      await actions.remove(o.id, item);
      toast("의견을 지웠어요");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <li className="rounded-2xl bg-secondary p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-bold text-muted-foreground">보낸 의견 · {noteWhen(o.at)}</span>
        {ask ? (
          <span className="flex gap-1">
            <button type="button" onClick={() => setAsk(false)} className="h-8 rounded-full px-2.5 text-label font-bold text-muted-foreground">
              아니요
            </button>
            <button type="button" onClick={() => void remove()} className="h-8 rounded-full bg-card px-2.5 text-label font-bold text-status-pending">
              지울게요
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setAsk(true)} className="h-8 rounded-full px-2.5 text-label font-bold text-muted-foreground">
            지우기
          </button>
        )}
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-body text-foreground">{o.body}</p>
      {o.reply ? (
        <div className="mt-2 rounded-xl bg-card p-3">
          <p className="text-label font-bold text-primary">
            {o.reply.by.name} {o.reply.by.title} · {noteWhen(o.reply.at)}
          </p>
          <p className="mt-1 whitespace-pre-wrap break-words text-body text-foreground">{o.reply.body}</p>
        </div>
      ) : (
        <p className="mt-2 text-label text-muted-foreground">코치님 답을 기다려요</p>
      )}
    </li>
  );
}

/* ───────── 코치진 ───────── */

function StaffReact({ item, staff }: { item: string; staff: NonNullable<CardSocial["staff"]> }) {
  const chips = countChips(staff.counts);
  const hard = hardPercent(staff.counts);
  return (
    <section aria-label="회원 반응" className="mt-5 space-y-3 border-t border-border pt-5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-body font-black text-foreground">회원 반응</p>
        {hard != null && <span className="text-label font-bold text-muted-foreground">어려워요 {hard}%</span>}
      </div>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c.key}
              className={cn(
                "rounded-full px-3 py-1.5 text-label font-bold",
                c.strong ? "bg-status-pending/10 text-status-pending" : "bg-secondary text-foreground",
              )}
            >
              {c.label}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-label text-muted-foreground">아직 회원 반응이 없어요</p>
      )}
      {staff.opinions.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-body font-black text-foreground">
            회원님 의견 <span className="text-muted-foreground">{staff.opinions.length}</span>
          </p>
          <ul className="space-y-2">
            {staff.opinions.map((o) => (
              <StaffOpinionCard key={o.id} o={o} item={item} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** 회원님 의견 한 장 — 카드 시트 · 「회원님 의견」 창이 같이 쓴다 */
export function StaffOpinionCard({
  o,
  item,
  onOpenCard,
  focus,
}: {
  o: StaffOpinion;
  item?: string;
  /** 「회원님 의견」 창 — 카드 이름을 누르면 그 카드 시트 */
  onOpenCard?: (item: string) => void;
  focus?: boolean;
}) {
  const actions = useCardReactActions();
  const [edit, setEdit] = useState(!o.reply);
  const [text, setText] = useState(o.reply?.mine ? o.reply.body : "");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);
  useEffect(() => {
    setEdit(!o.reply);
  }, [o.reply]);

  const send = async () => {
    const err = replyError(text);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    try {
      await actions.reply(o.id, text.trim(), item ?? o.item);
      setEdit(false);
      toast.success(o.reply ? "답을 고쳤어요" : "답을 보냈어요", { description: o.reply ? undefined : `${o.owner.name}님께 알림이 가요` });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li ref={ref} className={cn("rounded-2xl border bg-card p-3", focus ? "border-primary ring-2 ring-primary/30" : "border-border")}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-label font-bold text-foreground">
          {o.owner.avatarUrl ? <img src={o.owner.avatarUrl} alt="" className="h-full w-full object-cover" /> : o.owner.name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-bold text-foreground">{o.owner.name}님</span>
          <span className="block truncate text-label text-muted-foreground">{noteWhen(o.at)}</span>
        </span>
        {!o.reply && <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-micro font-bold text-primary-foreground">답 기다려요</span>}
      </div>
      {onOpenCard && (
        <button
          type="button"
          onClick={() => onOpenCard(o.item)}
          className="mt-2 max-w-full truncate rounded-full border border-border px-3 py-1 text-label font-bold text-foreground active:scale-95"
        >
          {o.itemName} ›
        </button>
      )}
      <p className="mt-2 whitespace-pre-wrap break-words text-body text-foreground">{o.body}</p>

      {o.reply && !edit && (
        <div className="mt-2 rounded-xl bg-secondary p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-label font-bold text-primary">
              {o.reply.by.name} {o.reply.by.title} · {noteWhen(o.reply.at)}
            </p>
            {o.canReply && (
              <button
                type="button"
                onClick={() => {
                  setText(o.reply?.body ?? "");
                  setEdit(true);
                }}
                className="h-8 shrink-0 rounded-full px-2.5 text-label font-bold text-muted-foreground"
              >
                고치기
              </button>
            )}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-body text-foreground">{o.reply.body}</p>
        </div>
      )}

      {edit && o.canReply && (
        <div className="mt-2 rounded-xl bg-secondary p-2.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, OPINION_MAX))}
            rows={2}
            aria-label={`${o.owner.name}님께 답`}
            placeholder="짧게 한 줄 — 다음 수업 때 같이 봐요"
            className="w-full resize-none bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            {o.reply && (
              <button type="button" onClick={() => setEdit(false)} className="h-10 rounded-full px-3 text-label font-bold text-muted-foreground">
                취소
              </button>
            )}
            <button
              type="button"
              onClick={() => void send()}
              disabled={busy || !text.trim()}
              className="h-10 rounded-full bg-foreground px-4 text-label font-bold text-background active:scale-95 disabled:opacity-50"
            >
              {o.reply ? "답 고치기" : "답 보내기"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
