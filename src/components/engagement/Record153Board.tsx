/**
 * 153 레코드 탭 (랭킹 화면의 세 번째 탭) — 2026-10-15 대표님:
 * "세계적 기업이 될 153복싱짐의 역사적인 순간 기록을 보유하세요 — 최초 가입자 · 최초 레벨 10 ·
 *  최초 레벨 11 · 153 체력테스트 최초 기록 보유자 등등"
 *   · 최초 기록은 한 번 새겨지면 바뀌지 않는다 (DB records_153)
 *   · 비어 있는 기록은 '아직 주인 없음' — 누가 처음이 될지 보이게
 *   · 153 체력테스트 = 챌린지 아레나 체력 종목. 종목별 신기록은 계속 바뀐다.
 */
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";
import FunChallengeArenaSheet from "@/components/engagement/FunChallengeArenaSheet";
import { RECORDS_153_KEY, useRecords153, type Record153First } from "@/services/records153Service";

type Section = "start" | "level" | "fitness";

const FIRSTS: Array<{ key: string; section: Section; emoji: string; title: string; desc: string; empty: string }> = [
  { key: "first_signup", section: "start", emoji: "🥇", title: "최초 가입자", desc: "마이복서153에 가장 먼저 이름을 올린 회원", empty: "" },
  { key: "first_checkin", section: "start", emoji: "🚪", title: "최초 출석", desc: "기록에 남은 153의 첫 출석", empty: "" },
  { key: "first_100_checkins", section: "start", emoji: "💯", title: "최초 출석 100회", desc: "가장 먼저 100번 출석한 회원", empty: "100번째 출석을 가장 먼저 찍는 회원이 주인이 돼요" },
  { key: "first_journal", section: "start", emoji: "✍️", title: "최초 커뮤니티 글", desc: "153 커뮤니티에 처음 글을 남긴 회원", empty: "커뮤니티에 처음 글을 쓰는 회원이 주인이 돼요" },
  { key: "first_handwrap", section: "start", emoji: "🩹", title: "최초 붕대 감기 연습", desc: "집에서 붕대 감기를 처음 해 본 회원", empty: "붕대 감기 연습을 처음 하는 회원이 주인이 돼요" },
  { key: "first_lv10", section: "level", emoji: "🔟", title: "최초 레벨 10", desc: "화이트 리그 끝까지 가장 먼저 오른 회원", empty: "레벨 10에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv11", section: "level", emoji: "🔵", title: "최초 레벨 11", desc: "블루 리그 첫 입성", empty: "블루 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv21", section: "level", emoji: "🔴", title: "최초 레벨 21", desc: "레드 리그 첫 입성", empty: "레드 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_lv31", section: "level", emoji: "⚫", title: "최초 레벨 31", desc: "블랙 리그 첫 입성", empty: "블랙 리그에 가장 먼저 오르는 회원이 주인이 돼요" },
  { key: "first_fitness", section: "fitness", emoji: "💪", title: "최초 체력테스트 기록", desc: "153 체력테스트에 처음 기록을 남긴 회원", empty: "아레나에서 첫 기록을 남기면 바로 주인이 돼요" },
];

const SECTION_TITLE: Record<Section, string> = {
  start: "153의 첫 페이지",
  level: "레벨의 역사",
  fitness: "153 체력테스트",
};

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
          {renderSection("level")}
          {renderSection("fitness")}

          {/* 153 체력테스트 종목별 신기록 — 계속 바뀌는 기록 */}
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
        <span className="shrink-0 rounded-pill border border-dashed border-border px-2.5 py-1 text-[11.5px] font-black text-muted-foreground">
          주인 없음
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

export default Record153Board;
