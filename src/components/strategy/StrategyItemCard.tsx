/**
 * 전략 회의실 글 카드 — 지시 · 전략 · 칭찬 · 운영 원칙 · 오늘 프로그램 · 수업 기록 (2026-10-16)
 *   · 받은 사람은 '확인했어요' (프로그램은 수업 뒤 '수업에 적용했어요')
 *   · 확인 n/n 을 누르면 누가 확인했는지 (글쓴이 · 지시권자)
 *   · 댓글(피드백) · 추천 수업(지시권자) · 지우기(글쓴이 · 지시권자)
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronDown, ChevronUp, FileText, MessageCircle, Play, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import {
  BLOCK_LABEL,
  KIND_LABEL,
  programTotal,
  shortDate,
  strategyTime,
  useAckStrategy,
  useAddComment,
  useDeleteComment,
  useDeleteStrategy,
  useStarStrategy,
  useStrategyAckStatus,
  useStrategyComments,
  type StrategyItem,
  type StrategyMe,
  type StrategyVideo,
} from "@/services/strategyService";

const KIND_TONE: Record<StrategyItem["kind"], string> = {
  directive: "bg-primary/10 text-primary",
  strategy: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  praise: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  principle: "bg-foreground text-background",
  program: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  class_log: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

const ackable = (k: StrategyItem["kind"]) => k !== "class_log";

export const PersonLine = ({ name, title, time }: { name: string; title: string; time?: string }) => (
  <p className="text-label text-muted-foreground">
    <span className="font-bold text-foreground">{name}</span> {title}
    {time && <span> · {time}</span>}
  </p>
);

const Row = ({ label, text }: { label: string; text?: string | null }) =>
  text ? (
    <div className="grid grid-cols-[3.6rem_1fr] gap-2 text-label leading-relaxed">
      <span className="font-bold text-muted-foreground">{label}</span>
      <span className="whitespace-pre-wrap text-foreground">{text}</span>
    </div>
  ) : null;

interface Props {
  item: StrategyItem;
  me: StrategyMe;
  videos?: Map<string, StrategyVideo>;
  onPlay?: (v: StrategyVideo) => void;
  /** 프로그램 '수업에 적용했어요' → 수업 기록 쓰기로 이어진다 */
  onApplied?: (item: StrategyItem) => void;
  /** 프로그램을 복사해 새로 만들기 (지시권자) */
  onReuse?: (item: StrategyItem) => void;
}

const StrategyItemCard = ({ item, me, videos, onPlay, onApplied, onReuse }: Props) => {
  const [openComments, setOpenComments] = useState(false);
  const [ackSheet, setAckSheet] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ack = useAckStrategy();
  const star = useStarStrategy();
  const del = useDeleteStrategy();
  const canDirect = !!me.can_direct;
  const acked = !!item.my_ack?.acked_at;
  const applied = !!item.my_ack?.applied_at;
  const d = item.data ?? {};
  const canDelete = item.mine || canDirect;
  const navigate = useNavigate();
  // 지점 회의실 3단계 — 회의에서 정한 것으로 만든 지시는 그 회의록으로 (office_wrap_up 이 data.meeting_id 를 남긴다)
  const meetingId = item.kind === "directive" && typeof d.meeting_id === "string" ? d.meeting_id : null;

  const doAck = (what: "ack" | "applied") =>
    ack.mutate(
      { id: item.id, what },
      {
        onSuccess: () => {
          if (what === "applied") {
            toast.success("수업 기록을 남겨 주세요");
            onApplied?.(item);
          }
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <article
      className={cn(
        "rounded-3xl bg-card p-4 shadow-elev-1",
        !item.mine && ackable(item.kind) && !acked && "ring-2 ring-primary/40",
      )}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-micro font-black", KIND_TONE[item.kind])}>
          {item.kind === "principle" && item.principle_no ? `원칙 ${item.principle_no}` : KIND_LABEL[item.kind]}
        </span>
        {item.kind === "class_log" && item.starred && (
          <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-micro font-black text-amber-700 dark:text-amber-300">
            ⭐ 추천 수업
          </span>
        )}
        <div className="min-w-0 flex-1" />
        {canDelete &&
          (confirmDelete ? (
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="rounded-full bg-secondary px-2.5 py-1 text-micro font-bold text-muted-foreground"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() =>
                  del.mutate(item.id, {
                    onSuccess: () => toast.success("지웠어요"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                className="rounded-full bg-destructive px-2.5 py-1 text-micro font-black text-destructive-foreground"
              >
                지우기
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              aria-label="지우기"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ))}
      </div>

      {/* 제목 */}
      {item.kind === "class_log" ? (
        <p className="text-body font-black text-foreground">
          {shortDate(item.event_date)} {d.hour != null ? `${d.hour}시` : ""} 수업
          {d.attendees != null && <span className="ml-1.5 text-label font-bold text-muted-foreground">· 입실 {d.attendees}명</span>}
        </p>
      ) : item.kind === "program" ? (
        <p className="text-body font-black text-foreground">
          {item.title || "오늘 프로그램"}
          <span className="ml-1.5 text-label font-bold text-muted-foreground">
            {[shortDate(item.event_date), d.slot].filter(Boolean).join(" ")} · {programTotal(d.blocks)}분
          </span>
        </p>
      ) : (
        item.title && <p className="text-body font-black leading-snug text-foreground">{item.title}</p>
      )}

      {/* 본문 */}
      <div className="mt-2 space-y-1.5">
        {item.kind === "directive" && (
          <>
            <Row label="상황" text={d.situation} />
            <Row label="기준" text={d.standard} />
            <Row label="요청" text={d.request} />
            <Row label="대상" text={d.target} />
          </>
        )}
        {item.kind === "class_log" && (
          <>
            <Row label="프로그램" text={d.program_title} />
            <Row label="잘된 점" text={d.went_well} />
            <Row label="어려움" text={d.issues} />
            <Row label="다음에" text={d.next_focus} />
          </>
        )}
        {item.kind === "program" && (
          <ol className="space-y-1.5">
            {(d.blocks ?? []).map((b, i) => {
              const v = b.video_id ? videos?.get(b.video_id) : undefined;
              return (
                <li key={i} className="flex items-start gap-2 rounded-2xl bg-secondary/60 px-3 py-2">
                  <span className="mt-0.5 w-5 shrink-0 text-center text-label font-black text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-label font-bold text-foreground">
                      <span className="mr-1 text-micro font-black text-emerald-700 dark:text-emerald-300">{BLOCK_LABEL[b.kind] ?? b.kind}</span>
                      {b.title || v?.title || "—"}
                    </span>
                    {b.note && <span className="block whitespace-pre-wrap text-label text-muted-foreground">{b.note}</span>}
                  </span>
                  <span className="shrink-0 text-label font-bold tabular-nums text-muted-foreground">{b.minutes}분</span>
                  {v && onPlay && (
                    <button
                      type="button"
                      onClick={() => onPlay(v)}
                      aria-label={`${v.title} 영상 보기`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background active:scale-95"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
        {item.body && <p className="whitespace-pre-wrap text-label leading-relaxed text-foreground">{item.body}</p>}
      </div>

      <div className="mt-3">
        <PersonLine name={item.author?.name ?? ""} title={item.author?.title ?? ""} time={strategyTime(item.created_at)} />
      </div>

      {/* 확인 · 적용 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!item.mine && ackable(item.kind) && !acked && (
          <button
            type="button"
            disabled={ack.isPending}
            onClick={() => doAck("ack")}
            className="flex h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-label font-black text-primary-foreground active:scale-95 disabled:opacity-60"
          >
            <Check className="h-4 w-4" /> 확인했어요
          </button>
        )}
        {!item.mine && ackable(item.kind) && acked && item.kind !== "program" && (
          <span className="text-label font-bold text-emerald-600 dark:text-emerald-400">✓ 확인함</span>
        )}
        {item.kind === "program" && !item.mine && acked && !applied && (
          <button
            type="button"
            disabled={ack.isPending}
            onClick={() => doAck("applied")}
            className="flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-label font-black text-background active:scale-95 disabled:opacity-60"
          >
            🥊 수업에 적용했어요
          </button>
        )}
        {item.kind === "program" && !item.mine && applied && (
          <span className="text-label font-bold text-emerald-600 dark:text-emerald-400">✓ 수업에 적용함</span>
        )}
        {ackable(item.kind) && item.targets > 0 && (
          <button
            type="button"
            onClick={() => setAckSheet(true)}
            className="rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-muted-foreground active:scale-95"
          >
            확인 {item.acked}/{item.targets}
            {item.kind === "program" && item.applied > 0 ? ` · 적용 ${item.applied}` : ""}
          </button>
        )}
        {item.kind === "class_log" && canDirect && (
          <button
            type="button"
            disabled={star.isPending}
            onClick={() =>
              star.mutate(
                { id: item.id, on: !item.starred },
                { onError: (e) => toast.error((e as Error).message) },
              )
            }
            className={cn(
              "flex items-center gap-1 rounded-full px-3 py-1.5 text-label font-bold active:scale-95",
              item.starred ? "bg-amber-400/20 text-amber-700 dark:text-amber-300" : "bg-secondary text-muted-foreground",
            )}
          >
            <Star className={cn("h-3.5 w-3.5", item.starred && "fill-current")} />
            {item.starred ? "추천됨" : "추천 수업"}
          </button>
        )}
        {meetingId && (
          <button
            type="button"
            onClick={() => navigate(`/office?minutes=${meetingId}`)}
            className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-muted-foreground active:scale-95"
          >
            <FileText className="h-3.5 w-3.5" /> 회의록 보기
          </button>
        )}
        {item.kind === "program" && canDirect && onReuse && (
          <button
            type="button"
            onClick={() => onReuse(item)}
            className="rounded-full bg-secondary px-3 py-1.5 text-label font-bold text-muted-foreground active:scale-95"
          >
            복사해서 새로 보내기
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpenComments((v) => !v)}
          className="ml-auto flex items-center gap-1 rounded-full px-2 py-1.5 text-label font-bold text-muted-foreground active:bg-secondary"
        >
          <MessageCircle className="h-4 w-4" />
          {item.kind === "class_log" ? "피드백" : "댓글"} {item.comments > 0 ? item.comments : ""}
          {openComments ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {openComments && <Comments itemId={item.id} placeholder={item.kind === "class_log" ? "피드백을 남겨 주세요" : "질문·의견을 남겨 주세요"} />}

      <AckSheet open={ackSheet} onClose={() => setAckSheet(false)} item={item} />
    </article>
  );
};

const Comments = ({ itemId, placeholder }: { itemId: string; placeholder: string }) => {
  const { data = [], isLoading } = useStrategyComments(itemId);
  const add = useAddComment();
  const del = useDeleteComment();
  const [text, setText] = useState("");
  const send = () => {
    const body = text.trim();
    if (!body) return;
    add.mutate(
      { itemId, body },
      { onSuccess: () => setText(""), onError: (e) => toast.error((e as Error).message) },
    );
  };
  return (
    <div className="mt-3 space-y-2 border-t border-border/70 pt-3">
      {isLoading ? (
        <p className="text-label text-muted-foreground">불러오는 중…</p>
      ) : (
        data.map((c) => (
          <div key={c.id} className="rounded-2xl bg-secondary/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <PersonLine name={c.author?.name ?? ""} title={c.author?.title ?? ""} time={strategyTime(c.created_at)} />
              {c.mine && (
                <button
                  type="button"
                  onClick={() => del.mutate(c.id, { onError: (e) => toast.error((e as Error).message) })}
                  className="ml-auto text-label font-bold text-muted-foreground"
                >
                  지우기
                </button>
              )}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-label leading-relaxed text-foreground">{c.body}</p>
          </div>
        ))
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          rows={1}
          maxLength={1000}
          className="min-h-[40px] flex-1 resize-none rounded-2xl border border-border bg-background px-3 py-2 text-label outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || add.isPending}
          className="h-10 shrink-0 rounded-full bg-foreground px-4 text-label font-black text-background active:scale-95 disabled:opacity-40"
        >
          남기기
        </button>
      </div>
    </div>
  );
};

const AckSheet = ({ open, onClose, item }: { open: boolean; onClose: () => void; item: StrategyItem }) => {
  const { data = [], isLoading } = useStrategyAckStatus(open ? item.id : null);
  return (
    <DmSheet open={open} onClose={onClose} title="확인 현황" subtitle={item.title || KIND_LABEL[item.kind]}>
      {isLoading ? (
        <p className="py-6 text-center text-label text-muted-foreground">불러오는 중…</p>
      ) : (
        <ul className="divide-y divide-border/70">
          {data.map((r) => (
            <li key={r.user_id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-label font-bold text-foreground">
                  {r.name} <span className="text-label font-medium text-muted-foreground">{r.title}</span>
                </span>
              </span>
              {r.applied_at ? (
                <span className="text-label font-bold text-emerald-600 dark:text-emerald-400">적용 {strategyTime(r.applied_at)}</span>
              ) : r.acked_at ? (
                <span className="text-label font-bold text-emerald-600 dark:text-emerald-400">✓ {strategyTime(r.acked_at)}</span>
              ) : (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-micro font-black text-primary">아직</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </DmSheet>
  );
};

export default StrategyItemCard;
