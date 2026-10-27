/**
 * 🥊 지금까지 이룬 것 — 내정보 · 내 운동 기록 · 관리자 회원 상세 '내정보' (2026-10-21~22 대표님)
 *   "주평균 빼 주고 지금까지 이룬 것들을 보여 줘 — 1시간당 평균 칼로리 · 건강 수치 · 긍정적인 신호 · 잽 · 스트레이트 · 스텝 등등"
 *   + "본인이 신체 정보(키 · 몸무게)를 넣고 153 PB 로 체력 측정"
 *   + "스쿼트는 빼고, 줄넘기 2분 3라운드 + 1시간 복싱 기준으로 펀치 수와 스텝 활동량으로"
 *   + "나는 관리자라 출석이 없는데, 회원 이름을 눌러 들어가면 그 회원 내정보를 볼 수 있게" (userId)
 *   + "횟수 말고 총 몇 시간 운동했는지로 · 운동 끝나고 한 번 더 찍으면 그 시간까지(최대 3시간)" (2026-10-22)
 *
 *   · 주인공 숫자 = 뻗은 펀치(잽 + 스트레이트) · 칸 = 잽 · 스트레이트 · 스텝 · 줄넘기 · 운동한 시간(이번 달 · 지금까지)
 *   · 운동 시간은 서버 workout_minutes 합 (두 번째 체크 · 운동 종료로 잰 시간, 없으면 66분) — 승급 · 랭킹과 같은 숫자.
 *     펀치 · 스텝은 그중 복싱한 시간(출석마다 줄넘기 6분 뺀 나머지)으로, 줄넘기는 출석마다 3라운드.
 *     회원이 직접 넣던 '한 번 복싱 시간' 칸은 2026-10-22 없앴다 (실제 시간을 두 번째 체크로 잰다).
 *   · 칼로리 = 1시간 평균 · 지금까지 (몸무게, 없으면 65kg 기준이라고 밝힘)
 *   · 좋은 신호 = 권장 운동량 채운 주 · 몸무게가 줄었을 때만 · 153 PB(완주 기록) — 잘한 것만
 *   숫자는 lib/achievement153 한 곳. 출석 = get_attendance_history(같은 캐시) · 신체 = get_my_body_info · PB = get_test153_summary.
 *   앱이 펀치를 직접 세지 않으므로 '추정'을 늘 같이 쓴다.
 *
 *   userId 없음(회원 본인) — 회원(role member · 지도진 아님)만. 대표님 '회원으로 보기'에서도 보인다.
 *   userId 있음(관리자 · 지점장이 그 회원을 볼 때) — 부르는 쪽이 권한을 거른다. 키 · 몸무게는 get_member_body_info 로 읽기만.
 */
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Clock, Flame, Lock, Ruler, Swords } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useMemberBodyInfo, useMyBodyInfo, useMyFitnessExtra } from "@/hooks/useMyBodyInfo";
import { weightBasis } from "@/lib/fitnessProfile153";
import { fetchTest153Summary } from "@/services/test153Service";
import {
  CHECKOUT_WINDOW_HOURS,
  DEFAULT_SESSION_MINUTES,
  DEFAULT_WEIGHT_KG,
  ROPE_ROUNDS,
  ROPE_ROUND_MINUTES,
  bodyInfoEmpty,
  classesForRecommended,
  dailyWorkoutText,
  daysThisWeek,
  kcalPerHour,
  kcalTotal,
  minutesToHours,
  moveTotals,
  pbView,
  punchPerSession,
  punchTotal,
  recommendedWeeks,
  roundApprox,
  spokenDuration,
  validWeight,
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
/** '2026-10-21' → '10월 21일' */
const md = (d: string | null) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : "";
};
const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const ROPE_LABEL = `줄넘기 ${ROPE_ROUND_MINUTES}분 × ${ROPE_ROUNDS}라운드`;
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
      <span aria-hidden className="mt-px shrink-0 text-[15px] leading-none">
        {emoji}
      </span>
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">{children}</span>
      {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </>
  );
  return onClick ? (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-start gap-2.5 rounded-xl px-1 py-2 text-left active:scale-[0.99]">
        {body}
      </button>
    </li>
  ) : (
    <li className="flex items-start gap-2.5 px-1 py-2">{body}</li>
  );
};

const Tile = ({ emoji, label, value, unit, sub, className }: { emoji: string; label: string; value: string; unit: string; sub: string; className?: string }) => (
  <div className={cn("rounded-xl bg-muted/50 px-2.5 py-2.5", className)}>
    <p className="text-[11.5px] font-bold text-muted-foreground">
      <span aria-hidden>{emoji} </span>
      {label}
    </p>
    <p className="mt-0.5 text-[16px] font-black tabular-nums text-foreground">
      {value}
      <span className="ml-0.5 text-[11px] font-bold text-muted-foreground">{unit}</span>
    </p>
    <p className="text-[10.5px] text-muted-foreground">{sub}</p>
  </div>
);

const AchievementCard = ({ className, userId }: { className?: string; userId?: string | null }) => {
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
  // 몸무게가 없으면 남녀 평균 → 65kg — 홈 '153과 함께하며'와 같은 칼로리 (2026-10-22). 관리자 화면은 성별을 읽지 않는다
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
    return <div className={cn("h-[420px] animate-pulse rounded-2xl border border-border bg-card", className)} aria-label="이룬 것을 불러오는 중" />;
  }
  if (isError || !att) {
    return (
      <div className={cn("rounded-2xl border border-border bg-card p-4 text-center", className)}>
        <p className="text-sm text-muted-foreground">이룬 것을 불러오지 못했어요</p>
        <button type="button" onClick={() => void refetch()} className="mt-2 h-10 rounded-xl bg-muted px-4 text-sm font-bold text-foreground active:scale-[0.98]">
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
  const myWeight = validWeight(body?.weightKg) ? body!.weightKg! : null;
  const wb = weightBasis(body?.weightKg, staffView ? null : extra?.gender);
  const lost = weightLost(body);
  const pb = pbView(pbSummary?.records);
  const moves = moveTotals(classes, totalMin);
  const byKey = Object.fromEntries(moves.map((m) => [m.key, m])) as Record<(typeof moves)[number]["key"], (typeof moves)[number]>;
  const punches = punchTotal(classes, totalMin);
  const perPunch = punchPerSession(classes, totalMin);
  const who = staffView ? "회원" : "";
  const my = staffView ? "" : "내 ";

  return (
    <section aria-label="지금까지 이룬 것" className={cn("rounded-2xl border border-border bg-card p-4 shadow-elev-1", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Swords className="h-4 w-4" />
        </span>
        <h3 className="text-[15px] font-black text-foreground">지금까지 이룬 것</h3>
        <span className="ml-auto text-right text-[11px] font-bold leading-tight text-muted-foreground">
          {minutesToHours(totalMin)}시간 운동
          <br />
          기준 추정
        </span>
      </div>

      {classes <= 0 ? (
        <p className="mt-3 rounded-xl bg-muted/50 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
          {staffView ? "아직 출석이 없어요. " : "첫 운동부터 쌓여요. "}
          복싱 1시간이면 잽 약 {n(byKey.jab.perSession)}번 · 스트레이트 약 {n(byKey.straight.perSession)}번을 뻗어요 👊
        </p>
      ) : (
        <>
          {/* 주인공 숫자 — 뻗은 펀치 */}
          <div className="mt-3">
            <p className="text-[12px] font-bold text-muted-foreground">지금까지 뻗은 펀치</p>
            <p className="mt-1 text-[36px] font-black leading-none tracking-tight tabular-nums text-foreground">
              <span className="mr-1 text-[15px] font-bold text-muted-foreground">약</span>
              {approx(punches)}
              <span className="ml-1 text-[16px] font-bold text-muted-foreground">번</span>
            </p>
            <p className="mt-1.5 text-[12px] text-muted-foreground">잽 + 스트레이트 · 한 번에 평균 약 {n(perPunch)}번</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["jab", "straight", "step"] as const).map((k) => {
              const m = byKey[k];
              return (
                <Tile key={k} emoji={m.emoji} label={m.label} value={approx(m.total)} unit={m.unit} sub={`1번에 평균 ${n(m.perSession)}${m.unit}`} />
              );
            })}
            <Tile emoji={byKey.rope.emoji} label={byKey.rope.label} value={approx(byKey.rope.total)} unit={byKey.rope.unit} sub={`1번에 ${ROPE_ROUND_MINUTES}분 × ${ROPE_ROUNDS}R`} />
          </div>

          {/* 운동한 시간 — 이번 달 · 지금까지 (서버 workout_minutes 합) */}
          <div className="mt-2 rounded-xl bg-primary/10 px-3.5 py-3" aria-label="운동한 시간">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" aria-hidden />
              운동한 시간
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11.5px] text-muted-foreground">이번 달</p>
                <p className="text-[22px] font-black leading-tight tabular-nums text-foreground">
                  {minutesToHours(att.monthMinutes)}
                  <span className="ml-0.5 text-[12px] font-bold text-muted-foreground">시간</span>
                </p>
              </div>
              <div>
                <p className="text-[11.5px] text-muted-foreground">지금까지</p>
                <p className="text-[22px] font-black leading-tight tabular-nums text-foreground">
                  {minutesToHours(totalMin)}
                  <span className="ml-0.5 text-[12px] font-bold text-muted-foreground">시간</span>
                </p>
              </div>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              운동이 끝나면 입구 얼굴 인식을 한 번 더 — 그 시간까지(최대 {CHECKOUT_WINDOW_HOURS}시간) 쳐요. 안 하면 {DEFAULT_SESSION_MINUTES}분
              (복싱 60분 + {ROPE_LABEL})
            </p>
          </div>

          {/* 칼로리 */}
          <div className="mt-3 rounded-xl bg-amber-500/10 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              1시간 평균 칼로리
            </div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-[24px] font-black leading-none tabular-nums text-foreground">
                약 {approx(kcalPerHour(classes, totalMin, wb.kg))}
                <span className="ml-0.5 text-[13px] font-bold text-muted-foreground">kcal</span>
              </p>
              <p className="text-right text-[12px] text-muted-foreground">
                지금까지 <b className="text-foreground">약 {approx(kcalTotal(classes, totalMin, wb.kg))}kcal</b>
              </p>
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              {myWeight ? (
                `${my}몸무게 ${oneDecimal(myWeight)}kg 기준`
              ) : staffView ? (
                `몸무게 ${DEFAULT_WEIGHT_KG}kg 기준`
              ) : (
                <>
                  {wb.label} ·{" "}
                  <button type="button" onClick={() => setSheetOpen(true)} className="font-bold text-primary underline-offset-2 active:opacity-70">
                    내 몸무게 넣으면 내 기준으로
                  </button>
                </>
              )}
            </p>
          </div>
        </>
      )}

      {/* 좋은 신호 — 잘한 것만 */}
      <div className="mt-3">
        <p className="text-[12px] font-bold text-muted-foreground">좋은 신호</p>
        <ul className="mt-0.5 divide-y divide-border/60">
          {recWeeks > 0 ? (
            <Signal emoji="💚">
              권장 운동량을 채운 주 <b>{n(recWeeks)}주</b>
              <span className="block text-[11.5px] text-muted-foreground">
                주 {n(needPerWeek)}번(또는 한 번 오래) 오면 신체활동 권장량(주 500 MET·분)을 넘어요
              </span>
            </Signal>
          ) : (
            <Signal emoji="💚">
              {thisWeek >= 1
                ? `이번 주 ${n(Math.max(1, needPerWeek - thisWeek))}번 더 오면 권장 운동량을 채워요`
                : `한 주에 ${n(needPerWeek)}번 오면 신체활동 권장량을 채워요`}
            </Signal>
          )}
          {lost != null && (
            <Signal emoji="⚖️">
              처음 잰 몸무게보다 <b>{oneDecimal(lost)}kg</b> 가벼워졌어요
              <span className="block text-[11.5px] text-muted-foreground">
                {md(body?.firstWeightOn ?? null)} → {md(body?.weightOn ?? null)}
              </span>
            </Signal>
          )}
          {pb ? (
            <Signal emoji="🏁" onClick={staffView ? undefined : () => navigate("/halloffame?tab=test153")}>
              {TEST153_NAME} {who ? `${who} ` : "내 "}최고 기록 <b className="tabular-nums">{fmtMs(pb.bestMs)}</b>
              <span className="text-muted-foreground"> · {DIVISION_LABEL[pb.division as Test153Division] ?? pb.division}</span>
              {pb.improvedMs != null && (
                <span className="block text-[11.5px] font-bold text-primary">첫 기록보다 {spokenDuration(pb.improvedMs)} 빨라졌어요</span>
              )}
            </Signal>
          ) : staffView ? (
            <Signal emoji="🏁">
              {TEST153_NAME} 기록이 아직 없어요
              <span className="block text-[11.5px] text-muted-foreground">재면 최고 기록과 빨라진 시간이 여기 보여요</span>
            </Signal>
          ) : (
            <Signal emoji="🏁" onClick={() => navigate("/halloffame?tab=test153")}>
              {TEST153_NAME}로 내 체력을 재 보세요
              <span className="block text-[11.5px] text-muted-foreground">기록이 쌓이면 얼마나 빨라졌는지 여기서 보여요</span>
            </Signal>
          )}
        </ul>
      </div>

      {/* 신체 정보 — 본인은 넣기 · 고치기, 관리자 · 지점장은 보기만 (넣은 값이 있을 때) */}
      {staffView ? (
        body?.isPrivate ? (
          // 회원이 비공개로 했으면 값은 오지 않는다 (2026-10-28 대표님)
          <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3">
            <Lock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-bold text-muted-foreground">회원 신체 정보</span>
              <span className="block truncate text-[13px] font-bold text-foreground">회원이 비공개로 했어요</span>
            </span>
          </div>
        ) : body && (body.heightCm != null || body.weightKg != null) ? (
          <div className="mt-2 flex items-center gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3">
            <Ruler className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-bold text-muted-foreground">회원 신체 정보</span>
              <span className="block truncate text-[13px] font-bold text-foreground">{bodyLine(body)}</span>
            </span>
          </div>
        ) : null
      ) : bodyInfoEmpty(body) ? (
        // 아직 하나도 안 넣었으면 눈에 띄게 권한다 (2026-10-27 대표님)
        <BodyInfoInvite className="mt-3" onClick={() => setSheetOpen(true)} />
      ) : (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3 text-left transition-transform active:scale-[0.99]"
        >
          <Ruler className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-muted-foreground">
              내 신체 정보{body?.isPrivate ? " · 나만 보기" : ""}
            </span>
            <span className="block truncate text-[13px] font-bold text-foreground">
              {body && (body.heightCm != null || body.weightKg != null) ? bodyLine(body) : "키 · 몸무게 넣기"}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-bold text-primary">{body && body.count > 0 ? "고치기" : "넣기"}</span>
        </button>
      )}

      <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
        앱이 펀치 · 스텝 수를 직접 세지는 않아요. 운동한 시간에서 출석마다 {ROPE_LABEL}를 빼고 나머지를 복싱으로 보고 계산한 추정이에요. 칼로리는
        신체활동 MET 표(2024) 기준이에요.
      </p>

      {!staffView && <BodyInfoSheet open={sheetOpen} onOpenChange={setSheetOpen} current={body ?? null} />}
    </section>
  );
};

export default AchievementCard;
