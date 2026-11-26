/**
 * 📊 코치 매일 리포트 · 오늘 미션 — 지도자 홈 맨 위 칸 (2026-11-26 대표님 「추천대로 진행하자」 · 선릉역점)
 *   코치 = 어제 지점 · 내 시간 숫자 + 오늘 미션 최대 3개(단추를 누르면 지도자 홈 기록이 남고 완료).
 *   관장 · 관리자 = 코치님별 오늘 미션 · 알림 미리보기. 12/1 전에는 관리자 미리보기만(코치님 화면 · 알림 없음).
 *   글 · 계산 = lib/coachDaily.ts · 데이터 = services/coachDailyService.ts
 */
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Check, ChevronDown, ChevronRight } from "lucide-react";

import { openMemberCard } from "@/lib/appEvents";
import {
  PILOT_NOTE,
  branchLine,
  kstMdHm,
  manualLink,
  mdDow,
  mineLine,
  missionActions,
  missionChips,
  missionName,
  missionProgress,
  missionSay,
  missionTitle,
  monthLine,
  notifyPreview,
  type CoachDailyData,
  type CoachMission,
  type DailyTeamRow,
  type MissionAction,
} from "@/lib/coachDaily";
import { cn } from "@/lib/utils";

const Chip = ({ warn = false, children }: { warn?: boolean; children: ReactNode }) => (
  <span
    className={cn(
      "rounded-md px-1.5 py-0.5 text-micro font-black",
      warn ? "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200" : "bg-secondary text-foreground",
    )}
  >
    {children}
  </span>
);

const pill = (strong: boolean) =>
  cn(
    "inline-flex h-9 items-center gap-1 rounded-full px-3 text-label font-bold active:scale-95 disabled:opacity-50",
    strong ? "bg-foreground text-background" : "bg-secondary text-foreground",
  );

interface RowProps {
  m: CoachMission;
  url: string | null;
  busy: boolean;
  onAction?: (m: CoachMission, a: MissionAction) => void;
}

const MissionRow = ({ m, url, busy, onAction }: RowProps) => {
  const link = manualLink(m);
  const isManual = m.kind === "manual";
  const name = missionName(m);
  return (
    <li className="flex items-start gap-3 py-3">
      <span
        className={cn(
          "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-micro font-black",
          m.done ? "bg-emerald-500 text-white" : "bg-secondary text-foreground",
        )}
        aria-label={m.done ? "완료" : `미션 ${m.rank}`}
      >
        {m.done ? <Check className="h-3.5 w-3.5" aria-hidden /> : m.rank}
      </span>
      <div className="min-w-0 flex-1">
        {isManual ? (
          <p className="flex items-center gap-1.5 text-body font-black text-foreground">
            <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{missionTitle(m)}</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => m.member && openMemberCard(m.member)}
            className="flex w-full min-w-0 items-center gap-2 text-left active:opacity-70"
            aria-label={`${name}님 카드 열기`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-label font-black text-muted-foreground">
              {url ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" /> : name.slice(0, 1)}
            </span>
            <span className="truncate text-body font-black text-foreground">{name}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {!isManual && <Chip warn={m.kind !== "first"}>{missionTitle(m)}</Chip>}
          {missionChips(m).map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
        <p className="mt-1 text-label font-bold leading-snug text-foreground">{missionSay(m)}</p>
        {m.done ? (
          <p className="mt-1 flex items-center gap-1 text-label font-bold text-emerald-700 dark:text-emerald-300">
            <Check className="h-4 w-4" aria-hidden />
            {isManual ? "오늘 서명했어요" : "오늘 기록했어요"}
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {missionActions(m).map((a) => (
              <button key={a.kind} type="button" disabled={busy} onClick={() => onAction?.(m, a)} className={pill(a.strong)}>
                {a.label}
              </button>
            ))}
            {link && (
              <Link to={link} className={pill(true)}>
                읽으러 가기
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

const TeamRow = ({ t, data }: { t: DailyTeamRow; data: CoachDailyData }) => {
  const [open, setOpen] = useState(false);
  const note = notifyPreview(data.branch, data.stats, data.month, t.mine, t.total);
  return (
    <li className="py-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="min-w-0 truncate text-label">
          <span className="font-black text-foreground">{t.name}</span>
          {t.today && <span className="text-muted-foreground"> · {t.today}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-label tabular-nums text-muted-foreground">
          {t.mine?.worked ? `어제 ${t.mine.visitors}명` : "어제 근무 없음"} · 미션 {t.done}/{t.total}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg bg-secondary/60 p-2.5">
          <p className="text-micro font-bold text-muted-foreground">{t.sent ? "보낸 알림" : "알림 미리보기"}</p>
          <p className="mt-0.5 text-label font-black text-foreground">{note.title}</p>
          <p className="text-label text-foreground">{note.body}</p>
          {t.mine && t.mine.home > 0 && <p className="mt-1 text-micro text-muted-foreground">최근 4주 내 시간 회원 {t.mine.home}명</p>}
          <ol className="mt-2 space-y-1">
            {t.missions.map((m) => (
              <li key={m.id} className="flex items-start gap-1.5 text-label text-foreground">
                <span className="shrink-0 font-black tabular-nums">{m.done ? "✓" : `${m.rank}.`}</span>
                <span className="min-w-0">
                  {m.kind === "manual" ? missionTitle(m) : `${missionName(m)} · ${missionTitle(m)}`}
                  <span className="block text-micro text-muted-foreground">{missionSay(m)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </li>
  );
};

export interface CoachDailyCardProps {
  data: CoachDailyData;
  photoUrls?: Record<string, string>;
  busyMember?: string | null;
  onAction?: (m: CoachMission, a: MissionAction) => void;
  className?: string;
}

export const CoachDailyCard = ({ data, photoUrls = {}, busyMember = null, onAction, className }: CoachDailyCardProps) => {
  const prog = missionProgress(data.missions);
  const lines = [branchLine(data.stats, data.branch), data.hasMine ? mineLine(data.mine) : null, monthLine(data.month)].filter(
    (l): l is string => !!l,
  );
  const urlOf = (m: CoachMission) => (m.photoPath ? photoUrls[m.photoPath] : undefined) ?? m.avatarUrl ?? null;
  const showMine = data.hasMine || data.role === "coach";

  return (
    <div className={cn("rounded-xl border border-border bg-background p-3.5", className)} aria-label="코치 매일 리포트">
      {data.preview && (
        <p className="mb-3 rounded-lg bg-amber-100 px-3 py-2 text-label font-bold leading-snug text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
          미리보기 · {mdDow(data.startDate)}부터 코치님께 매일 06:40 알림이 가요. 지금은 대표님만 보여요.
        </p>
      )}
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-body font-black text-foreground">{showMine ? "오늘 미션" : "어제 숫자 · 오늘 미션"}</h3>
        {showMine && prog.total > 0 && (
          <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-micro font-black tabular-nums text-foreground">
            {prog.done}/{prog.total} 완료
          </span>
        )}
      </div>
      {data.hasMine && data.todayLabel && <p className="text-label text-muted-foreground">오늘 근무 {data.todayLabel}</p>}
      {lines.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {lines.map((l) => (
            <p key={l} className="text-label leading-snug text-foreground">
              {l}
            </p>
          ))}
        </div>
      )}

      {showMine &&
        (data.missions.length > 0 ? (
          <ol className="mt-1 divide-y divide-border">
            {data.missions.map((m) => (
              <MissionRow key={m.id} m={m} url={urlOf(m)} busy={!!busyMember && busyMember === m.member} onAction={onAction} />
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-label text-muted-foreground">{data.hasMine ? "오늘은 미션이 없어요" : "오늘은 근무가 없는 날이에요"}</p>
        ))}

      {data.team && (
        <div className={cn(showMine && "mt-3 border-t border-border pt-3", !showMine && "mt-2")}>
          <h4 className="text-label font-black text-foreground">코치님별 오늘</h4>
          {data.team.length === 0 ? (
            <p className="mt-1 text-label text-muted-foreground">오늘 근무하는 코치님 리포트가 아직 없어요 · 매일 06:40에 만들어요</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.team.map((t) => (
                <TeamRow key={t.coach} t={t} data={data} />
              ))}
            </ul>
          )}
          {data.lastRun?.ranAt && (
            <p className={cn("mt-1 text-micro", data.lastRun.error ? "font-bold text-red-600" : "text-muted-foreground")}>
              마지막 실행 {kstMdHm(data.lastRun.ranAt)}
              {data.lastRun.error ? " · 오류가 있었어요" : ""}
            </p>
          )}
        </div>
      )}
      <p className="mt-2 text-micro text-muted-foreground">{PILOT_NOTE}</p>
    </div>
  );
};

export default CoachDailyCard;
