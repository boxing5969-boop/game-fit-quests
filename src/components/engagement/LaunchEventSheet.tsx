/**
 * 153 마이복서 런칭 이벤트 — 자세히 보기 시트 (2026-10-28)
 *
 * 회원 제안(선릉역점 봄, 앱 신고 10/28): "153마이복서 런칭이벤트 공지사항 떠 있는 걸 누르면 자세한 글을 볼 수 있었으면 —
 * 눌러도 아무 반응이 없어요". → 153 챌린지 '이벤트' 탭의 런칭 이벤트 띠를 누르면 이 시트가 열린다.
 *   · 남은 날(D-day) · 기간 — 서버 get_launch_event_window 그대로 (설정 화면에서 정한 시작·종료일)
 *   · 1위 혜택 · 세 왕좌(내 순위) · 정하는 법
 *   · 왕좌 줄을 누르면 시트를 닫고 보드에서 그 왕좌의 규칙·순위를 연다
 * 글은 king153Service 의 LAUNCH_EVENT_* 한 곳. 숫자는 서버 값 그대로 — 여기서 만들지 않는다.
 * 딥링크: /myboxer/quest?event=1 (공지·알림에서 바로 열기)
 */
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, X } from "lucide-react";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import { cn } from "@/lib/utils";
import {
  KING_META, LAUNCH_EVENT_BRIEF, LAUNCH_EVENT_CATEGORIES, LAUNCH_EVENT_PRIZE, fmtKstDate, launchEventDday, launchEventRules,
  type KingCategory, type KingScope, type KingSummaryItem, type LaunchEventWindow,
} from "@/services/king153Service";

interface Props {
  open: boolean;
  onClose: () => void;
  win: LaunchEventWindow | null | undefined;
  /** 이벤트 기간 요약(get_153_king_summary period=event) — 내 순위. 없으면 순위 칸을 비운다 */
  items: KingSummaryItem[] | null;
  scope: KingScope;
  /** 왕좌 줄을 누르면 — 보드에서 그 왕좌 열기 */
  onPick: (c: KingCategory) => void;
}

const NO = ["①", "②", "③"];

/** 맨 위 카드 — 주인공(남은 날) 하나 + 날짜 한 줄 (반쪽 칸이라 짧게 — 시작일은 '이렇게 정해요' 첫 줄에) */
const heroOf = (w: LaunchEventWindow | null | undefined): { label: string; big: string; line: string } => {
  if (!w) return { label: "기간", big: "…", line: "확인 중" };
  const start = fmtKstDate(w.start_date);
  const end = w.end_date ? fmtKstDate(w.end_date) : null;
  if (w.status === "upcoming") return { label: "시작까지", big: launchEventDday(w), line: `${start} 시작` };
  if (w.status === "ended") return { label: "이벤트", big: "끝났어요", line: end ? `${end} 마감` : "최종 결과" };
  if (!end) return { label: "기간", big: "진행 중", line: `${start}부터` };
  return { label: "남은 날", big: launchEventDday(w), line: `${end}까지` };
};

const LaunchEventSheet = ({ open, onClose, win, items, scope, onPick }: Props) => {
  useModalDismiss(open, onClose);
  const hero = heroOf(win);
  const upcoming = win?.status === "upcoming";
  const byCat = new Map((items ?? []).map((i) => [i.category, i]));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="153 마이복서 런칭 이벤트"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            {/* 제목 한 줄 + ✕ */}
            <div className="flex items-center justify-between border-b border-border px-5 pb-3 pt-5">
              <h2 className="min-w-0 truncate text-heading font-black text-foreground">153 마이복서 런칭 이벤트</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {/* 남은 날 + 1위 혜택 — 두 칸 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-border bg-card p-4">
                  <p className="text-label font-bold text-muted-foreground">{hero.label}</p>
                  <p className="mt-1 text-title font-black tabular-nums text-foreground">{hero.big}</p>
                  <p className="mt-1 text-label text-muted-foreground">{hero.line}</p>
                </div>
                <div className="rounded-2xl border border-reward/30 bg-reward/10 p-4">
                  <p className="text-label font-bold text-reward">왕좌마다 1위</p>
                  <p className="mt-1 text-title font-black tabular-nums text-reward">{LAUNCH_EVENT_PRIZE.amount}</p>
                  <p className="mt-1 text-label font-bold text-foreground">{LAUNCH_EVENT_PRIZE.unit}</p>
                </div>
              </div>
              <p className="px-1 text-label text-muted-foreground">{LAUNCH_EVENT_PRIZE.note}</p>

              {/* 세 왕좌 — 누르면 보드에서 그 왕좌의 규칙 · 순위 */}
              <div>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h3 className="text-body font-black text-foreground">세 왕좌로 겨뤄요</h3>
                  {!upcoming && items && (
                    <span className="text-label text-muted-foreground">{scope === "branch" ? "내 지점" : "전체"} 순위</span>
                  )}
                </div>
                <ul className="space-y-2">
                  {LAUNCH_EVENT_CATEGORIES.map((c, i) => {
                    const m = KING_META[c];
                    const me = byCat.get(c)?.me ?? null;
                    return (
                      <li key={c}>
                        <button
                          type="button"
                          onClick={() => onPick(c)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-all active:scale-[0.99]"
                        >
                          <span className="text-title leading-none" aria-hidden>{m.emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-black text-foreground">
                              {NO[i]} {m.title}
                            </span>
                            <span className="mt-0.5 block break-keep text-label text-muted-foreground">{LAUNCH_EVENT_BRIEF[c]}</span>
                          </span>
                          {!upcoming && items && (
                            <span
                              className={cn(
                                "shrink-0 tabular-nums",
                                me ? "text-body font-black text-primary" : "text-label text-muted-foreground",
                              )}
                            >
                              {me ? `나 ${me.rank}위` : "기록 없음"}
                            </span>
                          )}
                          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* 정하는 법 */}
              <div className="rounded-2xl bg-muted/40 p-4">
                <h3 className="text-body font-black text-foreground">이렇게 정해요</h3>
                <ul className="mt-2 space-y-1.5">
                  {launchEventRules(win).map((r) => (
                    <li key={r} className="flex gap-2 break-keep text-label leading-relaxed text-foreground">
                      <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                      <span className="min-w-0">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button
                type="button"
                onClick={onClose}
                className="h-12 w-full rounded-xl bg-primary text-body font-black text-primary-foreground transition-all active:scale-[0.98]"
              >
                순위 보기
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LaunchEventSheet;
