/**
 * 📅 153운영본부 「일정」 탭 맨 아래 — 휴대폰 캘린더 (2026-11-13 캘린더 3-1단계 · 대표님 「추천대로 3-1부터」)
 *   ① 휴대폰 캘린더에서 보기 — 내 일정 · 근무 시간표 · 153 일정 · 정기 회의가 아이폰 · 구글 캘린더에 저절로(구독 주소)
 *   ② 휴대폰 캘린더 가져오기 — .ics 파일 → 내 일정
 *   ①은 서버 함수가 없으면(DB 적용 전) 숨긴다. 시트는 누를 때 받는다.
 */
import { lazy, Suspense, useState } from "react";
import { CalendarCheck, ChevronRight, FileUp } from "lucide-react";

import { fetchedAgo } from "@/lib/calendarFeed";
import type { OpsPlan } from "@/lib/opsPlans";
import { useCalendarFeed } from "@/services/calendarFeedService";

const CalendarFeedSheet = lazy(() => import("@/components/calendar/CalendarFeedSheet"));
const OpsIcsImportSheet = lazy(() => import("./OpsIcsImportSheet"));

/** 그리기만 — 화면 확인 · 시험용 */
export const OpsPhoneCalendarView = ({
  feedLine,
  onFeed,
  onImport,
}: {
  /** 구독 줄 아래 글 — null 이면 구독 줄을 그리지 않는다 */
  feedLine: string | null;
  onFeed: () => void;
  onImport: () => void;
}) => (
  <section className="rounded-2xl border border-border bg-card px-5 pb-2 pt-5" aria-label="휴대폰 캘린더">
    <h2 className="text-heading font-black text-foreground">휴대폰 캘린더</h2>
    <ul className="mt-1 divide-y divide-border">
      {feedLine != null && (
        <li>
          <button type="button" onClick={onFeed} className="flex w-full items-center gap-3 py-3 text-left active:bg-secondary/60">
            <CalendarCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-bold text-foreground">휴대폰 캘린더에서 보기</span>
              <span className="block truncate text-label text-muted-foreground">{feedLine}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
      )}
      <li>
        <button type="button" onClick={onImport} className="flex w-full items-center gap-3 py-3 text-left active:bg-secondary/60">
          <FileUp className="h-5 w-5 shrink-0 text-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-body font-bold text-foreground">휴대폰 캘린더 가져오기</span>
            <span className="block truncate text-label text-muted-foreground">.ics 파일에 있는 일정을 내 일정으로</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </li>
    </ul>
  </section>
);

const OpsPhoneCalendar = ({ branch, me, today, plans }: { branch: string; me: string; today: string; plans: OpsPlan[] }) => {
  const q = useCalendarFeed("staff");
  const [sheet, setSheet] = useState<"feed" | "import" | null>(null);
  const [mounted, setMounted] = useState({ feed: false, import: false });
  const open = (k: "feed" | "import") => {
    setMounted((m) => (m[k] ? m : { ...m, [k]: true }));
    setSheet(k);
  };
  const st = q.data;
  const ago = st?.on ? fetchedAgo(st.lastFetchedAt) : null;
  const feedLine = !st || !st.available || !st.can ? null : st.on ? (ago ? `연결됨 · 캘린더가 ${ago === "방금" ? ago : `${ago}에`} 읽어 감` : "주소를 만들었어요 · 캘린더에 넣어 주세요") : "내 일정 · 근무 · 153 일정이 휴대폰에 저절로";
  return (
    <>
      <OpsPhoneCalendarView feedLine={feedLine} onFeed={() => open("feed")} onImport={() => open("import")} />
      {mounted.feed && (
        <Suspense fallback={null}>
          <CalendarFeedSheet open={sheet === "feed"} onOpenChange={(v) => setSheet(v ? "feed" : null)} kind="staff" />
        </Suspense>
      )}
      {mounted.import && (
        <Suspense fallback={null}>
          <OpsIcsImportSheet open={sheet === "import"} onClose={() => setSheet(null)} branch={branch} me={me} today={today} plans={plans} />
        </Suspense>
      )}
    </>
  );
};

export default OpsPhoneCalendar;
