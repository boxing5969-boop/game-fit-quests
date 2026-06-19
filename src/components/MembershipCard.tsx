// 153 디지털 수강권 — 프리미엄 멤버십 카드 (마이페이지·전체메뉴 수강권 공용).
// 회원: 등록일·만료일·D-day / 마스터·관장·코치: 무제한(골드). 수강권 정보 없으면 렌더 안 함.
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";

const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR");

const MembershipCard = () => {
  const { profile, role } = useAuth();
  if (!profile) return null;

  const memEnd = (profile as { membership_end?: string }).membership_end ?? null;
  const regDate = (profile as { gym_reg_date?: string }).gym_reg_date ?? null;
  const payment = (profile as { payment_total?: number }).payment_total ?? null;
  const isStaff = isManagerRole(role);
  if (!isStaff && !memEnd) return null;

  const ddays = memEnd ? Math.ceil((new Date(memEnd + "T23:59:59").getTime() - Date.now()) / 86400000) : null;
  const expired = ddays !== null && ddays < 0;
  const soon = ddays !== null && ddays >= 0 && ddays <= 7;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/10 p-5 shadow-lg"
      style={{ background: "linear-gradient(135deg, #161b22 0%, #0c0f14 60%, #0a0c10 100%)" }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full opacity-30 blur-2xl"
        style={{ background: isStaff ? "radial-gradient(circle, hsl(var(--reward)) 0%, transparent 70%)" : "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
      />
      <span className="pointer-events-none absolute -bottom-5 right-2 select-none text-7xl font-black tracking-tighter text-white/[0.04]">153</span>

      <div className="relative flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.2em] text-white/55">153 MEMBERSHIP</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${isStaff ? "bg-reward/20 text-reward" : "bg-primary/20 text-primary"}`}>
          {isStaff ? "STAFF" : "정회원"}
        </span>
      </div>

      <div className="relative mt-5">
        <p className="text-lg font-bold text-white">{profile.nickname || profile.name}</p>
        <p className="mt-0.5 text-xs text-white/45">{profile.branch_name || "153복싱짐"}</p>
      </div>

      <div className="relative mt-6 flex items-end justify-between">
        <div className="space-y-0.5 text-[11px] leading-relaxed text-white/55">
          <p>등록 {regDate ? fmt(regDate) : fmt(profile.created_at)}</p>
          <p>만료 {isStaff ? "무제한" : fmt(memEnd!)}</p>
          {!isStaff && payment != null && payment > 0 && (
            <p>누적 결제 <span className="font-semibold text-white/75">{payment.toLocaleString("ko-KR")}원</span></p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] font-medium uppercase tracking-wider text-white/40">
            {isStaff ? "PERIOD" : expired ? "EXPIRED" : "남은 기간"}
          </p>
          <p className={`text-2xl font-black leading-none ${isStaff ? "text-reward" : expired ? "text-destructive" : soon ? "text-status-pending" : "text-primary"}`}>
            {isStaff ? "무제한" : expired ? `D+${-ddays!}` : `D-${ddays}`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MembershipCard;
