/**
 * 중고 장비 나눔 — 진입 카드.
 *
 * 글러브·핸드랩·복싱화는 사이즈가 안 맞으면 못 쓴다. 회원마다 방치된 장비가 있고
 * 실수요가 확실해서 글을 쓸 이유가 분명하다(자유게시판과 다른 점).
 *
 * 운영 원칙: 금액은 앱에 적지 않는다. 주고받는 것은 데스크를 통한다.
 */

import { useState } from "react";
import { PackageOpen } from "lucide-react";

import { useGearPosts } from "@/hooks/useCommunityHub";
import { GEAR_LABEL } from "@/services/communityHubService";
import GearShareSheet from "./GearShareSheet";

const GearShareCard = () => {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useGearPosts();

  const posts = data?.posts ?? [];
  const others = posts.filter((p) => !p.isMine);

  let title: string;
  let subtitle: string;
  if (isLoading) {
    title = "장비 나눔";
    subtitle = "불러오는 중…";
  } else if (others.length > 0) {
    const kinds = [...new Set(others.slice(0, 3).map((p) => GEAR_LABEL[p.kind]))].join(" · ");
    title = `${others.length}건 올라와 있어요`;
    subtitle = `${kinds} — 필요한 게 있는지 보세요`;
  } else {
    title = "안 쓰는 장비 있으세요?";
    subtitle = "사이즈가 안 맞아 넣어둔 글러브, 필요한 사람이 있습니다";
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-3.5 py-3 text-left transition-all active:scale-[0.99] hover:border-primary/40"
        aria-label="중고 장비 나눔 열기"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <PackageOpen className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            장비 나눔 · 같은 지점
          </p>
          <p className="mt-0.5 truncate text-[13.5px] font-bold text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {others.length > 0 && (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-reward">
              {others.length}건
            </p>
          </div>
        )}
        <span className="ml-1 shrink-0 text-[11px] font-bold text-primary">열기 →</span>
      </button>

      <GearShareSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default GearShareCard;
