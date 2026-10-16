/**
 * 지금 운동 중 — 랭킹 탭 맨 위 · 커뮤니티 '오늘 같이 해요' (2026-10-16 대표님)
 *   "마이복서 153랭킹 탭에서 현재 운동중인 회원 확인할수있게 해줘~"
 *   "클릭하면 전체화면으로 보이게해주고 회원이름클릭하면 상세 정보 볼수있게해줘"
 *   "오늘 같이해요는 회원 리스트가 안나오는데"
 *
 *   · 기준은 체육관 TV 와 같다: 앱 운동 세션이 켜져 있거나(60분) 오늘 출석 후 120분 안 · 코치님 제외
 *   · 내정보 '출석하면 커뮤니티에 알리기'를 끈 회원은 다른 회원에게 안 보인다 (본인·본사는 보임)
 *   · DB get_working_out_now — 회원은 자기 지점 고정, 본사는 고른 지점 / 전 지점(켜 둔 지점만)
 *   · 카드를 누르면 전체화면 · 회원을 누르면 지점장·본사는 회원 상세 정보, 그 밖에는 라이센스
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Maximize2, X } from "lucide-react";

import NameBadge from "@/components/badges/NameBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { shortBranchName } from "@/services/communityHubService";

export interface WorkingOutMember {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  league: string;
  /** 누적 레벨 1~40 */
  level: number;
  /** 앱 운동 시작 시각, 없으면 오늘 마지막 출석 시각 */
  since: string;
  /** 지금 운동 중인 지점 */
  branch: string | null;
  is_me: boolean;
}

interface WorkingOutNowData {
  branch: string | null;
  all_branches: boolean;
  members: WorkingOutMember[];
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkingOutNow(branch: string | null, enabled = true) {
  return useQuery({
    queryKey: ["working-out-now", branch ?? "__all__"],
    queryFn: async (): Promise<WorkingOutNowData> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: raw, error } = await (supabase as any).rpc("get_working_out_now", { p_branch: branch });
      if (error) throw error;
      const d = (raw ?? {}) as Partial<WorkingOutNowData>;
      return {
        branch: typeof d.branch === "string" ? d.branch : null,
        all_branches: d.all_branches === true,
        members: Array.isArray(d.members) ? d.members : [],
      };
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** 'N분째' 를 1분마다 새로 센다 */
function useMinuteNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);
  return now;
}

const minutesLabel = (since: string, now: number) => {
  const mins = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  return mins < 1 ? "방금" : `${mins}분째`;
};

const LiveDot = ({ on, size = "h-2.5 w-2.5" }: { on: boolean; size?: string }) => (
  <span className={cn("relative flex shrink-0", size)}>
    {on && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />}
    <span className={cn("relative inline-flex rounded-full", size, on ? "bg-emerald-500" : "bg-muted-foreground/40")} />
  </span>
);

const Avatar = ({ m, size }: { m: WorkingOutMember; size: "md" | "lg" }) => (
  <span className="relative">
    <span
      className={cn(
        "flex items-center justify-center overflow-hidden rounded-pill bg-secondary font-black text-secondary-foreground",
        size === "lg" ? "h-16 w-16 text-[22px]" : "h-11 w-11 text-[16px]",
      )}
    >
      {m.avatar_url ? (
        <img src={m.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        m.nickname.slice(0, 1)
      )}
    </span>
    <span
      className={cn(
        "absolute rounded-full border-2 border-card bg-emerald-500",
        size === "lg" ? "bottom-0 right-0 h-4 w-4" : "-bottom-0.5 -right-0.5 h-3 w-3",
      )}
    />
  </span>
);

interface CardProps {
  /** 본사가 고른 지점 (null = 전 지점). 회원은 서버가 자기 지점으로 고정한다 */
  branch: string | null;
  /** 이름을 눌렀을 때 — 라이센스 열기 (지점장·본사는 회원 상세 정보로 바로 간다) */
  onOpenMember: (m: { id: string; nickname: string }) => void;
  title?: string;
  emptyText?: string;
}

const WorkingOutNowCard = ({
  branch,
  onOpenMember,
  title = "지금 운동 중",
  emptyText = "지금은 운동 중인 회원이 없어요. 출석하면 여기에 떠요",
}: CardProps) => {
  const navigate = useNavigate();
  const { role } = useAuth();
  // 회원 상세로 바로 가는 사람 — 라이센스의 '회원 상세 · 출석 · 메모' 버튼과 같은 기준 (지점장·관리자·전체관리자)
  const manager = role === "branch_manager" || role === "admin" || role === "super_admin";
  const { data } = useWorkingOutNow(branch);
  const now = useMinuteNow();
  const [full, setFull] = useState(false);

  if (!data) return null;
  const list = data.members;
  const scope = data.all_branches ? "전 지점" : data.branch ? shortBranchName(data.branch) : "";

  // 지점장·본사 = 회원 상세 정보 · 그 밖 = 라이센스
  const openMember = (m: WorkingOutMember) => {
    if (manager) {
      setFull(false);
      navigate(`/manager/member/${m.user_id}`);
    } else {
      onOpenMember({ id: m.user_id, nickname: m.nickname });
    }
  };

  return (
    <>
      <section
        onClick={() => setFull(true)}
        className="cursor-pointer rounded-card border border-emerald-500/30 bg-gradient-to-b from-emerald-500/10 to-card p-3.5"
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFull(true);
          }}
          className="flex w-full items-center gap-2 text-left"
          aria-label={`${title} 크게 보기`}
        >
          <LiveDot on={list.length > 0} />
          <span className="text-[15px] font-black text-foreground">{title}</span>
          <span className="number-font text-[15px] font-black text-emerald-600 dark:text-emerald-400">
            {list.length}
            <span className="ml-0.5 text-[12px]">명</span>
          </span>
          {scope && <span className="truncate text-[12px] font-bold text-muted-foreground">· {scope}</span>}
          <span className="ml-auto flex shrink-0 items-center gap-1 text-[12px] font-bold text-muted-foreground">
            크게 보기
            <Maximize2 className="h-3.5 w-3.5" />
          </span>
        </button>

        {list.length > 0 ? (
          <div className="-mx-3.5 mt-2.5 flex gap-2 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {list.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openMember(m);
                }}
                className={cn(
                  "flex w-[4.75rem] shrink-0 flex-col items-center gap-1 rounded-xl border bg-card px-1.5 pb-2 pt-2.5 active:scale-[0.97]",
                  m.is_me ? "border-primary/60" : "border-border",
                )}
              >
                <Avatar m={m} size="md" />
                <span className="flex w-full min-w-0 items-center justify-center gap-0.5">
                  <NameBadge league={m.league} className="h-3.5 w-3.5 shrink-0" glow={false} />
                  <span className="truncate text-[12px] font-black text-foreground">{m.nickname}</span>
                </span>
                <span className="whitespace-nowrap text-[10.5px] font-bold text-muted-foreground">
                  {m.is_me && <span className="text-primary">나 · </span>}
                  {minutesLabel(m.since, now)}
                </span>
                {data.all_branches && m.branch && (
                  <span className="max-w-full truncate text-[10px] font-bold text-muted-foreground/80">
                    {shortBranchName(m.branch)}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] font-semibold text-muted-foreground">{emptyText}</p>
        )}
      </section>

      <WorkingOutNowFullscreen
        open={full}
        onClose={() => setFull(false)}
        title={title}
        scope={scope}
        members={list}
        allBranches={data.all_branches}
        manager={manager}
        emptyText={emptyText}
        now={now}
        onOpenMember={openMember}
      />
    </>
  );
};

/** 전체화면 — 지금 운동 중인 회원을 크게 (라이센스 시트 z-[110] 가 이 위로 열린다) */
const WorkingOutNowFullscreen = ({
  open,
  onClose,
  title,
  scope,
  members,
  allBranches,
  manager,
  emptyText,
  now,
  onOpenMember,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  scope: string;
  members: WorkingOutMember[];
  allBranches: boolean;
  manager: boolean;
  emptyText: string;
  now: number;
  onOpenMember: (m: WorkingOutMember) => void;
}) => {
  useModalDismiss(open, onClose);
  // body 에 바로 붙인다 — 부모의 space-y 여백·시트의 transform 에 끌려가지 않게 (TV 처럼 화면 전체)
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[105] flex flex-col bg-background"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.875rem)]">
            <LiveDot on={members.length > 0} size="h-3 w-3" />
            <h2 className="text-[18px] font-black text-foreground">{title}</h2>
            <span className="number-font text-[18px] font-black text-emerald-600 dark:text-emerald-400">
              {members.length}
              <span className="ml-0.5 text-[13px]">명</span>
            </span>
            {scope && <span className="truncate text-[13px] font-bold text-muted-foreground">· {scope}</span>}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
              aria-label="닫기"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-3">
            <p className="mb-3 text-[12px] font-semibold leading-relaxed text-muted-foreground">
              체육관 TV와 같은 기준이에요 · 앱에서 운동 시작 또는 출석 후 2시간 · 1분마다 새로고침
              <br />
              {manager ? "이름을 누르면 회원 상세 정보가 열려요" : "이름을 누르면 라이센스를 보고 하트를 보낼 수 있어요"}
            </p>
            {members.length > 0 ? (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {members.map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    onClick={() => onOpenMember(m)}
                    className={cn(
                      "flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 pb-3 pt-3.5 active:scale-[0.97]",
                      m.is_me ? "border-primary/60" : "border-border",
                    )}
                  >
                    <Avatar m={m} size="lg" />
                    <span className="flex w-full min-w-0 items-center justify-center gap-0.5">
                      <NameBadge league={m.league} className="h-4 w-4 shrink-0" glow={false} />
                      <span className="truncate text-[13.5px] font-black text-foreground">{m.nickname}</span>
                    </span>
                    <span className="whitespace-nowrap text-[11px] font-bold text-muted-foreground">
                      {m.is_me ? <span className="text-primary">나 · </span> : null}
                      Lv.{m.level} · {minutesLabel(m.since, now)}
                    </span>
                    {allBranches && m.branch && (
                      <span className="max-w-full truncate text-[10.5px] font-bold text-muted-foreground/80">
                        {shortBranchName(m.branch)}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-card border border-border bg-muted/30 px-4 py-8 text-center text-[13px] font-semibold text-muted-foreground">
                {emptyText}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default WorkingOutNowCard;
