/**
 * 라이브보드 TV 2번 왼쪽 큰 칸 — 두 탭 「마이복서153」 ↔ 「체육관 공지사항」 1분씩 번갈아 (2026-11-26 대표님 「우리 런칭이벤트 했던
 * 사이니지 모니터에 체육관 공지사항 탭하나 만들자 … 총 3개정도만 돌아가게」)
 *
 *   짝수 분 = 가치 전달 장면 하나(AppValueReel — 이 칸이 시계를 주고 장면은 두 분에 하나씩) · 홀수 분 = 공지(GymNoticeBoard — 1분 안에서 차례로).
 *   시간 계산은 lib/gymNotices.ts(tv2TurnAt · 시계 기준이라 TV 를 껐다 켜도 같은 화면) · 공지 글은 data/gymNotices.ts.
 *   그 지점 공지가 없으면 예전 그대로 — AppValueReel 이 자기 시계로 1분마다(머리도 예전 「마이복서153」 그대로).
 */
import { useEffect, useMemo, useState } from "react";

import AppValueReel from "@/components/liveBoard/AppValueReel";
import GymNoticeBoard from "@/components/liveBoard/GymNoticeBoard";
import { kstToday } from "@/lib/attendanceCheer";
import type { MileageRules } from "@/lib/appValueReel";
import { gymNoticesFor, msToNextTurn, tv2TurnAt } from "@/lib/gymNotices";

interface Props {
  branchName: string;
  /** 수상자 축하가 읽은 마일리지 규칙 — 가치 전달의 예비 값 */
  awardsRules?: MileageRules | null;
}

const Tv2Tabs = ({ branchName, awardsRules = null }: Props) => {
  const [now, setNow] = useState(() => Date.now());
  const today = kstToday(now);
  const notices = useMemo(() => gymNoticesFor(branchName, today), [branchName, today]);
  const count = notices.length;

  // 화면이 바뀌는 순간마다(분이 바뀔 때 · 공지가 넘어갈 때) 다시 그린다 — 공지가 없으면 AppValueReel 이 자기 시계로
  useEffect(() => {
    if (!count) return;
    let t = 0;
    const schedule = () => {
      t = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, msToNextTurn(Date.now(), count) + 40);
    };
    schedule();
    return () => window.clearTimeout(t);
  }, [count]);

  if (!count) return <AppValueReel branchName={branchName} awardsRules={awardsRules} />;

  const turn = tv2TurnAt(now, count);
  if (turn.tab === "value") {
    return <AppValueReel branchName={branchName} awardsRules={awardsRules} tabs={{ now, pace: 2 }} />;
  }
  const notice = notices[turn.index];
  return (
    <GymNoticeBoard
      key={`${notice.id}:${turn.startedAt}`}
      notice={notice}
      index={turn.index}
      total={count}
      startedAt={turn.startedAt}
      ms={turn.ms}
    />
  );
};

export default Tv2Tabs;
