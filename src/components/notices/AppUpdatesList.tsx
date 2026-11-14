/**
 * 📣 공지사항 「앱 업데이트」 칸 (2026-11-15 선릉역점 봄 회원 제안 · 대표님 「공지사항 안 '앱 업데이트' 칸」 · 알림 없이 빨간 점만)
 *   날짜마다 묶은 카드 — 줄 = 「새」 · 「회원 제안」 + 제목 + 첫 줄(접힘) · 누르면 설명 1~3줄 + 「바로 보기」
 *   이 칸을 열면 지금 보이는 업데이트를 모두 본 것으로(빨간 점 꺼짐) — 「새」 표시는 이번에 보는 동안은 그대로.
 *   글 정본 = src/data/appUpdates.ts · 계산 = lib/appUpdates.ts · 본 것 = hooks/useAppUpdates.ts
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import { OsChip } from "@/components/os/OsParts";
import { useAppUpdates } from "@/hooks/useAppUpdates";
import { groupUpdatesByDate, resolveUpdateLink, updateDayLabel, type AppUpdate } from "@/lib/appUpdates";
import { kstToday } from "@/lib/attendanceCheer";
import { cn } from "@/lib/utils";

const NewChip = () => (
  <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-destructive/10 px-2 text-micro font-bold text-destructive">새</span>
);

function UpdateRow({ u, isNew, open, onToggle }: { u: AppUpdate; isNew: boolean; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const panelId = `app-update-${u.id}`;
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors active:bg-secondary/70"
      >
        <span className="min-w-0 flex-1">
          {(isNew || u.fromMember) && (
            <span className="mb-1 flex flex-wrap items-center gap-1">
              {isNew && <NewChip />}
              {u.fromMember && <OsChip tone="primary">회원 제안</OsChip>}
            </span>
          )}
          <span className="block break-keep text-body font-bold leading-snug text-foreground">{u.title}</span>
          {!open && <span className="mt-0.5 block truncate text-label text-muted-foreground">{u.lines[0]}</span>}
        </span>
        <ChevronDown
          className={cn("mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div id={panelId} className="px-4 pb-4">
          <ul className="space-y-1.5">
            {u.lines.map((l) => (
              <li key={l} className="flex gap-2 break-keep text-body leading-snug text-foreground">
                <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                <span className="min-w-0">{l}</span>
              </li>
            ))}
          </ul>
          {u.link && (
            <button
              type="button"
              onClick={() => navigate(resolveUpdateLink(u.link!.to, kstToday()))}
              className="mt-3 inline-flex h-10 items-center gap-0.5 rounded-xl bg-secondary px-3.5 text-label font-bold text-foreground transition-transform active:scale-[0.98]"
            >
              {u.link.label}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export default function AppUpdatesList() {
  const navigate = useNavigate();
  const { updates, newBadges, markAllSeen } = useAppUpdates();
  // 「새」 표시는 이 칸을 연 순간 기준 — 열자마자 본 것으로 남겨도 이번에 보는 동안은 그대로
  //   (이 기기에서 처음 열면 가장 최근 날짜만 — lib newBadgeIds)
  const [newIds] = useState(() => new Set(newBadges));
  const [openId, setOpenId] = useState<string | null>(() => updates[0]?.id ?? null);

  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  const groups = groupUpdatesByDate(updates);
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.date} aria-label={updateDayLabel(g.date)}>
          <h2 className="mb-2 px-1 text-label font-bold text-muted-foreground">{updateDayLabel(g.date)}</h2>
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-card shadow-elev-1">
            {g.items.map((u) => (
              <UpdateRow
                key={u.id}
                u={u}
                isNew={newIds.has(u.id)}
                open={openId === u.id}
                onToggle={() => setOpenId((cur) => (cur === u.id ? null : u.id))}
              />
            ))}
          </ul>
        </section>
      ))}
      {/* 회원님 목소리가 앱을 바꾼다 — 제안 보내기(오류 신고 화면의 '제안') */}
      <button
        type="button"
        onClick={() => navigate("/feedback?cat=제안")}
        className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-left shadow-elev-1 transition-colors active:bg-secondary/70"
      >
        <Lightbulb className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-foreground">이런 기능이 있으면 좋겠어요</span>
          <span className="block text-label text-muted-foreground">제안을 보내 주시면 업데이트에 담아요</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
    </div>
  );
}
