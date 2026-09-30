/**
 * 메시지(DM) 화면 공용 조각 — 프로필 동그라미 · 코치/본사 표식 · 아래에서 올라오는 시트.
 *
 * 색: 동그라미 = 리그 색(라이센스 카드와 같은 톤) · 코치님 = 금 · 본사 = 먹 + 민트 글자.
 * 민트는 포인트(보내기 버튼·안 읽음 점)에만 쓴다 — 내 말풍선은 먹색.
 */
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, X } from "lucide-react";
import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import type { DmKind, DmPerson } from "@/services/dmService";

const AVATAR_BG: Record<string, string> = {
  white: "linear-gradient(135deg, hsl(220, 14%, 62%), hsl(220, 14%, 42%))",
  blue: "linear-gradient(135deg, hsl(215, 100%, 45%), hsl(215, 100%, 28%))",
  red: "linear-gradient(135deg, hsl(0, 84%, 50%), hsl(0, 84%, 32%))",
  black: "linear-gradient(135deg, hsl(42, 45%, 28%), hsl(0, 0%, 10%))",
  champion: "linear-gradient(135deg, #FFE08A, #E3A33A)",
  hq: "linear-gradient(135deg, #243042, #0B0F17)",
};

type AvatarPerson = Pick<DmPerson, "display" | "rank" | "avatar_url" | "kind">;

/** 첫 글자 — 코치님('홍길동 코치님')은 이름 첫 글자, 본사는 153, 비었으면 🥊 */
const initialOf = (display: string | null | undefined, kind: DmKind | null) => {
  if (kind === "hq") return "153";
  const s = (display ?? "").trim();
  return s ? Array.from(s)[0] : "🥊";
};

export const DmAvatar = ({ person, size = 44, className }: { person: AvatarPerson | null; size?: number; className?: string }) => {
  const kind = person?.kind ?? null;
  const key = kind === "hq" ? "hq" : kind === "coach" ? "champion" : (person?.rank ?? "white").toLowerCase();
  const ring =
    kind === "coach" ? "ring-2 ring-[#F5C542]/70" : kind === "hq" ? "ring-2 ring-primary/60" : "ring-1 ring-black/5 dark:ring-white/10";
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full", ring, className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {person?.avatar_url ? (
        <img src={person.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span
          className={cn(
            "flex h-full w-full items-center justify-center font-black",
            kind === "coach" ? "text-[#3A2606]" : kind === "hq" ? "text-primary" : "text-white",
          )}
          style={{ background: AVATAR_BG[key] ?? AVATAR_BG.white, fontSize: Math.round(size * (kind === "hq" ? 0.3 : 0.42)) }}
        >
          {initialOf(person?.display, kind)}
        </span>
      )}
    </span>
  );
};

/** 이름 옆 작은 표식 — 지도진 = 금색 인증 표시(이름에 이미 '코치님·지점장님'이 붙는다) · 본사 = '본사' (회원은 없음) */
export const DmKindBadge = ({ kind, className }: { kind: DmKind | null | undefined; className?: string }) => {
  if (kind === "coach")
    return (
      <BadgeCheck
        role="img"
        aria-label="153 지도진"
        className={cn("h-[17px] w-[17px] shrink-0 fill-[#F5C542] text-white dark:text-[#1B2433]", className)}
        strokeWidth={2.4}
      />
    );
  if (kind === "hq")
    return (
      <span className={cn("inline-flex shrink-0 items-center rounded-md bg-foreground px-1.5 py-[1px] text-[10px] font-black leading-[14px] text-background", className)}>
        본사
      </span>
    );
  return null;
};

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** 시트 아래 고정 영역 (버튼 등) */
  footer?: ReactNode;
  /** 시트 높이 — full: 화면 대부분(검색 목록) */
  tall?: boolean;
}

/** 아래에서 올라오는 시트 — 라이센스 카드 시트와 같은 모양 */
export const DmSheet = ({ open, onClose, title, subtitle, children, footer, tall }: SheetProps) => {
  useModalDismiss(open, onClose);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm dark:bg-black/70 sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "flex w-full max-w-md flex-col rounded-t-3xl bg-card shadow-elev-3 sm:rounded-3xl",
              tall ? "h-[88vh] sm:h-[80vh]" : "max-h-[88vh]",
            )}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 px-5 pb-2 pt-4">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-bold text-foreground">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
            {footer && (
              <div className="shrink-0 border-t border-border/70 px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">{footer}</div>
            )}
            {!footer && <div className="h-[env(safe-area-inset-bottom)] shrink-0" />}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
