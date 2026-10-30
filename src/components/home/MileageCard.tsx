/**
 * 마일리지 카드 (홈 · 회원 전용, 2026-09-28)
 *
 * 대표님 지시: 출석 +500 · 레벨업 +500 · 레벨 10 타이틀매치 승급 +5,000.
 * 적립은 서버가 그 순간에 끝낸다(출석 기록 · 레벨 승인 트리거) — 이 카드는 잔액과 최근 내역만 보여 준다.
 * 누르면 최근 내역이 펼쳐진다. 지도진·관리자 계정엔 홈에서 아예 그리지 않는다(적립 대상이 아니다).
 *
 * 2026-10-15: '153 마일리지' · 1점 = 1원 — 수강권 결제 때 앱(결제 금액의 10%까지)·데스크에서 할인으로 쓴다.
 * 지금은 앱에 먼저 쌓인다. 브로제이(데스크) 공개 API 에는 마일리지 적립 기능이 없어서
 * 자동 이전은 그 기능이 생기면 연결한다 — 회원에게도 그렇게 적어 둔다.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Coins } from "lucide-react";

import { useMyMileage } from "@/hooks/useMileage";
import { useMyWorkoutToday } from "@/hooks/useWorkoutTime";
import { formatMileage, kstDateKey, kstShortDate, mileageRulesLine, type MileageItem } from "@/services/mileageService";
import MyPayHistorySheet, { type PayHistoryTab } from "@/components/membership/MyPayHistorySheet";
import MileageSavedBanner from "@/components/membership/MileageSavedBanner";

const itemLabel = (it: MileageItem): string => (it.kind === "attendance" ? "출석" : it.reason || "마일리지");

const MileageCard = () => {
  const { data, refetch } = useMyMileage();
  const { data: today, isPlaceholderData } = useMyWorkoutToday();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false); // 전체 내역 (2026-10-27)
  const [historyTab, setHistoryTab] = useState<PayHistoryTab>("mileage");

  // 오늘 첫 출석이 잡히는 순간(얼굴 출입 · QR) 서버 적립도 같이 끝난다 → 그때 한 번 다시 읽는다.
  const checkedIn = !isPlaceholderData && !!today?.checked_in;
  const prevCheckedIn = useRef<boolean | null>(null);
  useEffect(() => {
    if (isPlaceholderData) return;
    if (prevCheckedIn.current === false && checkedIn) void refetch();
    prevCheckedIn.current = checkedIn;
  }, [checkedIn, isPlaceholderData, refetch]);

  if (!data) return null;
  const rulesLine = mileageRulesLine(data.rules);
  // 적립을 쉬고 있고 쌓인 것도 없으면 보여 줄 게 없다.
  if (!rulesLine && data.balance === 0 && data.items.length === 0) return null;

  const todayKey = kstDateKey(new Date());
  const todayGain = data.items
    .filter((it) => kstDateKey(it.at) === todayKey)
    .reduce((sum, it) => sum + it.amount, 0);
  const recent = data.items.slice(0, 8);
  const attendanceAmount = data.rules?.enabled ? data.rules.attendance : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full overflow-hidden rounded-card border border-border bg-card"
    >
      {/* 지금까지 마일리지로 아낀 금액 — 배민 클럽처럼 맨 위에 크게 (2026-10-30 대표님). 할인받은 적이 없으면 안 그린다 */}
      <MileageSavedBanner
        variant="band"
        onClick={() => {
          setHistoryTab("pay");
          setHistoryOpen(true);
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-secondary/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-reward/15 text-amber-500 dark:text-reward">
          <Coins className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-label font-bold text-amber-700 dark:text-reward">153 마일리지 · 1점 = 1원</p>
          <p className="flex items-center gap-1.5 truncate text-body font-bold text-foreground">
            <span className="tabular-nums">{formatMileage(data.balance)}</span>
            <span className="text-label font-bold text-muted-foreground">점 · 결제 할인에 사용</span>
            {todayGain > 0 && (
              <span className="rounded-full bg-reward/15 px-1.5 py-0.5 text-micro font-black tabular-nums text-amber-700 dark:text-reward">
                오늘 +{formatMileage(todayGain)}
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-label text-muted-foreground">
            {rulesLine || "지금은 마일리지 적립을 쉬고 있어요"}
          </p>
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="mileage-history"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-3.5 pb-3 pt-2">
              {recent.length === 0 ? (
                <p className="py-1.5 text-label text-muted-foreground">
                  아직 쌓인 마일리지가 없어요.
                  {attendanceAmount > 0 ? ` 출석하면 +${formatMileage(attendanceAmount)}이 쌓여요.` : ""}
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {recent.map((it, i) => (
                    <li key={`${it.at}-${i}`} className="flex items-center gap-2 py-1.5">
                      <span className="w-10 shrink-0 text-label tabular-nums text-muted-foreground">{kstShortDate(it.at)}</span>
                      <span className="min-w-0 flex-1 truncate text-label text-foreground">{itemLabel(it)}</span>
                      <span
                        className={`shrink-0 text-label font-black tabular-nums ${it.amount >= 0 ? "text-amber-700 dark:text-reward" : "text-muted-foreground"}`}
                      >
                        {it.amount > 0 ? "+" : ""}
                        {formatMileage(it.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => {
                  setHistoryTab("mileage");
                  setHistoryOpen(true);
                }}
                className="mt-2 flex h-10 w-full items-center justify-center rounded-xl bg-reward/10 text-label font-bold text-amber-700 active:scale-[0.98] dark:text-reward"
              >
                마일리지 · 결제 전체 내역 보기
              </button>
              <p className="mt-2 text-label leading-relaxed text-muted-foreground">
                출석은 하루 1번, 레벨업·타이틀매치 승급은 승인되는 순간 쌓여요. 수강권 · PT · 용품을 결제할 때 1점 = 1원으로
                할인받아요 — 앱 결제는 결제 확인 창의 ‘153 마일리지 쓰기’ 칸, 데스크 결제는 지점장님께 말씀해 주세요. 한 번에 결제 금액의 10%까지,
                1,000점 단위로 쓸 수 있고, 쌓인 날부터 1년이 지나면 사라져요.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <MyPayHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} initialTab={historyTab} />
    </motion.div>
  );
};

export default MileageCard;
