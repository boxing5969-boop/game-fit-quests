/**
 * 🥊 지금까지 이룬 것 — 내정보 · 내 출석 기록 · 관리자 회원 상세 '내정보' (2026-10-21 대표님)
 *   "주평균 빼 주고 지금까지 이룬 것들을 보여 줘 — 1시간당 평균 칼로리 · 건강 수치 · 긍정적인 신호 · 잽 · 스트레이트 · 스텝 등등"
 *   + "본인이 신체 정보(키 · 몸무게)를 넣고 153 PB 로 체력 측정" + "운동 시간 평균도 입력할 수 있게, 기준은 60분"
 *   + "스쿼트는 빼고, 줄넘기 2분 3라운드 + 1시간 복싱 기준으로 펀치 수와 스텝 활동량으로"
 *   + "나는 관리자라 출석이 없는데, 회원 이름을 눌러 들어가면 그 회원 내정보를 볼 수 있게" (userId)
 *
 *   · 주인공 숫자 = 뻗은 펀치(잽 + 스트레이트) · 아래 칸 = 잽 · 스트레이트 · 스텝 · 줄넘기 · 운동한 시간
 *   · 칼로리 = 1시간 평균 · 지금까지 (내 몸무게, 없으면 65kg 기준이라고 밝힘)
 *   · 좋은 신호 = 권장 운동량 채운 주 · 몸무게가 줄었을 때만 · 153 PB(완주 기록) — 잘한 것만
 *   숫자는 lib/achievement153 한 곳. 출석 = get_attendance_history(같은 캐시) · 신체 = get_my_body_info · PB = get_test153_summary.
 *   앱이 펀치를 직접 세지 않으므로 '기준 추정'을 늘 같이 쓴다.
 *
 *   userId 없음(회원 본인) — 회원(role member · 지도진 아님)만. 대표님 '회원으로 보기'에서도 보인다.
 *   userId 있음(관리자 · 지점장이 그 회원을 볼 때) — 부르는 쪽이 권한을 거른다. 키 · 몸무게 · 복싱 시간은
 *     회원에게 '나만 볼 수 있어요'라고 약속했으므로 읽지 않고 기본 기준(복싱 60분 · 65kg)으로 계산한다고 밝힌다.
 */
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Flame, Lock, Ruler, Swords } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceHistory } from "@/hooks/useAttendanceHistory";
import { useMyBodyInfo } from "@/hooks/useMyBodyInfo";
import { fetchTest153Summary } from "@/services/test153Service";
import {
  BASIS_MINUTES,
  DEFAULT_WEIGHT_KG,
  ROPE_ROUNDS,
  ROPE_ROUND_MINUTES,
  classesForRecommended,
  daysThisWeek,
  exerciseHours,
  kcalPerHour,
  kcalTotal,
  moveTotals,
  pbView,
  punchPerSession,
  punchTotal,
  recommendedWeeks,
  roundApprox,
  sessionMinutesOr60,
  sessionTotalMinutes,
  spokenDuration,
  validWeight,
  weightLost,
} from "@/lib/achievement153";
import { kstToday } from "@/lib/attendanceCheer";
import { DIVISION_LABEL, TEST153_NAME, fmtMs, type Test153Division } from "@/lib/test153";
import { isStaffProfile } from "@/lib/staffDisplay";
import { cn } from "@/lib/utils";
import BodyInfoSheet from "@/components/profile/BodyInfoSheet";

const n = (v: number) => v.toLocaleString("ko-KR");
const approx = (v: number) => n(roundApprox(v));
/** '2026-10-21' → '10월 21일' */
const md = (d: string | null) => {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(d ?? "");
  return m ? `${Number(m[1])}월 ${Number(m[2])}일` : "";
};
const oneDecimal = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const ROPE_LABEL = `줄넘기 ${ROPE_ROUND_MINUTES}분 × ${ROPE_ROUNDS}라운드`;
const ROPE_SHORT = `줄넘기 ${ROPE_ROUND_MINUTES}분×${ROPE_ROUNDS}R`;

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
  // 신체 · 복싱 시간은 본인 화면에서만 읽는다 (회원에게 '나만 볼 수 있어요')
  const { data: body } = useMyBodyInfo(show && !staffView);
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
  const minutes = staffView ? BASIS_MINUTES : sessionMinutesOr60(body?.sessionMinutes);
  const ownMinutes = !staffView && body?.sessionMinutes != null;
  const needPerWeek = classesForRecommended(minutes);
  const days = att.list.map((d) => d.day);
  const recWeeks = recommendedWeeks(days, minutes);
  const thisWeek = daysThisWeek(days, kstToday());
  const myWeight = !staffView && validWeight(body?.weightKg) ? body!.weightKg! : null;
  const lost = staffView ? null : weightLost(body);
  const pb = pbView(pbSummary?.records);
  const moves = moveTotals(classes, minutes);
  const byKey = Object.fromEntries(moves.map((m) => [m.key, m])) as Record<(typeof moves)[number]["key"], (typeof moves)[number]>;
  const punches = punchTotal(classes, minutes);
  const perPunch = punchPerSession(minutes);
  const who = staffView ? "회원" : "";

  return (
    <section aria-label="지금까지 이룬 것" className={cn("rounded-2xl border border-border bg-card p-4 shadow-elev-1", className)}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Swords className="h-4 w-4" />
        </span>
        <h3 className="text-[15px] font-black text-foreground">지금까지 이룬 것</h3>
        <span className="ml-auto text-right text-[11px] font-bold leading-tight text-muted-foreground">
          운동 {n(classes)}번 · 복싱 {n(minutes)}분
          <br />+ {ROPE_SHORT} 기준 추정
        </span>
      </div>

      {classes <= 0 ? (
        <p className="mt-3 rounded-xl bg-muted/50 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
          {staffView ? "아직 출석이 없어요. " : "첫 운동부터 쌓여요. "}
          복싱 {n(minutes)}분이면 잽 약 {n(byKey.jab.perSession)}번 · 스트레이트 약 {n(byKey.straight.perSession)}번을 뻗어요 👊
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

          <div className="mt-3 grid grid-cols-3 gap-2">
            {(["jab", "straight", "step"] as const).map((k) => {
              const m = byKey[k];
              return (
                <Tile key={k} emoji={m.emoji} label={m.label} value={approx(m.total)} unit={m.unit} sub={`1번에 ${n(m.perSession)}${m.unit}`} />
              );
            })}
            <Tile emoji={byKey.rope.emoji} label={byKey.rope.label} value={approx(byKey.rope.total)} unit={byKey.rope.unit} sub={`1번에 ${ROPE_ROUND_MINUTES}분 × ${ROPE_ROUNDS}R`} />
            <Tile
              emoji="⏱"
              label="운동한 시간"
              value={oneDecimal(exerciseHours(classes, minutes))}
              unit="시간"
              sub={`1번에 복싱 ${n(minutes)}분 + 줄넘기 = ${n(sessionTotalMinutes(minutes))}분`}
              className="col-span-2"
            />
          </div>

          {/* 한 번 복싱 시간 — 안 넣었으면 60분 (본인 화면만) */}
          {!staffView && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl px-1 py-1.5 text-left text-[12px] active:opacity-70"
            >
              <span className="text-muted-foreground">
                {ownMinutes ? `내 복싱 시간 한 번 ${n(minutes)}분 기준` : `복싱 한 번 ${n(minutes)}분 기준이에요 — 더 오래 하면 넣어 주세요`}
              </span>
              <span className="shrink-0 font-bold text-primary">{ownMinutes ? "바꾸기" : "복싱 시간 넣기"}</span>
            </button>
          )}

          {/* 칼로리 */}
          <div className="mt-3 rounded-xl bg-amber-500/10 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              1시간 평균 칼로리
            </div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-[24px] font-black leading-none tabular-nums text-foreground">
                약 {approx(kcalPerHour(myWeight, minutes))}
                <span className="ml-0.5 text-[13px] font-bold text-muted-foreground">kcal</span>
              </p>
              <p className="text-right text-[12px] text-muted-foreground">
                지금까지 <b className="text-foreground">약 {approx(kcalTotal(classes, myWeight, minutes))}kcal</b>
              </p>
            </div>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              {myWeight ? (
                `내 몸무게 ${oneDecimal(myWeight)}kg 기준`
              ) : staffView ? (
                `몸무게 ${DEFAULT_WEIGHT_KG}kg 기준`
              ) : (
                <>
                  몸무게 {DEFAULT_WEIGHT_KG}kg 기준 ·{" "}
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
                복싱 {n(minutes)}분 + 줄넘기면 주 {n(needPerWeek)}번으로 신체활동 권장량(주 500 MET·분)을 넘어요
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

      {/* 신체 · 운동 정보 — 본인만 */}
      {staffView ? (
        <p className="mt-2 flex items-start gap-2 rounded-xl bg-muted/50 px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            키 · 몸무게 · 복싱 시간은 회원 본인만 봐요. 여기서는 기본 기준(복싱 {n(BASIS_MINUTES)}분 · {DEFAULT_WEIGHT_KG}kg)으로 계산했어요 — 회원이
            직접 넣었다면 회원 화면 숫자는 조금 다를 수 있어요.
          </span>
        </p>
      ) : (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-2 flex w-full items-center gap-2.5 rounded-xl bg-muted/50 px-3.5 py-3 text-left transition-transform active:scale-[0.99]"
        >
          <Ruler className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-bold text-muted-foreground">내 신체 · 운동 정보</span>
            <span className="block truncate text-[13px] font-bold text-foreground">
              {body && (body.heightCm != null || body.weightKg != null || body.sessionMinutes != null)
                ? [
                    body.heightCm != null ? `키 ${oneDecimal(body.heightCm)}cm` : null,
                    body.weightKg != null ? `몸무게 ${oneDecimal(body.weightKg)}kg` : null,
                    body.sessionMinutes != null ? `복싱 ${n(body.sessionMinutes)}분` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "키 · 몸무게 · 복싱 시간 넣기"}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-bold text-primary">
            {body && (body.count > 0 || body.sessionMinutes != null) ? "고치기" : "넣기"}
          </span>
        </button>
      )}

      <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
        앱이 펀치 · 스텝 수를 직접 세지는 않아요. 출석 1번을 복싱 {n(minutes)}분 + {ROPE_LABEL}로 보고 계산한 추정이에요. 칼로리는 신체활동 MET
        표(2024) 기준이에요.
      </p>

      {!staffView && <BodyInfoSheet open={sheetOpen} onOpenChange={setSheetOpen} current={body ?? null} />}
    </section>
  );
};

export default AchievementCard;
