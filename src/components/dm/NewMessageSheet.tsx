/**
 * 새 메시지 — 보낼 사람 고르기. 회원·코치님은 같은 지점(코치님 먼저 → 앱을 쓰는 회원 → 최근 출석 순),
 * 본사 계정은 전 지점. 이름(닉네임) 검색은 서버가 한다. 이미 대화가 있으면 그 대화로 바로 간다.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";
import { useDmPeople } from "@/hooks/useDm";
import { openCredentialChange } from "@/lib/appEvents";
import { dmPersonLine, shortBranch } from "@/lib/dmPeople";
import { DmAvatar, DmKindBadge, DmSheet } from "@/components/dm/DmParts";

interface Props {
  open: boolean;
  onClose: () => void;
}

const NewMessageSheet = ({ open, onClose }: Props) => {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  // 글자마다 서버를 부르지 않게 0.3초 기다렸다가 찾는다
  useEffect(() => {
    const t = window.setTimeout(() => setQ(text.trim()), 300);
    return () => window.clearTimeout(t);
  }, [text]);
  useEffect(() => {
    if (!open) {
      setText("");
      setQ("");
    }
  }, [open]);

  const { data, isLoading, isError, refetch, isFetching } = useDmPeople(q, open);
  const rows = data?.rows ?? [];
  const blocked = data?.reason === "change_credentials" || data?.reason === "suspended" || data?.reason === "not_member";

  const pick = (userId: string, threadId: string | null) => {
    onClose();
    navigate(threadId ? `/messages/${threadId}` : `/messages/to/${userId}`);
  };

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title="새 메시지"
      subtitle={
        data?.all_branches
          ? "본사 계정 — 전 지점 회원·코치님께 보낼 수 있어요"
          : `${shortBranch(data?.branch) || "우리 지점"} 회원·코치님께 보낼 수 있어요`
      }
    >
      <label className="sticky top-0 z-10 -mx-1 mb-3 flex items-center gap-2 rounded-2xl bg-secondary px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="이름(닉네임) 검색"
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted-foreground"
          aria-label="보낼 사람 검색"
        />
        {isFetching && !isLoading && <span className="text-[11px] text-muted-foreground">찾는 중…</span>}
      </label>

      {blocked && data?.reason_text && (
        data.reason === "change_credentials" ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              openCredentialChange();
            }}
            className="mb-3 w-full rounded-xl bg-primary/10 px-3.5 py-3 text-left text-[12.5px] leading-snug text-foreground active:scale-[0.99]"
          >
            {data.reason_text}
            <span className="font-bold text-primary"> 지금 바꾸기 →</span>
          </button>
        ) : (
          <p className="mb-3 rounded-xl bg-muted/60 px-3.5 py-3 text-[12.5px] leading-snug text-muted-foreground">{data.reason_text}</p>
        )
      )}

      {isLoading ? (
        <ul className="space-y-2" aria-hidden>
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 py-1.5">
              <span className="h-11 w-11 animate-pulse rounded-full bg-muted" />
              <span className="h-4 w-32 animate-pulse rounded bg-muted" />
            </li>
          ))}
        </ul>
      ) : isError ? (
        <div className="rounded-2xl bg-muted/50 px-4 py-8 text-center">
          <p className="text-[14px] font-bold text-foreground">목록을 불러오지 못했어요</p>
          <button type="button" onClick={() => refetch()} className="mt-3 rounded-full bg-secondary px-4 py-2 text-[13px] font-bold active:scale-95">
            다시 불러오기
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl bg-muted/40 px-4 py-10 text-center">
          <p className="text-[14px] font-bold text-foreground">{q ? `'${q}' 이름을 찾지 못했어요` : "보낼 수 있는 사람이 아직 없어요"}</p>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {q ? "닉네임이나 이름 일부로 다시 찾아보세요" : "같은 지점 회원·코치님이 여기에 보여요"}
          </p>
        </div>
      ) : (
        <ul className="-mx-2">
          {rows.map((r) => (
            <li key={r.user_id}>
              <button
                type="button"
                onClick={() => pick(r.user_id, r.thread_id)}
                disabled={(blocked && !r.thread_id) || !!r.closed}
                className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors active:bg-secondary disabled:opacity-50"
              >
                <DmAvatar person={r} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[15px] font-bold text-foreground">{r.display}</span>
                    <DmKindBadge kind={r.kind} />
                  </span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    {r.closed ? "메시지 요청을 받지 않아요" : dmPersonLine(r, !!data?.all_branches)}
                    {r.thread_id ? " · 대화 중" : ""}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length >= 40 && !q && (
        <p className="mt-3 text-center text-[11.5px] text-muted-foreground">더 많은 사람은 이름으로 찾아 주세요</p>
      )}
    </DmSheet>
  );
};

export default NewMessageSheet;
