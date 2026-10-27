/**
 * 🏢 홈 「회의실 참석」 카드 (2026-10-27 · 보고서 '입구')
 *   홈 맨 아래(전체 메뉴 위) — 지점 회의실에 들어갈 수 있는 사람(그 지점 지도진 · 대표님)에게만 보인다.
 *   회원 화면에는 칸 자체가 없다(office_me 가 빈 목록 → 그리지 않음).
 *   한 줄: "지금 3명 사무실에 있어요 · 회의 진행 중"
 *   회의 중이면 누르자마자 그 회의 화면(/office/room)으로 — 아니면 사무실(/office).
 *   정기 회의가 잡혀 있으면 "다음 회의 · 내일 오전 10:00 · 주간 지도진 회의" 한 줄 (office_me 의 next, 20261027225255)
 */
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { isStaffProfile } from "@/lib/staffDisplay";
import { saveOfficeBranch, useOfficeMe } from "@/services/officeService";
import { useOfficeOnline } from "@/lib/officePresence";
import { OFFICE_ART } from "@/lib/officeLayout";
import { nextLabel } from "@/lib/officeSchedule";

const OfficeEntryCard = () => {
  const navigate = useNavigate();
  const { user, profile, realRole } = useAuth();
  const maybeStaff = !!user && (isStaffProfile(profile) || (!!realRole && realRole !== "member"));
  const { data } = useOfficeMe(maybeStaff);
  const offices = data?.offices ?? [];
  // 회의가 열린 지점이 있으면 그 지점을 먼저
  const office = offices.find((o) => o.meeting) ?? offices[0] ?? null;
  const presence = useOfficeOnline(office?.topic);
  if (!office) return null;

  const n = Math.max(presence.online.size, 1);
  const live = !!office.meeting;

  return (
    <button
      type="button"
      onClick={() => {
        if (!live) return navigate("/office");
        saveOfficeBranch(office.branch);
        navigate("/office/room");
      }}
      className={cn(
        "flex w-full items-center gap-3 overflow-hidden rounded-2xl border bg-card px-3 py-3 text-left shadow-elev-1 transition-transform active:scale-[0.99]",
        live ? "border-primary/60" : "border-border",
      )}
    >
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
        <img src={OFFICE_ART.srcSmall} alt="" className="h-full w-full object-cover object-[50%_35%]" draggable={false} />
        {live && <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-primary ring-2 ring-white" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[15px] font-extrabold text-foreground">회의실 참석</span>
          <span className="rounded-full bg-secondary px-1.5 py-[1px] text-[10.5px] font-bold text-muted-foreground">{office.label}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
          지금 {n}명 사무실에 있어요{live ? " · 회의 진행 중" : ""}
        </span>
        {live && (
          <span className="mt-0.5 block truncate text-[12.5px] font-bold text-primary">{office.meeting!.title}</span>
        )}
        {!live && office.next && (
          <span className="mt-0.5 block truncate text-[12.5px] font-bold text-foreground/80">
            다음 회의 · {nextLabel(office.next.at)} · {office.next.title}
          </span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
};

export default OfficeEntryCard;
