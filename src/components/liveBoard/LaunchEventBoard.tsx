/**
 * 153 — 사이니지 TV2 런칭 이벤트 보드 (2026-09-23)
 *
 * 대표님 지시: TV2 에 "153 마이복서 런칭 이벤트 ① 출석왕 ② 마이복서153 앱 활동왕 ③ 닉네임 좋아요왕".
 *
 * 동작:
 *   · get_launch_event_board(지점명) — anon 호출 가능(TV 는 로그인이 없다). 이벤트 기간(설정 화면에서 정한 시작·종료일) 세 왕좌 Top 5.
 *   · 시작 전(upcoming)엔 D-day 티저, 진행 중엔 순위, 종료 후엔 "최종 결과" 로 고정.
 *   · 60초마다 다시 읽는다. 실패하면 마지막 값을 그대로 두고 조용히 재시도 — TV 가 비면 안 된다.
 *   · 점수·순위는 전부 서버가 계산한다. 앱의 153 챌린지 킹 보드와 같은 함수(_king_scores)를 쓴다.
 *
 * 화면(1920×1080, 2~4m 거리): 열 3개. 1위는 왕관 + 큰 글자, 2~5위는 한 줄씩.
 * 개인정보는 표시 이름(닉네임 우선)만 — 서버가 그것만 내려준다.
 *
 * 2026-09-23 검수 반영: ① 부제를 서버 정의(이벤트 기간 얼굴 인식 출석 일수)와 맞춤 · 첫 응답 전엔 상태 문구를 비움 ·
 * 2~4m 거리용 보조 글자 키움 · 닉네임은 '설정' 에서 정한다 · 앱활동은 행동 종류별 하루 1점.
 */
import { useEffect, useState } from "react";
import { Crown, Heart, Smartphone, CalendarCheck, Trophy } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { LAUNCH_EVENT_CATEGORIES, KING_META, fmtKstDate, type KingCategory, type LaunchEventStatus } from "@/services/king153Service";

interface TvRow { rank: number; display_name: string; score: number | string }
interface TvItem { category: KingCategory; board: TvRow[]; total: number }
interface TvBoard {
  branch: string; since: string; period: string; items: TvItem[];
  start_date: string; end_date: string | null; status: LaunchEventStatus; days_until_start: number; days_left: number | null;
  /** 현재 출석왕 등재 — 이번 달 Top 3 · 기록 시작(2026-02)부터 Top 3 */
  current_attendance?: {
    month: { since: string; board: TvRow[] };
    all_time: { since_date: string | null; board: TvRow[] };
  };
}

const REFRESH_MS = 60_000;

const COLUMN: Record<string, { no: string; title: string; sub: string; Icon: typeof Crown }> = {
  attendance: { no: "①", title: "출석왕", sub: "이벤트 기간 얼굴 인식 출석 일수", Icon: CalendarCheck },
  app: { no: "②", title: "마이복서153 앱 활동왕", sub: "앱에서 한 행동 · 종류별 하루 1점", Icon: Smartphone },
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

  const items = new Map((data?.items ?? []).map((i) => [i.category, i]));
  const status: LaunchEventStatus | null = data?.status ?? null;
  const upcoming = status === "upcoming";
  const ended = status === "ended";
  // 현재 출석왕 (이번 달) · 역대 출석왕 (기록 시작부터) — 서버가 같은 계산(_king_scores)으로 준다
  const curMonth = data?.current_attendance?.month.board ?? [];
  const curAll = data?.current_attendance?.all_time.board ?? [];
  const kstMonthLabel = (iso?: string) => (iso ? `${new Date(new Date(iso).getTime() + 9 * 3600 * 1000).getUTCMonth() + 1}월` : "이번 달");
  const monthLabel = kstMonthLabel(data?.current_attendance?.month.since);
  const allSince = fmtKstDate(data?.current_attendance?.all_time.since_date);
  // 기간 문구 — 서버가 준 KST 날짜 문자열을 그대로 쓴다(기기 시간대와 무관)
  const periodLine = !data
    ? ""
    : upcoming
      ? `${fmtKstDate(data.start_date)} 시작`
      : data.end_date
        ? `${fmtKstDate(data.start_date)} ~ ${fmtKstDate(data.end_date)}`
        : `${fmtKstDate(data.start_date)}부터 진행 중`;

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
          {!data ? (
            // 첫 응답 전 — "진행 중" 을 먼저 띄웠다가 D-day 로 바뀌는 깜빡임 방지
            <p className="text-2xl font-black text-white/40">&nbsp;</p>
          ) : upcoming ? (
            <p className="text-3xl font-black text-yellow-400">D-{data.days_until_start}</p>
          ) : (
            <p className="text-2xl font-black text-white/90">{ended ? "최종 결과" : "진행 중"}</p>
          )}
          <p className="text-base font-bold text-gray-400">
            {periodLine}{ended ? " · 순위 확정" : ""}{data ? " · 지점 회원만 (코치님 제외)" : ""}{stale ? " · 갱신 지연" : ""}
          </p>
        </div>
      </div>

      {/* 현재 출석왕 등재 — 시작 전엔 크게(이번 달 왕 + 역대 왕), 진행 중엔 한 줄 */}
      {data && upcoming && (
        <div className="mb-3 grid flex-shrink-0 grid-cols-2 gap-4">
          {[
            { label: `현재 출석왕 · ${monthLabel}`, sub: `${monthLabel} 1일부터 오늘까지 출석 일수`, rows: curMonth },
            { label: "역대 출석왕", sub: allSince ? `${allSince}부터 누적 출석 일수` : "누적 출석 일수", rows: curAll },
          ].map((blk) => {
            const k = blk.rows[0];
            return (
              <div key={blk.label} className="flex items-center gap-5 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-6 py-4">
                <Crown className="h-12 w-12 flex-shrink-0 text-yellow-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black uppercase tracking-[0.25em] text-yellow-400/90">{blk.label}</p>
                  {k ? (
                    <div className="mt-1 flex items-baseline justify-between gap-4">
                      <p className="truncate text-4xl font-black text-white">{k.display_name}</p>
                      <p className="flex-shrink-0 text-4xl font-black tabular-nums text-yellow-400">{fmt(k.score, "attendance")}</p>
                    </div>
                  ) : (
                    <p className="mt-1 text-2xl font-black text-white/80">아직 기록이 없어요</p>
                  )}
                  <p className="mt-1 truncate text-base font-bold text-gray-400">
                    {blk.sub}
                    {blk.rows.length > 1 && ` · ${blk.rows.slice(1, 3).map((r) => `${r.rank}위 ${r.display_name} ${fmt(r.score, "attendance")}`).join(" · ")}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {data && !upcoming && curAll[0] && (
        <p className="mb-3 flex flex-shrink-0 items-center justify-center gap-2 text-lg font-bold text-gray-300">
          <Crown className="h-5 w-5 text-yellow-400" />
          역대 출석왕 <span className="text-white">{curAll[0].display_name}</span> {fmt(curAll[0].score, "attendance")}
          {allSince ? ` (${allSince}부터)` : ""} · {monthLabel} 출석왕 <span className="text-white">{curMonth[0]?.display_name ?? "—"}</span>
          {curMonth[0] ? ` ${fmt(curMonth[0].score, "attendance")}` : ""}
        </p>
      )}
      {data && upcoming && (
        <p className="mb-3 flex-shrink-0 text-center text-xl font-black text-white/90">
          <span className="text-yellow-400">{fmtKstDate(data.start_date)}</span>부터 런칭 이벤트 왕좌 경쟁이 시작됩니다 — 지금 앱을 설치하고 설정에서 닉네임을 정해두세요
        </p>
      )}

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
                  <p className="truncate text-base font-bold text-gray-400">{col.sub}</p>
                </div>
              </div>

              {/* 1위 */}
              <div className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 px-5 py-4">
                {!data ? (
                  <div className="h-12 animate-pulse rounded-lg bg-yellow-500/10" />
                ) : upcoming ? (
                  <div className="flex items-center gap-3">
                    <Trophy className="h-8 w-8 text-yellow-500/60" />
                    <div>
                      <p className="text-2xl font-black text-white/90">{fmtKstDate(data.start_date)} 개막</p>
                      <p className="text-base font-bold text-gray-400">첫날 첫 기록이 첫 왕이 됩니다</p>
                    </div>
                  </div>
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
                      <p className="text-base font-bold text-gray-400">첫 기록이 곧 왕이 됩니다</p>
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
                {upcoming && (
                  <li className="px-4 py-3 text-lg font-bold leading-relaxed text-gray-400">
                    {cat === "attendance" && "얼굴 인식으로 들어온 날이 하루 1일씩 쌓입니다."}
                    {cat === "app" && "앱 열기·운동 종료·챌린지·퀴즈·좋아요 — 행동 종류마다 하루 1점."}
                    {cat === "nickname" && "설정에서 닉네임을 정하면 같은 지점 회원이 좋아요를 보낼 수 있어요. 한 사람에게 하나."}
                  </li>
                )}
              </ol>

              <p className="mt-2 flex-shrink-0 text-base font-bold text-gray-500">
                {item && !upcoming ? `참가 ${Number(item.total).toLocaleString("ko-KR")}명` : ""}
              </p>
            </div>
          );
        })}
      </div>

      {/* 참여 방법 — 한 줄 */}
      <p className="mt-3 flex-shrink-0 text-center text-lg font-bold text-gray-300">
        참여 방법 · 마이복서153 앱 설치 → 설정에서 닉네임 정하기 → 매일 앱 열기 → 153 챌린지에서 닉네임 좋아요 보내기
      </p>
    </section>
  );
};

export default LaunchEventBoard;
