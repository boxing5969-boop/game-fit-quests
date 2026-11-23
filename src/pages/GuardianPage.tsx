/**
 * /guardian 「우리 아이」 — 보호자(어머님 · 아버님) 화면 (2026-11-23 대표님 「추천대로」).
 *
 * 아이마다: 오늘(도착 · 운동 중 n분째 · 끝 시각) · 이번 달 달력 · 153과 함께한 날 · 레벨 · 코치 한마디 · 153 PB · 최근 운동.
 * 안 보이는 것: 메시지 · 커뮤니티 글 · 마음 체크 · 몸무게 · 체지방(서버 guardian_home 이 아예 안 준다).
 * 보호자만 쓰는 계정(account_kind='guardian')은 이 화면이 앱 전부 — 하단 탭 · 코치봇 · 회원 안내 창이 안 뜬다(App.tsx).
 * 예시: /guardian?demo=1 (옛 DB 를 보는 미리보기 주소에서 서버 없이).
 */
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock, HeartHandshake, LogOut, MessageCircle, Timer, Trophy } from "lucide-react";
import AppPage from "@/components/ui/rankingup/AppPage";
import MyBoxerWordmark from "@/components/brand/MyBoxerWordmark";
import PushOptInCard from "@/components/notifications/PushOptInCard";
import RouteLoader from "@/components/splash/RouteLoader";
import { useAuth } from "@/contexts/AuthContext";
import {
  RELATION_LABEL,
  isGuardianOnlyProfile,
  kidTodayLine,
  levelLine,
  minutesText,
  pbText,
  visitLine,
  type GuardianHome,
  type GuardianKid,
} from "@/lib/guardian";
import { guardianDemo, useGuardianHome } from "@/services/guardianService";

const kstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

const demoHome = (): GuardianHome => {
  const today = kstToday();
  const ym = today.slice(0, 8);
  const inAt = new Date(Date.now() - 38 * 60_000);
  const hm = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(inAt);
  const days = Number(today.slice(8, 10));
  const dates = [1, 3, 5, 8, 10, 12, 15, 17, 19, 21].filter((d) => d <= days).map((d) => `${ym}${String(d).padStart(2, "0")}`);
  return {
    guardianAccount: true,
    kids: [
      {
        linkId: "demo",
        memberId: "demo",
        relation: "mom",
        name: "김민준",
        branch: "선릉역점",
        today: { in: hm, inAt: inAt.toISOString(), out: null, min: null },
        month: { days: dates.length + 1, minutes: (dates.length + 1) * 64, dates: [...dates, today] },
        total: { days: 38, minutes: 38 * 63, first: "2026-08-04" },
        recent: dates
          .slice(-5)
          .reverse()
          .map((d, i) => ({ day: d, in: ["18:42", "19:05", "18:30", "20:10", "18:55"][i] ?? "18:40", out: ["19:48", "20:12", "19:41", "21:15", "19:59"][i] ?? "19:44", min: [66, 67, 71, 65, 64][i] ?? 64 })),
        level: { rank: "white", level: 7, need: 2 },
        notes: [{ day: dates[dates.length - 1] ?? today, body: "잽 끝에 손을 바로 얼굴로 가져오는 게 좋아졌어요. 다음엔 스텝을 같이 맞춰 봐요.", who: "담당 코치" }],
        pb: { bestMs: (21 * 60 + 40) * 1000, count: 2 },
      },
    ],
  };
};

const MonthDots = ({ dates }: { dates: string[] }) => {
  const today = kstToday();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const first = new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay();
  const last = new Date(Date.UTC(y, m, 0, 12)).getUTCDate();
  const set = new Set(dates.filter((d) => d.startsWith(today.slice(0, 8))).map((d) => Number(d.slice(8, 10))));
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: last }, (_, i) => i + 1)];
  const todayN = Number(today.slice(8, 10));
  return (
    <div className="mt-2 grid grid-cols-7 gap-1" aria-label={`${m}월 운동한 날 ${set.size}일`}>
      {["일", "월", "화", "수", "목", "금", "토"].map((w) => (
        <span key={w} className="text-center text-micro text-muted-foreground">
          {w}
        </span>
      ))}
      {cells.map((d, i) =>
        d == null ? (
          <span key={`e${i}`} />
        ) : (
          <span
            key={d}
            className={`flex aspect-square items-center justify-center rounded-lg text-micro font-bold tabular-nums ${
              set.has(d) ? "bg-primary text-primary-foreground" : d === todayN ? "ring-1 ring-primary text-foreground" : "text-muted-foreground"
            }`}
          >
            {d}
          </span>
        ),
      )}
    </div>
  );
};

const firstText = (d: string | null) => (d ? `${d.slice(0, 4)}년 ${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일부터` : null);

const KidCard = ({ kid, now }: { kid: GuardianKid; now: number }) => {
  const t = kidTodayLine(kid.today, now);
  const lv = levelLine(kid.level);
  const pb = pbText(kid.pb?.bestMs ?? null);
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-elev-1">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-title font-black text-foreground">{kid.name}</h2>
        <span className="shrink-0 text-label text-muted-foreground">
          {kid.branch ? `${kid.branch} · ` : ""}
          {RELATION_LABEL[kid.relation]}로 연결
        </span>
      </div>

      {/* 오늘: 주인공 숫자 하나 */}
      <div className={`mt-4 rounded-2xl p-4 ${t.live ? "bg-primary/10" : "bg-muted/60"}`}>
        <p className="flex items-center gap-1.5 text-label font-bold text-primary">
          {t.live && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />}
          오늘
        </p>
        <p className="mt-1 text-display font-black tabular-nums text-foreground">{t.headline}</p>
        {t.sub && <p className="mt-1 text-body font-bold text-muted-foreground">{t.sub}</p>}
      </div>

      {/* 이번 달 */}
      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-body font-bold text-foreground">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
          이번 달 {kid.month.days}일 · {minutesText(kid.month.minutes)}
        </p>
        <MonthDots dates={kid.month.dates} />
      </div>

      {/* 153과 함께한 시간 */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-muted/60 p-3">
          <p className="text-label text-muted-foreground">153에서 운동한 날</p>
          <p className="text-heading font-black tabular-nums text-foreground">{kid.total.days}일</p>
        </div>
        <div className="rounded-2xl bg-muted/60 p-3">
          <p className="text-label text-muted-foreground">모두 합한 운동 시간</p>
          <p className="text-heading font-black tabular-nums text-foreground">{minutesText(kid.total.minutes)}</p>
        </div>
      </div>
      {firstText(kid.total.first) && <p className="mt-1.5 text-label text-muted-foreground">{firstText(kid.total.first)} 함께하고 있어요</p>}

      {(lv || pb) && (
        <ul className="mt-4 space-y-2">
          {lv && (
            <li className="flex items-start gap-2.5">
              <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-body font-bold text-foreground">{lv.title}</p>
                {lv.sub && <p className="text-label text-muted-foreground">{lv.sub}</p>}
              </div>
            </li>
          )}
          {pb && (
            <li className="flex items-start gap-2.5">
              <Timer className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-body font-bold text-foreground">153 PB 최고 기록 {pb}</p>
                <p className="text-label text-muted-foreground">8가지 종목 체력 평가 · {kid.pb?.count ?? 0}번 도전</p>
              </div>
            </li>
          )}
        </ul>
      )}

      {kid.notes.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-body font-bold text-foreground">
            <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
            코치 한마디
          </p>
          <ul className="mt-2 space-y-2">
            {kid.notes.map((n, i) => (
              <li key={`${n.day}-${i}`} className="rounded-2xl bg-muted/60 p-3">
                <p className="text-body text-foreground [text-wrap:pretty]">{n.body}</p>
                <p className="mt-1 text-label text-muted-foreground">
                  {Number(n.day.slice(5, 7))}/{Number(n.day.slice(8, 10))} · {n.who}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {kid.recent.length > 0 && (
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-body font-bold text-foreground">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            최근 운동
          </p>
          <ul className="mt-1.5 divide-y divide-border">
            {kid.recent.map((v) => (
              <li key={v.day} className="py-2 text-body tabular-nums text-foreground">
                {visitLine(v)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

const GuardianPage = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const demo = guardianDemo("demo");
  const { data, isLoading, error, refetch } = useGuardianHome(!demo);
  const home = demo ? demoHome() : data;
  const guardianOnly = demo || isGuardianOnlyProfile(profile);
  const now = Date.now();

  const logout = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  return (
    <AppPage noBottomPad={guardianOnly}>
      <header className="mb-4 flex items-center gap-2">
        {!guardianOnly && (
          <button
            type="button"
            onClick={() => navigate("/home")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
            aria-label="홈으로"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          {guardianOnly && <MyBoxerWordmark size="sm" />}
          <h1 className="text-title font-black text-foreground">우리 아이</h1>
        </div>
      </header>

      <PushOptInCard variant="inbox" className="mb-4" />

      {!demo && isLoading ? (
        <RouteLoader />
      ) : !demo && error ? (
        <div className="rounded-3xl border border-border bg-card p-5 text-center">
          <p className="text-body font-bold text-foreground">기록을 불러오지 못했어요</p>
          <button type="button" onClick={() => void refetch()} className="mt-3 rounded-xl bg-primary px-4 py-2.5 text-body font-bold text-primary-foreground active:scale-95">
            다시 불러오기
          </button>
        </div>
      ) : !home || home.kids.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <HeartHandshake className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-3 text-heading font-black text-foreground">연결된 아이가 없어요</p>
          <p className="mt-1 text-body text-muted-foreground [text-wrap:pretty]">
            아이 휴대폰의 마이복서153 › 설정 › 「엄마 · 아빠 연결」에서 링크를 받거나, 체육관 데스크에서 보호자 연결 QR을 받아 주세요.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {home.kids.map((k) => (
            <KidCard key={k.linkId} kid={k} now={now} />
          ))}
        </div>
      )}

      <div className="mt-5 rounded-2xl bg-muted/60 p-4">
        <p className="text-body font-bold text-foreground">알림은 이렇게 가요</p>
        <p className="mt-1 text-label text-muted-foreground [text-wrap:pretty]">
          체육관에 오면 도착 알림, 아이가 「운동 끝」을 누르거나 나갈 때 얼굴 인식을 하면 끝 알림이 가요. 메시지 · 커뮤니티 글 · 몸무게는 보이지 않아요.
        </p>
      </div>

      {guardianOnly && (
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-6 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-body font-bold text-muted-foreground active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          로그아웃
        </button>
      )}
      <p className="mt-6 pb-4 text-center text-label text-muted-foreground">153 건강과 행복. 153복싱짐</p>
    </AppPage>
  );
};

export default GuardianPage;
