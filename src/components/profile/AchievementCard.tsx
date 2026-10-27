/**
 * 🥊 지금까지 이룬 것 — 내정보 · 내 운동 기록 · 관리자 회원 상세 '내정보' (2026-10-21~22 대표님)
 *   "주평균 빼 주고 지금까지 이룬 것들을 보여 줘 — 1시간당 평균 칼로리 · 건강 수치 · 긍정적인 신호 · 잽 · 스트레이트 · 스텝 등등"
 *   + "본인이 신체 정보(키 · 몸무게)를 넣고 153 PB 로 체력 측정"
 *   + "스쿼트는 빼고, 줄넘기 2분 3라운드 + 1시간 복싱 기준으로 펀치 수와 스텝 활동량으로"
 *   + "나는 관리자라 출석이 없는데, 회원 이름을 눌러 들어가면 그 회원 내정보를 볼 수 있게" (userId)
 *   + "횟수 말고 총 몇 시간 운동했는지로 · 운동 끝나고 한 번 더 찍으면 그 시간까지(최대 3시간)" (2026-10-22)
 *   2026-10-28 리디자인 (대표님 "위보고한 기준대로 전면 리 디자인하자" · 화면 규칙 7가지):
 *     · 주인공 하나 = 뻗은 펀치 · 칸 4개(잽 · 스트레이트 · 스텝 · 줄넘기)는 이름 + 숫자만 · 1시간 칼로리 한 줄
 *     · '운동한 시간'(이번 달 · 지금까지) 칸은 뺐다 — 바로 위 요약 카드와 같은 숫자였다
 *     · 좋은 신호는 한 줄씩 · 긴 설명 문단은 한 줄 추정 안내로
 *     · showInvite=false 면 신체 정보 권유를 평범한 한 줄로 ('내 운동 기록'은 '153과 함께하며'에서 이미 권한다)
 *   숫자는 lib/achievement153 한 곳. 출석 = get_attendance_history(같은 캐시) · 신체 = get_my_body_info · PB = get_test153_summary.
 *   앱이 펀치를 직접 세지 않으므로 '추정'을 늘 같이 쓴다.
 *
 *   userId 없음(회원 본인) — 회원(role member · 지도진 아님)만. 대표님 '회원으로 보기'에서도 보인다.
 *   userId 있음(관리자 · 지점장이 그 회원을 볼 때) — 부르는 쪽이 권한을 거른다. 키 · 몸무게는 get_member_body_info 로 읽기만.
 */
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Lock, Ruler } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useMemberBodyInfo, useMyBodyInfo, useMyFitnessExtra } from "@/hooks/useMyBodyInfo";
import { weightBasis } from "@/lib/fitnessProfile153";
import { fetchTest153Summary } from "@/services/test153Service";
import {
  ROPE_ROUNDS,
  ROPE_ROUND_MINUTES,
  bodyInfoEmpty,
  classesForRecommended,
  dailyWorkoutText,
  daysThisWeek,
  kcalPerHour,
  minutesToHours,
  moveTotals,
  pbView,
  punchTotal,
  recommendedWeeks,
  roundApprox,
  spokenDuration,
  weightLost,
} from "@/lib/achievement153";
import { kstToday } from "@/lib/attendanceCheer";
import { DIVISION_LABEL, TEST153_NAME, fmtMs, type Test153Division } from "@/lib/test153";
import { isStaffProfile } from "@/lib/staffDisplay";
import { cn } from "@/lib/utils";
import BodyInfoSheet from "@/components/profile/BodyInfoSheet";
import BodyInfoInvite from "@/components/profile/BodyInfoInvite";

const n = (v: number) => v.toLocaleString("ko-KR");
const approx = (v: number) => n(roundApprox(v));
const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
/** '키 172.5cm · 몸무게 80kg' */
const bodyLine = (b: { heightCm: number | null; weightKg: number | null; sessionMinutes?: number | null }) =>
  [
    b.heightCm != null ? `키 ${oneDecimal(b.heightCm)}cm` : null,
    b.weightKg != null ? `몸무게 ${oneDecimal(b.weightKg)}kg` : null,
    dailyWorkoutText(b.sessionMinutes) ? `하루 ${dailyWorkoutText(b.sessionMinutes)} 운동` : null,
  ]
    .filter(Boolean)
    .join(" · ");

const Signal = ({ emoji, children, onClick }: { emoji: string; children: ReactNode; onClick?: () => void }) => {
  const body = (
    <>
      <span aria-hidden className="shrink-0 text-body leading-none">
        {emoji}
      </span>
      <span className="min-w-0 flex-1 text-body leading-snug text-foreground">{children}</span>
      {onClick && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />}
    </>
  );
  return onClick ? (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 py-3 text-left active:scale-[0.99]">
        {body}
      </button>
    </li>
  ) : (
    <li className="flex items-center gap-3 py-3">{body}</li>
  );
};

const Tile = ({ emoji, label, value, unit }: { emoji: string; label: string; value: string; unit: string }) => (
  <div className="rounded-xl bg-muted/50 px-3 py-3">
    <p className="text-label font-bold text-muted-foreground">
      <span aria-hidden>{emoji} </span>
      {label}
    </p>
    <p className="mt-1 text-heading font-black tabular-nums text-foreground">
      {value}
      <span className="ml-0.5 text-label font-bold text-muted-foreground">{unit}</span>
    </p>
  </div>
);

const AchievementCard = ({ className, userId, showInvite = true }: { className?: string; userId?: string | null; showInvite?: boolean }) => {
  const navigate = useNavigate();
  const { user, profile, role, viewAsMember } = useAuth();
  const staffView = !!userId;
  // 회원 본인: 회원(role member · 지도진 아님)만 — 지점장 · 관리자 · 코치 계정은 출석이 수업이 아니라서.
  const show = staffView || (role === "member" && !isStaffProfile(profile)) || viewAsMember;
  const target = staffView ? userId : user?.id;
  const { data: att, isLoading, isError, refetch } = useAttendanceHistory(staffView ? userId : null, show);
  // 키 · 몸무게 — 본인은 get_my_body_info, 관리자 · 지점장은 그 회원 것(get_member_body_info)
  const mine = useMyBodyInfo(show && !staffView);
  const theirs = useMemberBodyInfo(staffView ? userId : null, show && staffView);
  const body = staffView ? theirs.data : mine.data;
  // 몸무게가 없으면 남녀 평균 → 65kg — '153과 함께하며'와 같은 칼로리 (2026-10-22). 관리자 화면은 성별을 읽지 않는다
  const { data: extra } = useMyFitnessExtra(show && !staffView);
  const { data: pbSummary } = useQuery({
    queryKey: ["test153", "summary", target],
    enabled: show && !!target,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => fetchTest153Summary(staffView ? (userId as string) : undefined),
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!show) return null;
  if (isLoading) {
    return <div className={cn("h-[360px] animate-pulse rounded-2xl border border-border bg-card", className)} aria-label="이룬 것을 불러오는 중" />;
  }
  if (isError || !att) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-5 text-center", className)}>
        <p className="text-body text-muted-foreground">이룬 것을 불러오지 못했어요</p>
        <button type="button" onClick={() => void refetch()} className="mt-3 h-11 rounded-xl bg-muted px-5 text-body font-bold text-foreground active:scale-[0.98]">
          다시 불러오기
        </button>
      </div>
    );
  }

  const classes = att.total;
  const totalMin = att.totalMinutes;
  const needPerWeek = classesForRecommended();
  const recWeeks = recommendedWeeks(att.list);
  const thisWeek = daysThisWeek(
    att.list.map((d) => d.day),
    kstToday(),
  );
  const wb = weightBasis(body?.weightKg, staffView ? null : extra?.gender);
  const lost = weightLost(body);
  const pb = pbView(pbSummary?.records);
  const moves = moveTotals(classes, totalMin);
  const byKey = Object.fromEntries(moves.map((m) => [m.key, m])) as Record<(typeof moves)[number]["key"], (typeof moves)[number]>;
  const punches = punchTotal(classes, totalMin);
  const who = staffView ? "회원" : "";

  return (
    <section aria-label="지금까지 이룬 것" className={cn("rounded-2xl border border-border bg-card p-5 shadow-elev-1", className)}>
      <h3 className="text-heading text-foreground">지금까지 이룬 것</h3>

      {classes <= 0 ? (
        <p className="mt-3 text-body leading-relaxed text-foreground">
          {staffView ? "아직 출석이 없어요. " : "첫 운동부터 쌓여요. "}
          복싱 1시간이면 잽 약 {n(byKey.jab.perSession)}번 · 스트레이트 약 {n(byKey.straight.perSession)}번을 뻗어요 👊
        </p>
      ) : (
        <>
          {/* 주인공 숫자 — 뻗은 펀치 */}
          <div className="mt-4">
            <p className="text-label font-bold text-muted-foreground">지금까지 뻗은 펀치</p>
            <p className="mt-1 text-display tracking-tight tabular-nums text-foreground">
              <span className="mr-1 text-heading font-bold">약</span>
              {approx(punches)}
              <span className="ml-1 text-heading font-bold">번</span>
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {(["jab", "straight", "step", "rope"] as const).map((k) => {
              const m = byKey[k];
              return <Tile key={k} emoji={m.emoji} label={m.label} value={approx(m.total)} unit={m.unit} />;
            })}
          </div>
          <p className="mt-3 text-body text-foreground">
            1시간에 <b className="tabular-nums">약 {approx(kcalPerHour(classes, totalMin, wb.kg))}kcal</b>를 써요
          </p>
        </>
      )}

      {/* 좋은 신호 — 잘한 것만, 한 줄씩 */}
      <ul className="mt-3 divide-y divide-border/60 border-t border-border/60">
        {recWeeks > 0 ? (
          <Signal emoji="💚">
            권장 운동량을 채운 주 <b>{n(recWeeks)}주</b>
          </Signal>
        ) : (
          <Signal emoji="💚">
            {thisWeek >= 1
              ? `이번 주 ${n(Math.max(1, needPerWeek - thisWeek))}번 더 오면 권장 운동량을 채워요`
              : `한 주에 ${n(needPerWeek)}번 오면 권장 운동량을 채워요`}
          </Signal>
        )}
        {lost != null && (
          <Signal emoji="⚖️">
            처음 잰 몸무게보다 <b>{oneDecimal(lost)}kg</b> 가벼워졌어요
          </Signal>
        )}
        {pb ? (
          <Signal emoji="🏁" onClick={staffView ? undefined : () => navigate("/halloffame?tab=test153")}>
            {TEST153_NAME} {who ? `${who} ` : "내 "}최고 <b className="tabular-nums">{fmtMs(pb.bestMs)}</b>
            <span className="text-muted-foreground"> · {DIVISION_LABEL[pb.division as Test153Division] ?? pb.division}</span>
            {pb.improvedMs != null && <span className="block text-label font-bold text-primary">첫 기록보다 {spokenDuration(pb.improvedMs)} 빨라졌어요</span>}
          </Signal>
        ) : staffView ? (
          <Signal emoji="🏁">{TEST153_NAME} 기록이 아직 없어요</Signal>
        ) : (
          <Signal emoji="🏁" onClick={() => navigate("/halloffame?tab=test153")}>
            {TEST153_NAME}로 내 체력을 재 보세요
          </Signal>
        )}
      </ul>

      {/* 신체 정보 — 본인은 넣기 · 고치기, 관리자 · 지점장은 보기만 (넣은 값이 있을 때) */}
      {staffView ? (
        body?.isPrivate ? (
          // 회원이 비공개로 했으면 값은 오지 않는다 (2026-10-28 대표님)
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Lock className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 text-body font-bold text-foreground">회원이 비공개로 했어요</span>
          </div>
        ) : body && (body.heightCm != null || body.weightKg != null) ? (
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <Ruler className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-body font-bold text-foreground">{bodyLine(body)}</span>
          </div>
        ) : null
      ) : bodyInfoEmpty(body) ? (
        // 아직 하나도 안 넣었으면 눈에 띄게 권한다 (2026-10-27 대표님) — '내 운동 기록'은 위 '153과 함께하며'가 이미 권해서 여기선 생략
        showInvite ? <BodyInfoInvite className="mt-3" onClick={() => setSheetOpen(true)} /> : null
      ) : (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-2 flex w-full items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-left transition-transform active:scale-[0.99]"
        >
          <Ruler className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-label font-bold text-muted-foreground">내 신체 정보{body?.isPrivate ? " · 나만 보기" : ""}</span>
            <span className="block truncate text-body font-bold text-foreground">
              {body && (body.heightCm != null || body.weightKg != null) ? bodyLine(body) : "키 · 몸무게 넣기"}
            </span>
          </span>
          <span className="shrink-0 text-label font-bold text-primary">{body && body.count > 0 ? "고치기" : "넣기"}</span>
        </button>
      )}

      <p className="mt-3 text-label leading-relaxed text-muted-foreground">
        {minutesToHours(totalMin)}시간 운동으로 계산한 추정이에요 (출석마다 줄넘기 {ROPE_ROUND_MINUTES}분 × {ROPE_ROUNDS}라운드 + 나머지는 복싱)
      </p>

      {!staffView && <BodyInfoSheet open={sheetOpen} onOpenChange={setSheetOpen} current={body ?? null} />}
    </section>
  );
};

export default AchievementCard;
