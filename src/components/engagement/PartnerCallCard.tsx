/**
 * 오늘 같이 해요 — 커뮤니티 맨 위 카드 (2026-10-28 운동 모집 1단계 — 대표님 "추천대로" · 보고서 「쓰이게 만드는 법」 3번 '이미 보는 곳에 걸기').
 *
 * 오늘 모집이 있을 때만 보인다(화면 규칙 ③ 빈 것은 그리지 않기). 첫 모집의 사진 · 이름 · 시간 · 종류에 바로 '저요'.
 * 카드를 누르면 시트 — onOpen 을 주면 부모(커뮤니티 화면)의 시트를, 없으면 자기 시트를 연다.
 *
 * 보호 원칙:
 *   · 공식 1~40 레벨업과 무관 — XP·챔피언머니 지급 0
 *   · 지점 격리는 서버(RPC/RLS)가 강제한다
 */

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { usePartnerCallActions, usePartnerCalls } from "@/hooks/useCommunityHub";
import { formatHour } from "@/lib/partnerCallTime";
import { PURPOSE_LABEL } from "@/services/communityHubService";
import PartnerCallSheet, { PartnerFace } from "./PartnerCallSheet";

interface Props {
  /** 부모가 가진 시트를 연다 (커뮤니티 화면) */
  onOpen?: () => void;
}

const PartnerCallCard = ({ onOpen }: Props) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data } = usePartnerCalls();
  const { join } = usePartnerCallActions();

  const calls = data?.calls ?? [];
  const sheet = onOpen ? null : <PartnerCallSheet open={open} onClose={() => setOpen(false)} />;
  if (calls.length === 0) return sheet;

  const myBranch = data?.branch ?? null;
  const allBranches = data?.all_branches === true;
  const joinable = (c: (typeof calls)[number]) => !c.isMine && !c.joined && (!allBranches || c.branch === myBranch);
  // 맨 앞: 내가 저요할 수 있는 모집 → 남의 모집 → 내 모집
  const first = calls.find(joinable) ?? calls.find((c) => !c.isMine) ?? calls[0];
  const openSheet = () => (onOpen ? onOpen() : setOpen(true));

  const doJoin = async () => {
    setBusy(true);
    try {
      await join.mutateAsync(first.id);
      toast.success(`저요 했어요 — ${formatHour(first.slotHour)}에 만나요`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "참여하지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-primary/30 bg-card p-4" aria-label="오늘 같이 해요">
        <button type="button" onClick={openSheet} className="flex w-full items-center justify-between gap-2">
          <span className="text-label font-bold text-primary">오늘 같이 해요</span>
          <span className="flex items-center text-label font-semibold text-muted-foreground">
            {calls.length > 1 ? `${calls.length}건 모두 보기` : "자세히"}
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={openSheet} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <PartnerFace name={first.nickname} url={first.avatarUrl} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-body font-bold text-foreground">{first.isMine ? "내 모집" : first.nickname}</span>
                {first.isStaff && (
                  <span className="shrink-0 rounded-pill bg-primary/10 px-2 py-0.5 text-micro font-bold text-primary">
                    {first.staffTitle || "코치"}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-label text-muted-foreground">
                {formatHour(first.slotHour)} · {PURPOSE_LABEL[first.purpose]}
                {first.joinCount > 0 ? ` · 저요 ${first.joinCount}명` : ""}
              </span>
            </span>
          </button>
          {joinable(first) ? (
            <button
              type="button"
              disabled={busy}
              onClick={doJoin}
              className="inline-flex min-h-[40px] shrink-0 items-center rounded-pill bg-primary px-4 text-label font-bold text-primary-foreground active:scale-95 disabled:opacity-60"
            >
              저요
            </button>
          ) : first.joined ? (
            <span className="shrink-0 text-label font-bold text-primary">저요 했어요</span>
          ) : null}
        </div>
      </section>

      {sheet}
    </>
  );
};

export default PartnerCallCard;
