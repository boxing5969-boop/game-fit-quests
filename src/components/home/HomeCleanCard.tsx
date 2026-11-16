/**
 * 홈 「오늘 청소」 한 줄 (2026-11-16 · 153운영본부 「오늘 청소」 1단계)
 *   오늘 내 차례 청소가 아직 안 끝난 코치님에게만 — 출근해서 앱을 열면 바로 보이게(보고서 「출근 직후 바로 뜬다」).
 *   누르면 운영본부에서 그 시간대 화면이 바로 열린다(/office?clean=<시간대>).
 *   회원 · 차례가 없는 날 · 다 끝낸 뒤 · 서버에 함수가 없을 때는 아무것도 그리지 않는다.
 */
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { myOpenSlots, slotCounts, slotEndLabel, slotStatus, slotSubLine } from "@/lib/opsClean";
import { isStaffProfile } from "@/lib/staffDisplay";
import { useOpsCleanDay } from "@/services/opsCleanService";

const HomeCleanCard = () => {
  const navigate = useNavigate();
  const { user, profile, realRole } = useAuth();
  const maybeStaff = !!user && (isStaffProfile(profile) || (!!realRole && realRole !== "member"));
  const { data } = useOpsCleanDay(null, null, maybeStaff);
  const mine = data ? myOpenSlots(data) : [];
  if (mine.length === 0) return null;
  // 하던 것이 있으면 그것부터
  const slot = mine.find((s) => slotStatus(s) === "doing") ?? mine[0];
  const doing = slotStatus(slot) === "doing";
  const c = slotCounts(slot);
  return (
    <button
      type="button"
      onClick={() => navigate(`/office?clean=${slot.slot}`)}
      className="flex w-full items-center gap-3 rounded-2xl border border-primary/50 bg-card px-4 py-3.5 text-left shadow-elev-1 transition-transform active:scale-[0.99]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
        <Sparkles className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-black text-foreground">
          오늘 청소 · {slot.label} {slot.time}
        </span>
        <span className="mt-0.5 block truncate text-label text-muted-foreground">
          {doing ? `${c.checked} / ${c.total} · ${slotEndLabel(slot)}까지` : slotSubLine(slot)}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-label font-black text-background">{doing ? "이어서" : "시작"}</span>
    </button>
  );
};

export default HomeCleanCard;
