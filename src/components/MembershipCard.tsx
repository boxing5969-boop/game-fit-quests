// 153 디지털 수강권 — 프리미엄 멤버십 카드 (마이페이지·전체메뉴 수강권 공용).
// 회원: 등록일·만료일·D-day / 마스터·관장·코치: 무제한(골드). 수강권 정보 없으면 렌더 안 함.
// 지도진 판정은 역할(user_roles)뿐 아니라 profiles.is_staff 도 본다 — 153OS 지도진 명단으로
// 표시된 코치님은 역할이 member 여도 무제한 (2026-09-23).
// PT 남은 횟수 · 락카 번호 (2026-10-19 대표님: "PT 회원님들 수강권 들어가면 몇회 남았는지 락카번호 몇번인지 확인할수있게") —
//   브로제이 기록을 153OS 가 회원마다 하루에 한 번쯤 확인해 옮겨 오므로 '언제 기준'을 같이 적는다 (lib/gymTicketInfo).
// 락카 · 운동복 남은 기간 (2026-10-27 대표님: "회원님이 수강권탭에서 몇일 남았는지 락카와 운동복 사용은 얼마나 남았는지 모두 체크할수있게") —
//   락카(번호 · 끝나는 날) · 운동복(끝나는 날)을 한 줄씩, 'N일 남음' — 7일 이하 주황, 끝나면 '끝남 · 연장하기'(→ 렌탈 탭).
//   수강권은 아래 D-day 그대로 (같은 남은 날 계산: 끝나는 날 − 오늘, KST).
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isManagerRole } from "@/lib/rankLabels";
import { isStaffProfile } from "@/lib/staffDisplay";
import { asOfLabel, daysUntil, leftText, ptTicketView, rentalUseRows, termStateOf, ymdText } from "@/lib/gymTicketInfo";
import { endText } from "@/lib/cartPricing";
import { kstToday } from "@/lib/levelPractice";

const fmt = (d: string) => new Date(d).toLocaleDateString("ko-KR");

const MembershipCard = () => {
  const { profile, role } = useAuth();
  if (!profile) return null;

  const today = kstToday();
  const memEnd = (profile as { membership_end?: string }).membership_end ?? null;
  const regDate = (profile as { gym_reg_date?: string }).gym_reg_date ?? null;
  const payment = (profile as { payment_total?: number }).payment_total ?? null;
  const isStaff = isManagerRole(role) || isStaffProfile(profile);
  const pt = isStaff ? null : ptTicketView(profile);
  const rentals = rentalUseRows(profile, today);
  // PT 수업권만 있는 회원도 카드를 본다 (남은 횟수·락카·운동복)
  if (!isStaff && !memEnd && !pt && rentals.length === 0) return null;

  const ddays = memEnd ? daysUntil(memEnd, today) : null;
  const memState = termStateOf(ddays);
  const expired = memState === "ended";
  const soon = memState === "soon";
  // PT 횟수는 브로제이 확인이 하루쯤 늦을 수 있어 '언제 기준'을 적는다 (락카는 데스크가 넣은 값이라 시각을 안 적는다)
  const ptAsOf = pt ? asOfLabel(pt.asOf) : null;

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
          {isStaff ? "STAFF" : memEnd ? "정회원" : "PT 회원"}
        </span>
      </div>

      <div className="relative mt-5">
        <p className="text-lg font-bold text-white">{profile.nickname || profile.name}</p>
        <p className="mt-0.5 text-xs text-white/45">{profile.branch_name || "153복싱짐"}</p>
      </div>

      {/* PT 남은 횟수 */}
      {pt && (
        <div className="relative mt-5 min-w-0 rounded-2xl bg-white/[0.06] px-3.5 py-3 ring-1 ring-inset ring-white/10">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="shrink-0 rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-primary">PT</span>
            <span className="min-w-0 truncate text-[11px] font-semibold text-white/60">{pt.ticket ?? "퍼스널 트레이닝"}</span>
          </div>
          <p className="mt-2 flex items-baseline gap-1.5">
            <span className="text-[11px] font-medium text-white/50">남은 횟수</span>
            <span className="text-3xl font-black leading-none tabular-nums text-white">{pt.remaining ?? "–"}</span>
            {pt.remaining != null && <span className="text-sm font-bold text-white/70">회</span>}
          </p>
          {pt.endDate && <p className="mt-1.5 text-[11px] text-white/45">기한 {ymdText(pt.endDate)}</p>}
        </div>
      )}

      {/* 락카 · 운동복 — 번호 · 끝나는 날 · 남은 날 */}
      {rentals.length > 0 && (
        <div className={`relative ${pt ? "mt-2" : "mt-5"} divide-y divide-white/10 rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/10`}>
          {rentals.map((r) => (
            <div key={r.kind} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="flex min-w-0 items-baseline gap-1.5">
                  <span className="shrink-0 text-[11px] font-medium text-white/50">{r.label}</span>
                  {r.sub && <span className="min-w-0 truncate text-lg font-black leading-tight text-white">{r.sub}</span>}
                </p>
                {r.end && (
                  <p className={`${r.sub ? "mt-0.5" : "mt-1"} text-[12px] font-semibold text-white/75`}>{endText(r.end, today)}까지</p>
                )}
              </div>
              {r.state === "ended" ? (
                <Link
                  to="/membership?cat=rental"
                  className="shrink-0 rounded-full bg-destructive/20 px-2.5 py-1 text-[11.5px] font-bold text-destructive active:scale-95"
                >
                  끝남 · 연장하기
                </Link>
              ) : r.left != null ? (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-black tabular-nums ${
                    r.state === "soon" ? "bg-status-pending/20 text-status-pending" : "bg-primary/15 text-primary"
                  }`}
                >
                  {leftText(r.left)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {(pt || rentals.length > 0) && (
        <p className="relative mt-1.5 text-[10px] leading-relaxed text-white/35">
          {pt && ptAsOf ? `PT 횟수는 ${ptAsOf} · ` : ""}
          {pt ? "다르면 데스크에 말씀해 주세요" : "락카 · 운동복이 다르면 데스크에 말씀해 주세요"}
        </p>
      )}

      {(isStaff || memEnd) && (
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
              {isStaff ? "무제한" : ddays == null ? "–" : expired ? `D+${-ddays}` : ddays === 0 ? "D-DAY" : `D-${ddays}`}
            </p>
            {!isStaff && (expired || soon) && (
              <Link to="/membership?buy=1" className="mt-1.5 inline-block rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white active:scale-95">
                연장하기
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipCard;
