/**
 * 👀 회원으로 보기 — 켜는 버튼 · 켜져 있는 동안 화면 아래 띠 (2026-10-21 대표님: "내 계정은 모든 기능에 회원으로 보기 기능을 넣어 줘")
 *   · ViewAsMemberButton — 회원관리(관리자 홈) 머리의 눈 버튼 · 설정 스위치로 켠다. 켜면 회원 홈으로 간다
 *   · ViewAsMemberBar — 켜져 있으면 어느 화면이든 아래(탭 위)에 '회원 화면 · 지점 | 관리자로' 띠. 누르면 꺼진다
 *   상태 · 저장은 AuthContext (lib/viewAsMember). 본사(전체관리자 · 관리자) 계정에만 보인다.
 */
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { viewBranchLabel } from "@/lib/viewAsMember";
import { cn } from "@/lib/utils";

/** 켜기 — 머리의 눈 버튼 */
export const ViewAsMemberButton = ({ className }: { className?: string }) => {
  const { canViewAsMember, viewAsMember, setViewAsMember, profile } = useAuth();
  const navigate = useNavigate();
  if (!canViewAsMember || viewAsMember) return null;
  const turnOn = () => {
    setViewAsMember(true);
    toast.success(`${viewBranchLabel(profile?.branch_name)} 회원 화면으로 보는 중이에요 · 아래 띠를 누르면 관리자로 돌아와요`);
    navigate("/home");
  };
  return (
    <button
      type="button"
      onClick={turnOn}
      aria-label="회원으로 보기"
      title="회원으로 보기"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-all active:scale-95",
        className,
      )}
    >
      <Eye className="h-5 w-5" />
    </button>
  );
};

/** 켜져 있는 동안 — 아래 띠. 라이브보드(TV)에는 안 띄운다 */
export const ViewAsMemberBar = () => {
  const { viewAsMember, setViewAsMember, profile } = useAuth();
  const { pathname } = useLocation();
  if (!viewAsMember) return null;
  if (pathname.startsWith("/live-board") || pathname.startsWith("/signage") || pathname.startsWith("/tv")) return null;
  const turnOff = () => {
    setViewAsMember(false);
    toast.success("관리자 화면으로 돌아왔어요");
  };
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[45] flex justify-center px-4" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 74px)" }}>
      <button
        type="button"
        onClick={turnOff}
        aria-label="회원으로 보기 끄기 — 관리자 화면으로"
        className="pointer-events-auto flex h-9 max-w-full items-center gap-1.5 rounded-full bg-foreground/90 px-3.5 text-label font-bold text-background shadow-elev-3 backdrop-blur transition-transform active:scale-95"
      >
        <Eye className="h-4 w-4 shrink-0" />
        <span className="truncate">회원 화면 · {viewBranchLabel(profile?.branch_name)}</span>
        <span className="opacity-40">|</span>
        <EyeOff className="h-3.5 w-3.5 shrink-0" />
        <span className="shrink-0">관리자로</span>
      </button>
    </div>
  );
};
