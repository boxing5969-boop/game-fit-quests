/**
 * 🥊 메시지 탭 '오삼코치' — 오삼코치가 회원에게 보낸 메시지 기록
 * (2026-10-15 대표님: "api가 회원님들에게 보낸 메세지는 메세지 탭에서 지점장이랑 내가 확인할수있게 해줘").
 *
 *   · 서버 coach_sent_list 가 범위를 정한다 — 본사(super_admin·admin)는 전 지점, 지점장은 자기 지점만. 코치·회원은 못 본다.
 *   · 회원이 실제로 받은 글 그대로 — 알림 제목·본문 + (오늘의 목표·복귀 응원은) '내 카드' 문장.
 *   · 최근 보낸 순, 날짜별로 묶어 30건씩 '더 보기'. 보기 전용 — 승인·고치기는 지점장 홈의 '오삼코치 오늘 메시지' 카드에서.
 */
import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { dmBubbleTime, dmDayLabel, kstDayKey } from "@/lib/dmTime";
import { shortBranch } from "@/lib/dmPeople";
import { cn } from "@/lib/utils";

type SentItem = {
  id: string;
  kind: "daily_goal" | "attendance_praise" | "comeback";
  source: "ai" | "fallback" | "edited";
  title: string;
  body: string;
  card: string | null;
  member: string;
  member_name: string | null;
  level_label: string | null;
  branch: string | null;
  sent_at: string;
  opened_at: string | null;
  reviewer: string | null;
};

type SentPage = {
  scope: string;
  items: SentItem[];
  has_more: boolean;
  today: { sent: number; opened: number } | null;
};

const PAGE = 30;

// 새 함수는 types.ts 재생성 전 — 기존 파일들과 같은 캐스트 패턴
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args: Record<string, unknown> = {}) => (supabase.rpc as any)(name, args);

const KIND: Record<string, string> = {
  daily_goal: "오늘의 목표",
  attendance_praise: "출석 칭찬",
  comeback: "복귀 응원",
};

const SOURCE: Record<string, { label: string; cls: string }> = {
  ai: { label: "AI", cls: "bg-primary/15 text-primary" },
  edited: { label: "수정함", cls: "bg-accent/20 text-foreground" },
  fallback: { label: "기본 문구", cls: "bg-muted text-muted-foreground" },
};

/** 날짜 묶음 제목 — 오늘 · 어제 · "10월 13일 화요일" */
const dayTitle = (at: string): string => {
  const key = kstDayKey(at);
  if (key === kstDayKey(new Date())) return "오늘";
  if (key === kstDayKey(new Date(Date.now() - 86_400_000))) return "어제";
  return dmDayLabel(at);
};

const CoachSentList = () => {
  const { user } = useAuth();

  const q = useInfiniteQuery({
    queryKey: ["coach-sent", user?.id ?? "anon"],
    enabled: !!user?.id,
    staleTime: 60_000,
    retry: false,
    initialPageParam: null as { at: string; id: string } | null,
    queryFn: async ({ pageParam }): Promise<SentPage> => {
      const { data, error } = await rpc("coach_sent_list", {
        _before_at: pageParam?.at ?? null,
        _before_id: pageParam?.id ?? null,
        _limit: PAGE,
      });
      if (error) throw error;
      const d = (data ?? {}) as Partial<SentPage>;
      return {
        scope: typeof d.scope === "string" ? d.scope : "",
        items: Array.isArray(d.items) ? d.items : [],
        has_more: !!d.has_more,
        today: d.today ?? null,
      };
    },
    getNextPageParam: (last) => {
      const tail = last.items[last.items.length - 1];
      return last.has_more && tail ? { at: tail.sent_at, id: tail.id } : undefined;
    },
  });

  const first = q.data?.pages[0];
  const allBranches = first?.scope === "all";

  // 페이지를 이어 붙이고(겹치면 한 번만) 날짜별로 묶는다 — 최근 보낸 순 그대로
  const groups = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; title: string; items: SentItem[] }[] = [];
    for (const page of q.data?.pages ?? []) {
      for (const it of page.items) {
        if (!it?.id || !it.sent_at || seen.has(it.id)) continue;
        seen.add(it.id);
        const key = kstDayKey(it.sent_at);
        const last = out[out.length - 1];
        if (last && last.key === key) last.items.push(it);
        else out.push({ key, title: dayTitle(it.sent_at), items: [it] });
      }
    }
    return out;
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="space-y-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (q.isError && !q.data) {
    return (
      <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
        <p className="text-label font-bold text-foreground">보낸 메시지를 불러오지 못했어요</p>
        <p className="mt-1 text-label text-muted-foreground">지점장·운영진 계정만 볼 수 있어요. 인터넷 연결도 확인해 주세요.</p>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="mt-4 rounded-full bg-secondary px-4 py-2 text-label font-bold active:scale-95"
        >
          다시 불러오기
        </button>
      </div>
    );
  }

  return (
    <section aria-label="오삼코치가 보낸 메시지" className="space-y-3">
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] px-4 py-3">
        <p className="text-label font-bold text-foreground">🥊 오삼코치가 회원에게 보낸 메시지</p>
        <p className="mt-0.5 text-label leading-relaxed text-muted-foreground">
          {allBranches ? "전 지점" : shortBranch(first?.scope) || "우리 지점"} · 회원이 받은 알림 그대로예요.
          {first?.today ? ` 오늘 ${first.today.sent}건 보냄 · 알림 눌러 본 회원 ${first.today.opened}명.` : ""}
        </p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
          <p className="text-display" aria-hidden>
            🥊
          </p>
          <p className="mt-2 text-body font-bold text-foreground">아직 보낸 메시지가 없어요</p>
          <p className="mt-1 text-label leading-relaxed text-muted-foreground">
            오삼코치는 밤 2시에 문구를 만들고,
            <br />
            승인한 것만 아침 8시에 회원에게 보내요.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <h3 className="mb-1.5 px-1 text-label font-bold text-muted-foreground">
              {g.title} · {g.items.length}건
            </h3>
            <ul className="space-y-2">
              {g.items.map((it) => {
                const src = SOURCE[it.source] ?? SOURCE.fallback;
                return (
                  <li key={it.id} className="rounded-2xl bg-card px-4 py-3 shadow-elev-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-micro">
                      <span className="rounded-full bg-secondary px-2 py-0.5 font-semibold text-foreground">
                        {KIND[it.kind] ?? "메시지"}
                      </span>
                      <span className="text-label font-bold text-foreground">{it.member}</span>
                      {it.member_name && it.member_name !== it.member && (
                        <span className="text-muted-foreground">({it.member_name})</span>
                      )}
                      {it.level_label && <span className="text-muted-foreground">{it.level_label}</span>}
                      {allBranches && it.branch && <span className="text-muted-foreground">· {shortBranch(it.branch)}</span>}
                      <span className={cn("ml-auto rounded-full px-1.5 py-0.5 text-micro font-bold", src.cls)}>{src.label}</span>
                    </div>
                    <p className="mt-1.5 text-label font-bold leading-snug text-foreground">{it.title}</p>
                    <p className="text-label leading-snug text-foreground">{it.body}</p>
                    {it.card && (
                      <p className="mt-1.5 rounded-xl bg-secondary/50 px-2.5 py-1.5 text-label leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground/80">내 카드</span> · {it.card}
                      </p>
                    )}
                    <p className="mt-1.5 text-micro text-muted-foreground">
                      {dmBubbleTime(it.sent_at)} 보냄
                      {it.opened_at && <span className="font-semibold text-primary"> · 알림 눌러 봄</span>}
                      {it.reviewer && ` · ${it.reviewer} 승인`}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {q.hasNextPage && (
        <button
          type="button"
          onClick={() => q.fetchNextPage()}
          disabled={q.isFetchingNextPage}
          className="h-10 w-full rounded-full bg-secondary text-label font-bold text-muted-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {q.isFetchingNextPage ? "불러오는 중…" : "이전 메시지 더 보기"}
        </button>
      )}

      <p className="px-1 pt-1 text-micro leading-relaxed text-muted-foreground">
        AI = 오삼코치가 쓴 문구 · 기본 문구 = 미리 정해 둔 문구 · 수정함 = 검수에서 고친 문구. 승인·고치기는 지점장 홈의 ‘오삼코치
        오늘 메시지’ 카드에서 해요.
      </p>
    </section>
  );
};

export default CoachSentList;
