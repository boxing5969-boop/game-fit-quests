/**
 * 같은 시간대 팀 — 정보 카드 (시트 없음).
 *
 * 아침 7시 회원과 저녁 9시 회원은 서로를 모른다. 같은 시간에 오는 사람끼리
 * 얼굴을 알면 출석이 습관으로 굳는다. 회원이 할 일은 없다 —
 * 최근 60일 출석 시각으로 서버가 자동 계산한다.
 *
 * 카드가 버튼이 아닌 이유: 누를 곳이 없는 '읽는 정보'다.
 * (모든 카드를 버튼으로 만들면 눌러도 아무 일이 없어 신뢰를 잃는다)
 */

import { Clock } from "lucide-react";

import { useTimeCrew } from "@/hooks/useCommunityHub";
import { SLOT_LABEL, SLOT_ORDER, SLOT_SHORT } from "@/services/communityHubService";

const TimeCrewCard = () => {
  const { data, isLoading } = useTimeCrew();

  // 출석 기록이 없으면 보여줄 게 없다 — 카드를 감춘다
  if (!isLoading && (!data || !data.slot)) return null;

  const slot = data?.slot ?? null;
  const crew = data?.crewCount ?? 0;
  const members = data?.members ?? [];
  const slots = data?.slots ?? [];
  const max = slots.reduce((m, s) => Math.max(m, s.count), 0);

  const names = members.slice(0, 3).map((m) => m.nickname);
  const rest = Math.max(crew - names.length, 0);

  return (
    <div className="rounded-card border border-border bg-card px-3.5 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Clock className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            같은 시간대 · 자동 계산
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">
            {isLoading
              ? "시간대를 보는 중…"
              : slot
                ? `회원님은 ${SLOT_SHORT[slot]} 팀이에요`
                : "시간대"}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {isLoading
              ? " "
              : crew > 0
                ? `이 시간대에 ${crew}명이 더 옵니다 · ${SLOT_LABEL[slot!]}`
                : `${SLOT_LABEL[slot!]} — 아직 이 시간대는 회원님뿐이에요`}
          </p>
        </div>
      </div>

      {!isLoading && names.length > 0 && (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          자주 마주치는 분{" "}
          <b className="font-bold text-foreground">{names.join(" · ")}</b>
          {rest > 0 && ` 그 밖에 ${rest}명`}
        </p>
      )}

      {!isLoading && slots.length > 0 && max > 0 && (
        <div className="mt-3 flex items-end gap-1.5">
          {SLOT_ORDER.map((k) => {
            const found = slots.find((s) => s.slot === k);
            const n = found?.count ?? 0;
            const h = n === 0 ? 3 : Math.max(4, Math.round((n / max) * 28));
            const isMine = k === slot;
            return (
              <div key={k} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div
                  className={`w-full rounded-sm ${isMine ? "bg-primary" : "bg-muted"}`}
                  style={{ height: `${h}px` }}
                  aria-hidden="true"
                />
                <span
                  className={`truncate text-[9.5px] font-bold ${
                    isMine ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {SLOT_SHORT[k]}
                </span>
              </div>
            );
          })}
        </div>
      )}
      {!isLoading && slots.length > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          최근 60일 출석 기준 · 같은 지점 회원 분포
        </p>
      )}
    </div>
  );
};

export default TimeCrewCard;
