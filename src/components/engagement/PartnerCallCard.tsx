/**
 * 오늘 파트너 구하기 — 진입 카드.
 *
 * 복싱은 짝이 필요한 운동인데, 혼자 와서 샌드백만 치고 가는 회원이 가장 많다.
 * 오늘 같은 지점에 올라온 모집만 보여준다(하루 지나면 자동으로 사라진다).
 *
 * 보호 원칙:
 *   · 공식 1~40 레벨업과 무관 — XP·파이트머니 지급 0
 *   · 지점 격리는 서버(RPC/RLS)가 강제한다
 */

import { useState } from "react";
import { Handshake } from "lucide-react";

import { usePartnerCalls } from "@/hooks/useCommunityHub";
import PartnerCallSheet from "./PartnerCallSheet";

const PartnerCallCard = () => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = usePartnerCalls();

  const calls = data?.calls ?? [];
  const mine = calls.find((c) => c.isMine);
  const others = calls.filter((c) => !c.isMine).length;

  let title: string;
  let subtitle: string;
  if (isLoading) {
    title = "오늘 파트너";
    subtitle = "불러오는 중…";
  } else if (others > 0) {
    title = `오늘 ${others}명이 파트너를 찾고 있어요`;
    subtitle = "미트·줄넘기·같이 운동 — 눌러서 '저요' 하면 됩니다";
  } else if (mine) {
    title = "내 모집이 올라가 있어요";
    subtitle = `참여 ${mine.joinCount}명 — 아직 없으면 조금 기다려 주세요`;
  } else {
    title = "오늘 파트너 구하기";
    subtitle = "미트 잡아줄 사람이 필요한 날, 한 줄 올려두세요";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
        aria-label="오늘 파트너 구하기 열기"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Handshake className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            오늘 파트너 · 같은 지점
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {others > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
              {others}건
            </p>
          </div>
        )}
        <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">열기 →</span>
      </button>

      <PartnerCallSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default PartnerCallCard;
