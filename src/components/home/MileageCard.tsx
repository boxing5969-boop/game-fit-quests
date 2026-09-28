/**
 * 마일리지 카드 (홈 · 회원 전용, 2026-09-28)
 *
 * 대표님 지시: 출석 +500 · 레벨업 +500 · 레벨 10 타이틀매치 승급 +5,000.
 * 적립은 서버가 그 순간에 끝낸다(출석 기록 · 레벨 승인 트리거) — 이 카드는 잔액과 최근 내역만 보여 준다.
 * 누르면 최근 내역이 펼쳐진다. 지도진·관리자 계정엔 홈에서 아예 그리지 않는다(적립 대상이 아니다).
 *
 * 지금은 앱에 먼저 쌓인다. 브로제이(데스크) 공개 API 에는 마일리지 적립 기능이 없어서
 * 자동 이전은 그 기능이 생기면 연결한다 — 회원에게도 그렇게 적어 둔다.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Coins } from "lucide-react";

import { useMyMileage } from "@/hooks/useMileage";
import { useMyWorkoutToday } from "@/hooks/useWorkoutTime";
import { formatMileage, kstDateKey, kstShortDate, mileageRulesLine, type MileageItem } from "@/services/mileageService";

const itemLabel = (it: MileageItem): string => (it.kind === "attendance" ? "출석" : it.reason || "마일리지");

const MileageCard = () => {
  const { data, refetch } = useMyMileage();
  const { data: today, isPlaceholderData } = useMyWorkoutToday();
  const [open, setOpen] = useState(false);

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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-secondary/40"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-reward/15 text-reward">
          <Coins className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-reward">마일리지</p>
          <p className="flex items-center gap-1.5 truncate text-sm font-bold text-foreground">
            <span className="tabular-nums">{formatMileage(data.balance)}</span>
            <span className="text-[12px] font-bold text-muted-foreground">마일리지</span>
            {todayGain > 0 && (
              <span className="rounded-full bg-reward/15 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-reward">
                오늘 +{formatMileage(todayGain)}
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
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
                <p className="py-1.5 text-[12px] text-muted-foreground">
                  아직 쌓인 마일리지가 없어요.
                  {attendanceAmount > 0 ? ` 출석하면 +${formatMileage(attendanceAmount)}이 쌓여요.` : ""}
                </p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {recent.map((it, i) => (
                    <li key={`${it.at}-${i}`} className="flex items-center gap-2 py-1.5">
                      <span className="w-10 shrink-0 text-[11px] tabular-nums text-muted-foreground">{kstShortDate(it.at)}</span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{itemLabel(it)}</span>
                      <span
                        className={`shrink-0 text-[12px] font-black tabular-nums ${it.amount >= 0 ? "text-reward" : "text-muted-foreground"}`}
                      >
                        {it.amount > 0 ? "+" : ""}
                        {formatMileage(it.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
                출석은 하루 1번, 레벨업·타이틀매치 승급은 승인되는 순간 쌓여요. 지금은 앱에 먼저 쌓이고,
                브로제이(데스크) 마일리지 연동은 준비 중이에요.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default MileageCard;
