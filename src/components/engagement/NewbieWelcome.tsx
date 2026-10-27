/**
 * 새 식구 환영 인사 (2026-10-18 대표님: "새식구가 가입하면 환영하는 문화를 만들자. 환영합니다라는 댓글을 남길수있도록").
 *
 * 커뮤니티 피드의 '새 식구' 카드 아래에 붙는다.
 *   · 동료: [환영 인사 남기기] → 빠른 문구(환영합니다! …) 또는 직접 한마디 → 새 식구에게 알림
 *   · 이미 남겼으면 '환영 인사를 남겼어요' (다시 쓰면 고쳐진다)
 *   · 받은 환영 N개 → 누르면 목록 (이름을 누르면 회원 카드)
 *   · 새 식구 본인 카드에는 받은 환영만
 * 서버: send_community_welcome · get_community_welcomes (20261018140000_community_welcome_member_view.sql)
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2, Send } from "lucide-react";

import {
  WELCOME_PRESETS,
  getCommunityWelcomes,
  sendCommunityWelcome,
  type FeedItem,
} from "@/services/communityFeedService";
import { openMemberCard } from "@/lib/appEvents";

interface Props {
  item: FeedItem;
  /** 보낸 뒤 피드를 새로 받는다 */
  onSent: () => void;
}

const NewbieWelcome = ({ item, onSent }: Props) => {
  const qc = useQueryClient();
  const count = item.welcomes ?? 0;
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const listKey = ["community-welcomes", item.userId] as const;
  const list = useQuery({
    queryKey: listKey,
    queryFn: () => getCommunityWelcomes(item.userId),
    enabled: listOpen,
    staleTime: 30_000,
  });

  const send = useMutation({
    mutationFn: (msg: string) => sendCommunityWelcome(item.userId, msg),
    onSuccess: (res) => {
      toast.success(res.new ? `${item.nickname}님께 환영 인사를 남겼어요` : "환영 인사를 고쳤어요");
      setComposing(false);
      setText("");
      qc.invalidateQueries({ queryKey: listKey });
      onSent();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const submit = (msg: string) => {
    const m = msg.trim();
    if (!m || send.isPending) return;
    send.mutate(m);
  };

  return (
    <div className="mt-2.5 border-t border-emerald-500/20 pt-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {!item.isMine &&
          (item.welcomedByMe && !composing ? (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="inline-flex items-center gap-1 rounded-pill bg-emerald-500/15 px-3 py-1.5 text-label font-bold text-emerald-700 active:scale-95 dark:text-emerald-300"
            >
              <Check className="h-3.5 w-3.5" /> 환영 인사를 남겼어요
            </button>
          ) : (
            !composing && (
              <button
                type="button"
                onClick={() => setComposing(true)}
                className="inline-flex items-center gap-1 rounded-pill bg-emerald-600 px-3 py-1.5 text-label font-black text-white active:scale-95"
              >
                환영 인사 남기기
              </button>
            )
          ))}
        {count > 0 && (
          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            className="inline-flex items-center gap-0.5 rounded-pill px-2 py-1.5 text-label font-bold text-emerald-700 active:scale-95 dark:text-emerald-300"
          >
            {item.isMine ? `동료 ${count}명이 환영했어요` : `환영 ${count}개`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${listOpen ? "rotate-180" : ""}`} />
          </button>
        )}
        {count === 0 && item.isMine && (
          <span className="text-label font-semibold text-muted-foreground">동료들의 환영 인사가 여기에 모여요</span>
        )}
      </div>

      {composing && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {WELCOME_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                disabled={send.isPending}
                onClick={() => submit(p)}
                className="rounded-pill border border-emerald-500/40 bg-card px-2.5 py-1.5 text-label font-bold text-foreground active:scale-95 disabled:opacity-60"
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 100))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit(text);
              }}
              placeholder={`${item.nickname}님께 한마디 (100자)`}
              aria-label="환영 한마디"
              className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-label text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => submit(text)}
              disabled={!text.trim() || send.isPending}
              aria-label="보내기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white active:scale-95 disabled:opacity-50"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="shrink-0 px-1.5 text-label font-bold text-muted-foreground"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {listOpen && (
        <ul className="mt-2 space-y-1.5">
          {list.isLoading ? (
            <li className="text-label text-muted-foreground">불러오는 중…</li>
          ) : list.isError ? (
            <li className="text-label text-muted-foreground">환영 인사를 불러오지 못했어요</li>
          ) : (
            (list.data?.items ?? []).map((w) => (
              <li key={w.id} className="flex items-start gap-2 rounded-xl bg-card/80 px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => openMemberCard(w.senderId)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-micro font-black text-muted-foreground"
                  aria-label={`${w.name}님 회원 카드 보기`}
                >
                  {w.avatarUrl ? <img src={w.avatarUrl} alt="" className="h-full w-full object-cover" /> : w.name.slice(0, 1)}
                </button>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => openMemberCard(w.senderId)}
                    className="text-left text-label font-bold text-foreground active:opacity-70"
                  >
                    {w.name}
                    {w.isStaff && <span className="ml-1 text-micro font-black text-yellow-600">코치</span>}
                    {w.isMine && <span className="ml-1 text-micro font-bold text-primary">나</span>}
                  </button>
                  <p className="break-words text-label leading-snug text-foreground">{w.message}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default NewbieWelcome;
