/**
 * 153 — 사이니지 TV2 런칭 이벤트 보드 (2026-09-23)
 *
 * 대표님 지시: TV2 에 "153 마이복서 런칭 이벤트 ① 출석왕 ② 마이복서153 앱 활동왕 ③ 닉네임 좋아요왕".
 *
 * 동작:
 *   · get_launch_event_board(지점명) — anon 호출 가능(TV 는 로그인이 없다). 이번 달(KST) 기준 세 왕좌 Top 5.
 *   · 60초마다 다시 읽는다. 실패하면 마지막 값을 그대로 두고 조용히 재시도 — TV 가 비면 안 된다.
 *   · 점수·순위는 전부 서버가 계산한다. 앱의 153 챌린지 킹 보드와 같은 함수(_king_scores)를 쓴다.
 *
 * 화면(1920×1080, 2~4m 거리): 열 3개. 1위는 왕관 + 큰 글자, 2~5위는 한 줄씩.
 * 개인정보는 표시 이름(닉네임 우선)만 — 서버가 그것만 내려준다.
 */
import { useEffect, useState } from "react";
import { Crown, Heart, Smartphone, CalendarCheck, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { LAUNCH_EVENT_CATEGORIES, KING_META, type KingCategory } from "@/services/king153Service";

interface TvRow { rank: number; display_name: string; score: number | string }
interface TvItem { category: KingCategory; board: TvRow[]; total: number }
interface TvBoard { branch: string; since: string; period: string; items: TvItem[] }

const REFRESH_MS = 60_000;

const COLUMN: Record<string, { no: string; title: string; sub: string; Icon: typeof Crown }> = {
  attendance: { no: "①", title: "출석왕", sub: "이번 달 얼굴 인식 출석 일수", Icon: CalendarCheck },
  app: { no: "②", title: "마이복서153 앱 활동왕", sub: "앱을 연 날 + 앱에서 한 행동", Icon: Smartphone },
  nickname: { no: "③", title: "닉네임 좋아요왕", sub: "같은 지점 회원이 보낸 좋아요 (1인 1개)", Icon: Heart },
};

const fmt = (score: number | string, cat: KingCategory) => `${Number(score).toLocaleString("ko-KR")}${KING_META[cat].unit}`;

interface Props {
  branchName: string;
}

const LaunchEventBoard = ({ branchName }: Props) => {
  const [data, setData] = useState<TvBoard | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!branchName) return;
    let cancelled = false;
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: res, error } = await (supabase as any).rpc("get_launch_event_board", { p_branch: branchName, p_limit: 5 });
        if (cancelled) return;
        if (error || !res) { setStale(true); return; }
        setData(res as TvBoard);
        setStale(false);
      } catch {
        if (!cancelled) setStale(true);
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, [branchName]);

  // 월 표기는 KST 로 — 사이니지 기기가 UTC 면 9월 1일 0시(KST)가 8월 31일로 읽힌다
  const kstMonth = (iso?: string) => new Date((iso ? new Date(iso).getTime() : Date.now()) + 9 * 3600 * 1000).getUTCMonth() + 1;
  const month = kstMonth(data?.since);
  const items = new Map((data?.items ?? []).map((i) => [i.category, i]));

  return (
    <section aria-label="153 마이복서 런칭 이벤트" className="flex h-full min-h-0 flex-col px-6 py-4">
      {/* 제목 줄 */}
      <div className="mb-3 flex flex-shrink-0 items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-yellow-400/80">MYBOXER 153 · LAUNCH EVENT</p>
          <h2 className="mt-1 text-4xl font-black leading-none text-white">
            153 마이복서 <span className="text-yellow-400">런칭 이벤트</span>
          </h2>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white/90">{month}월 왕좌</p>
          <p className="text-sm font-bold text-gray-400">매월 1일 새로 시작 · 지도진 제외{stale ? " · 갱신 지연" : ""}</p>
        </div>
      </div>

      {/* 세 왕좌 */}
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        {LAUNCH_EVENT_CATEGORIES.map((cat) => {
          const col = COLUMN[cat];
          const item = items.get(cat);
          const rows = item?.board ?? [];
          const king = rows[0];
          const rest = rows.slice(1, 5);
          const Icon = col.Icon;
          return (
            <div key={cat} className="flex min-h-0 flex-col rounded-2xl border border-yellow-600/30 bg-gradient-to-b from-yellow-950/40 via-gray-900/70 to-gray-900/80 p-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-yellow-400">{col.no}</span>
                <Icon className="h-7 w-7 text-yellow-400" />
                <div className="min-w-0">
                  <h3 className="truncate text-2xl font-black text-white">{col.title}</h3>
                  <p className="truncate text-sm font-bold text-gray-400">{col.sub}</p>
                </div>
              </div>

              {/* 1위 */}
              <div className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-4">
                {!data ? (
                  <div className="h-12 animate-pulse rounded-lg bg-yellow-500/10" />
                ) : king ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Crown className="h-9 w-9 flex-shrink-0 text-yellow-400" />
                      <p className="truncate text-4xl font-black text-white">{king.display_name}</p>
                    </div>
                    <p className="flex-shrink-0 text-4xl font-black tabular-nums text-yellow-400">{fmt(king.score, cat)}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Trophy className="h-8 w-8 text-yellow-500/60" />
                    <div>
                      <p className="text-2xl font-black text-white/90">왕좌가 비어 있어요</p>
                      <p className="text-sm font-bold text-gray-400">첫 기록이 곧 왕이 됩니다</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 2~5위 */}
              <ol className="mt-3 flex-1 space-y-1.5">
                {rest.map((r) => (
                  <li key={`${cat}-${r.rank}`} className="flex items-center gap-3 rounded-xl bg-gray-800/50 px-4 py-2.5">
                    <span className="w-8 text-center text-2xl font-black tabular-nums text-gray-400">{r.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-2xl font-bold text-white">{r.display_name}</span>
                    <span className="flex-shrink-0 text-2xl font-black tabular-nums text-gray-200">{fmt(r.score, cat)}</span>
                  </li>
                ))}
                {data && rest.length === 0 && king && (
                  <li className="px-4 py-2 text-lg font-bold text-gray-500">다음 자리가 비어 있어요</li>
                )}
              </ol>

              <p className="mt-2 flex-shrink-0 text-sm font-bold text-gray-500">
                {item ? `참가 ${Number(item.total).toLocaleString("ko-KR")}명` : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* 참여 방법 — 한 줄 */}
      <p className="mt-3 flex-shrink-0 text-center text-lg font-bold text-gray-300">
        참여 방법 · 마이복서153 앱 설치 → 마이페이지에서 닉네임 설정 → 매일 앱 열기 → 153 챌린지에서 닉네임 좋아요 보내기
      </p>
    </section>
  );
};

export default LaunchEventBoard;
