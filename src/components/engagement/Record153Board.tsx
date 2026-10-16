/**
 * 153 레코드 탭 (랭킹 화면의 세 번째 탭) — 2026-10-15 대표님:
 * "세계적 기업이 될 153복싱짐의 역사적인 순간 기록을 보유하세요 — 최초 가입자 · 최초 레벨 10 ·
 *  최초 레벨 11 · 153 체력테스트 최초 기록 보유자 등등"
 *   · 최초 기록은 한 번 새겨지면 바뀌지 않는다 (DB records_153)
 *   · 비어 있는 기록은 '아직 주인 없음' — 누가 처음이 될지 보이게
 *   · 153 체력테스트 = 챌린지 아레나 체력 종목. 종목별 신기록은 계속 바뀐다.
 *   · 2026-10-16: 최초 기록을 세우면 마일리지 10,000 (DB 트리거) · 아레나 칸 → '최초 153 TEST 완주'
 *     기록 칸 목록은 records153Service RECORD_153_FIRSTS (랭킹·명예의 전당 띠와 같이 씀)
 *   · 2026-10-16: '대회의 역사' — 153복싱짐이 처음 나간 대회의 우승·준우승 (한 칸에 여러 명, 메달 그림은 이름 옆 메달과 같다)
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MedalBadge } from "@/components/MedalMark";
import FunChallengeArenaSheet from "@/components/engagement/FunChallengeArenaSheet";
import {
  RECORD_153_FIRSTS,
  RECORD_153_MILEAGE,
  RECORD_153_TOURNAMENT,
  RECORDS_153_KEY,
  sortTournamentHolders,
  useRecords153,
  type Record153First,
  type Record153Section,
  type Record153TournamentHolder,
} from "@/services/records153Service";

type Section = Record153Section;
const FIRSTS = RECORD_153_FIRSTS;
const MILEAGE_LABEL = RECORD_153_MILEAGE.toLocaleString();

const SECTION_TITLE: Record<Section, string> = {
  start: "153의 첫 페이지",
  level: "레벨의 역사",
  fitness: "153 TEST",
};

/** 종목별 신기록 + '체력테스트 하러 가기' — 보류 중 (2026-10-15 대표님). 다시 보이려면 true */
const SHOW_BESTS = false;

const UNIT: Record<string, string> = { count: "회", minutes: "분", rounds: "라운드", combos: "콤보" };

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

interface Props {
  /** 이름을 누르면 그 회원 라이센스 열기 */
  onOpenMember?: (m: { id: string; nickname: string }) => void;
}

const Record153Board = ({ onOpenMember }: Props) => {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useRecords153();
  const [arena, setArena] = useState<{ open: boolean; code: string | null }>({ open: false, code: null });

  const byKey = new Map((data?.firsts ?? []).map((f) => [f.key, f]));
  const filled = FIRSTS.filter((f) => byKey.has(f.key)).length;

  const closeArena = () => {
    setArena((a) => ({ ...a, open: false }));
    qc.invalidateQueries({ queryKey: RECORDS_153_KEY });
  };

  const renderSection = (section: Section) => {
    const items = FIRSTS.map((f, idx) => ({ ...f, no: idx + 1 })).filter((f) => f.section === section);
    return (
      <section className="space-y-2.5">
        <h3 className="px-1 text-[13px] font-black tracking-wide text-muted-foreground">{SECTION_TITLE[section]}</h3>
        {items.map((f) => (
          <RecordCard
            key={f.key}
            no={f.no}
            emoji={f.emoji}
            title={f.title}
            desc={f.desc}
            empty={f.empty}
            rec={byKey.get(f.key) ?? null}
            onOpenMember={onOpenMember}
          />
        ))}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <section
        className="relative overflow-hidden rounded-hero border bg-card p-6 text-center"
        style={{ borderColor: "rgba(246, 196, 83, 0.45)" }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <div className="absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-reward/10 blur-3xl" />
        </div>
        <div className="relative flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-reward/15">
            <ScrollText className="h-7 w-7 text-reward" />
          </div>
          <h2 className="text-display-sm text-foreground">153 레코드</h2>
          <p className="text-body-sm text-muted-foreground">
            세계로 갈 153복싱짐의 첫 역사.
            <br />
            한 번 새겨진 이름은 영원히 남아요.
          </p>
          <p className="text-[13px] font-black text-reward">
            🎁 최초 기록을 세우면 마일리지 {MILEAGE_LABEL} 적립
          </p>
          {data && (
            <span className="mt-1 rounded-pill bg-reward/15 px-3 py-1 text-[12.5px] font-black text-reward">
              새겨진 기록 {filled} / {FIRSTS.length}
            </span>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-card border border-border bg-card" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-card border border-border bg-card p-5 text-center">
          <p className="text-[14px] font-semibold text-muted-foreground">기록을 불러오지 못했어요</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 h-10 rounded-xl border border-border px-4 text-[13.5px] font-bold text-foreground active:scale-[0.98]"
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <>
          {renderSection("start")}

          {/* 대회의 역사 — 153복싱짐 첫 대회 우승·준우승 (2026-10-16 대표님) */}
          {data?.tournament && (
            <section className="space-y-2.5">
              <h3 className="px-1 text-[13px] font-black tracking-wide text-muted-foreground">대회의 역사</h3>
              {RECORD_153_TOURNAMENT.map((t) => {
                const holders = sortTournamentHolders(data.tournament!.holders.filter((h) => h.medal === t.medal));
                if (holders.length === 0) return null;
                return (
                  <TournamentCard
                    key={t.medal}
                    medal={t.medal}
                    title={t.title}
                    desc={t.desc}
                    event={data.tournament!.title}
                    eventDate={data.tournament!.event_date}
                    holders={holders}
                    onOpenMember={onOpenMember}
                  />
                );
              })}
            </section>
          )}

          {renderSection("level")}
          {renderSection("fitness")}

          {/* 153 체력테스트 종목별 신기록 — 계속 바뀌는 기록. 2026-10-15 대표님 '일단 보류' → SHOW_BESTS */}
          {SHOW_BESTS && (
          <section className="space-y-2.5">
            <div className="flex items-end justify-between px-1">
              <h3 className="text-[13px] font-black tracking-wide text-muted-foreground">종목별 신기록</h3>
              <span className="text-[11.5px] font-semibold text-muted-foreground">더 높은 기록이 나오면 바뀌어요</span>
            </div>
            <div className="overflow-hidden rounded-card border border-border bg-card">
              {(data?.bests ?? []).map((b, i) => (
                <div
                  key={b.code}
                  className={cn("flex min-h-[56px] items-center gap-3 px-4 py-2.5", i > 0 && "border-t border-border")}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold text-foreground">{b.title.replace(/\s*챌린지$/, "")}</p>
                    {b.user_id ? (
                      <button
                        type="button"
                        onClick={() => onOpenMember?.({ id: b.user_id!, nickname: b.nickname ?? "" })}
                        className="truncate text-left text-[12.5px] font-semibold text-muted-foreground"
                      >
                        {b.nickname}
                        {b.is_me && <span className="ml-1 font-black text-primary">· 내 기록</span>}
                      </button>
                    ) : (
                      <p className="text-[12.5px] font-semibold text-muted-foreground">첫 기록의 주인이 되세요</p>
                    )}
                  </div>
                  {b.value != null ? (
                    <span className="shrink-0 text-[17px] font-black tabular-nums text-reward">
                      {fmtNum(Number(b.value))}
                      <span className="ml-0.5 text-[12px] font-bold text-muted-foreground">{UNIT[b.metric ?? ""] ?? ""}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setArena({ open: true, code: b.code })}
                      className="h-9 shrink-0 rounded-pill bg-primary px-3.5 text-[12.5px] font-black text-primary-foreground active:scale-95"
                    >
                      도전
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setArena({ open: true, code: null })}
              className="h-12 w-full rounded-xl border border-border bg-card text-[14px] font-bold text-foreground active:scale-[0.98]"
            >
              💪 153 체력테스트 하러 가기
            </button>
          </section>
          )}
        </>
      )}

      <FunChallengeArenaSheet open={arena.open} initialCode={arena.code} onClose={closeArena} />
    </div>
  );
};

const RecordCard = ({
  no,
  emoji,
  title,
  desc,
  empty,
  rec,
  onOpenMember,
}: {
  no: number;
  emoji: string;
  title: string;
  desc: string;
  empty: string;
  rec: Record153First | null;
  onOpenMember?: (m: { id: string; nickname: string }) => void;
}) => {
  const numberLabel = `No.${String(no).padStart(3, "0")}`;
  if (!rec) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-dashed border-border bg-card/50 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-muted text-[22px] opacity-50">
          {emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black tracking-wider text-muted-foreground">{numberLabel}</p>
          <p className="text-[15px] font-black text-foreground">{title}</p>
          <p className="text-[12.5px] font-semibold text-muted-foreground">{empty || desc}</p>
        </div>
        <span className="flex shrink-0 flex-col items-center rounded-xl border border-dashed border-reward/50 px-2.5 py-1 leading-tight">
          <span className="text-[10.5px] font-bold text-muted-foreground">주인 없음</span>
          <span className="text-[12px] font-black text-reward">🎁 +{MILEAGE_LABEL}</span>
        </span>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-card border bg-gradient-to-b from-[#F6C453]/10 to-card p-4",
        rec.is_me ? "border-primary/60 shadow-glow-soft" : "border-[#F6C453]/40",
      )}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-pill bg-reward/15 text-[22px] ring-1 ring-[#F6C453]/40">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black tracking-wider text-reward">
          {numberLabel} · {title}
        </p>
        <button
          type="button"
          onClick={() => onOpenMember?.({ id: rec.user_id, nickname: rec.nickname })}
          className="block max-w-full truncate text-left text-[17px] font-black text-foreground"
        >
          {rec.nickname}
        </button>
        <p className="text-[12px] font-semibold text-muted-foreground">
          {fmtDate(rec.achieved_at)} · {desc}
        </p>
      </div>
      {rec.is_me && (
        <span className="shrink-0 rounded-pill bg-primary/15 px-2.5 py-1 text-[11.5px] font-black text-primary">내 기록</span>
      )}
    </div>
  );
};

/** 첫 대회 우승·준우승 — 한 칸에 수상자 여러 명. 가입한 회원은 이름을 누르면 라이센스 */
const TournamentCard = ({
  medal,
  title,
  desc,
  event,
  eventDate,
  holders,
  onOpenMember,
}: {
  medal: "gold" | "silver";
  title: string;
  desc: string;
  event: string;
  eventDate: string | null;
  holders: Record153TournamentHolder[];
  onOpenMember?: (m: { id: string; nickname: string }) => void;
}) => {
  const gold = medal === "gold";
  const mine = holders.some((h) => h.is_me);
  return (
    <div
      className={cn(
        "rounded-card border p-4",
        gold
          ? "border-[#F6C453]/40 bg-gradient-to-b from-[#F6C453]/10 to-card"
          : "border-slate-300/70 bg-gradient-to-b from-slate-300/20 to-card dark:border-slate-400/35 dark:from-slate-300/10",
        mine && "border-primary/60 shadow-glow-soft",
      )}
    >
      <div className="flex items-center gap-3">
        <MedalBadge kind={medal} className="h-12 w-12" glow title={`${title} 메달`} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-[11px] font-black tracking-wider",
              gold ? "text-reward" : "text-slate-500 dark:text-slate-300",
            )}
          >
            {event}
            {eventDate && ` · ${fmtDate(eventDate)}`}
          </p>
          <p className="text-[17px] font-black text-foreground">
            {title}
            <span className="ml-1.5 text-[13px] font-bold text-muted-foreground">{holders.length}명</span>
          </p>
          <p className="text-[12px] font-semibold text-muted-foreground">{desc}</p>
        </div>
        {mine && (
          <span className="shrink-0 rounded-pill bg-primary/15 px-2.5 py-1 text-[11.5px] font-black text-primary">내 기록</span>
        )}
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {holders.map((h) => {
          const inner = (
            <>
              <Avatar className="h-6 w-6 shrink-0">
                {h.avatar_url && <AvatarImage src={h.avatar_url} alt={h.name} className="object-cover" />}
                <AvatarFallback className="text-[11px] font-black">{h.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{h.name}</span>
              {h.staff && (
                <span className="rounded-pill bg-muted px-1.5 py-px text-[10.5px] font-bold text-muted-foreground">코치</span>
              )}
              {h.is_me && <span className="text-[11px] font-black text-primary">나</span>}
            </>
          );
          const cls = cn(
            "flex max-w-full items-center gap-1.5 rounded-pill border bg-card py-1 pl-1 pr-2.5 text-[13.5px] font-black text-foreground",
            h.is_me ? "border-primary/60" : "border-border",
          );
          return (
            <li key={`${h.medal}-${h.user_id ?? h.name}`} className="min-w-0">
              {h.user_id ? (
                <button
                  type="button"
                  onClick={() => onOpenMember?.({ id: h.user_id!, nickname: h.name })}
                  className={cn(cls, "active:scale-[0.97]")}
                >
                  {inner}
                </button>
              ) : (
                <span className={cls}>{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Record153Board;
