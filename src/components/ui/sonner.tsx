import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // 2026-10-18 오류 신고("알림창이 아래 메뉴바를 가리고 한참 있다가 사라져요 · 계속 누르면 여러 개 겹쳐요")
      // → 위쪽 가운데에 띄우고(하단 탭을 가리지 않게), 3초로 줄이고, 한 번에 2개까지만. 같은 문구는 겹치지 않고 바뀐다(lib/emoji3d/sonner).
      position="top-center"
      duration={3000}
      visibleToasts={2}
      // 아이폰: 알림 토스트가 위로는 시계(상태바), 아래로는 홈 막대에 깔리지 않게 (2026-10-01) — 다른 기기는 env 가 0 이라 그대로 16px
      mobileOffset={{
        top: "calc(env(safe-area-inset-top, 0px) + 16px)",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-elev-3",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
