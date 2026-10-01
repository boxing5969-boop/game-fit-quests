/**
 * 머리글 종 버튼 — 누르면 알림함(/notifications) (2026-10-01 대표님: 공지가 회원 화면에 안 보였다).
 * 배지 = 안 읽은 알림 수. 메시지 종이비행기(DmHeaderButton)와 같은 모양·크기.
 */
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import { badgeText } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const NotificationBellButton = ({ className, iconClassName }: { className?: string; iconClassName?: string }) => {
  const navigate = useNavigate();
  const { data } = useUnreadNotificationCount();
  const unread = data ?? 0;
  return (
    <button
      type="button"
      onClick={() => navigate("/notifications")}
      aria-label={unread > 0 ? `알림 · 안 읽은 알림 ${unread}개` : "알림"}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95",
        className,
      )}
    >
      <Bell className={cn("h-[17px] w-[17px] text-secondary-foreground", iconClassName)} strokeWidth={2.1} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10.5px] font-bold leading-none text-white ring-2 ring-background">
          {badgeText(unread)}
        </span>
      )}
    </button>
  );
};

export default NotificationBellButton;
