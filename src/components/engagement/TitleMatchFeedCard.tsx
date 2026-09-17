/**
 * 타이틀매치 축하 피드 — 진입 카드.
 *
 * 이 카드의 핵심은 "회원이 글을 쓰지 않아도 콘텐츠가 생긴다"는 점이다.
 * 승급 기록(level_status_history)을 읽어 자동으로 채워지므로
 * 빈 게시판이 되지 않는다. 최근 30일 · 같은 지점만.
 *
 * 보호 원칙: 승급 기록을 읽기만 한다. 레벨·보상을 건드리지 않는다.
 */

import { useState } from "react";
import { Trophy } from "lucide-react";

import { useTitleMatchFeed } from "@/hooks/useCommunityHub";
import TitleMatchFeedSheet from "./TitleMatchFeedSheet";

const TitleMatchFeedCard = () => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useTitleMatchFeed();

  const items = data?.items ?? [];
  const latest = items[0];
  const unclapped = items.filter((i) => !i.isMine && !i.clapped).length;

  let title: string;
  let subtitle: string;
  if (isLoading) {
    title = "타이틀매치";
    subtitle = "불러오는 중…";
  } else if (latest) {
    title = latest.isMine
      ? `축하합니다 — 레벨 ${latest.globalLevel} 통과!`
      : `${latest.nickname} 님이 레벨 ${latest.globalLevel} 통과`;
    subtitle =
      unclapped > 0
        ? `박수를 기다리는 동료 ${unclapped}명`
        : "최근 30일 통과한 동료를 볼 수 있어요";
  } else {
    title = "아직 첫 통과자가 없습니다";
    subtitle = "레벨 10을 통과하면 여기에 올라갑니다";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
        aria-label="타이틀매치 축하 피드 열기"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-reward/15 text-reward">
          <Trophy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-reward">
            타이틀매치 · 축하
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {unclapped > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
              👏 {unclapped}
            </p>
          </div>
        )}
        <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">열기 →</span>
      </button>

      <TitleMatchFeedSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default TitleMatchFeedCard;
