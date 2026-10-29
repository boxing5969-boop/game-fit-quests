/**
 * 🏢 지점 회의실 /office (2026-10-27 · 「마이복서153 지점 회의실 상세 보고서」 1단계)
 *
 *   보고서 추천안대로(대표님 2026-10-27 "다른 계정에서 이어서 하자"):
 *   · 위에서 내려다본 2D 블록 사무실 — 대표 책상 · 지점장 책상 · 코치 책상 8 · 회의실(10인 탁자)
 *   · 앱에 들어와 있는 지도진의 캐릭터가 자기 자리에 앉고(앱 전체 접속 신호 — OfficePresenceBridge), 나가면 30초 뒤 일어난다
 *   · 내 상태 말풍선: 자리에 있음 · 수업 중 · 자리 비움 (본인이 누르기)
 *   · 회의 열기(대표님 · 지점장) → 지도진 알림 → 회의실 화면(/office/room — 그림 + 채팅 한 화면, 말풍선) → 끝내면 회의록
 *   · 출입은 서버가 정한다(office_* 함수 · 비공개 실시간 채널) — 회원 화면에는 입구 자체가 없다.
 *   2단계 음성 · 카메라(Cloudflare RealtimeKit — 회의 화면) · 3단계 회의록 → 전략 회의실 지시 · 못 오신 분 요약(끝내기 시트 · 회의록)
 *   ?minutes=<회의> 로 오면 그 회의록을 바로 연다 (못 오신 회의 요약 알림 · 지시 카드 '회의록 보기')
 *   정기 회의 예약(2026-10-27) — '정기 회의' 칸(OfficeSchedule): 미리 알림 · 시간에 회의가 저절로 열림 · 지금 열기
 *
 *   전략 회의실 합치기 (2026-10-29 대표님 "둘다 비슷한 기능이라 지점회의실에 전략 회의실 기능을 넣어주고 전략회의실은 메뉴에서 빼줘"):
 *   · 탭 두 개 — 사무실(위 그대로) · 전략 회의(예전 메시지 '전략' 칸의 StrategyRoom 그대로: 지시·전략 · 오늘 프로그램 · 수업 기록 · 영상)
 *   · /office?tab=strategy — 예전 주소 /messages?tab=strategy(서버 알림 링크)는 MessagesPage 가 여기로 넘긴다
 *   · 사무실이 아직 안 켜진 지점(office_me 에 없음)의 코치님은 전략 회의만 — 전체 메뉴 '지점 회의실' 칸은 코치진 모두에게
 *   · 서버(office_* · strategy_*)는 그대로 — 화면 입구만 하나로
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useDmSummary } from "@/hooks/useDm";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import OfficeScene from "@/components/office/OfficeScene";
import { MeetingSummaryCard, MinutesSheet, OpenMeetingSheet } from "@/components/office/OfficeMeeting";
import { ScheduleSection } from "@/components/office/OfficeSchedule";
import StrategyRoom from "@/components/strategy/StrategyRoom";
import { useOfficeOnline } from "@/lib/officePresence";
import { useStrategyBadge } from "@/services/strategyService";
import {
  OFFICE_STATUS_LABEL,
  officeDateTime,
  officeDuration,
  officeName,
  readOfficeBranch,
  saveOfficeBranch,
  useOfficeMe,
  useOfficeMeetingsList,
  useOfficeSetStatus,
  useOfficeState,
  type OfficeStatus,
} from "@/services/officeService";

const STATUSES: OfficeStatus[] = ["on", "class", "away"];

type OfficeTab = "office" | "strategy";

const OfficePage = () => {
  const navigate = useNavigate();
  // 코치진 — 코치님(앱 권한이 '회원'이어도 서버가 코치로 본 사람) · 지점장 · 운영진. 전체 메뉴 칸과 같은 기준
  const { role } = useAuth();
  const dmQ = useDmSummary();
  const adminRole = role === "branch_manager" || role === "super_admin" || role === "admin";
  const staff = adminRole || dmQ.data?.kind === "coach" || dmQ.data?.kind === "hq";
  const staffKnown = adminRole || dmQ.isSuccess || dmQ.isError;
  // 사무실이 켜진 지점의 지도진 · 대표님만 사무실 탭 (서버 office_me)
  const officeMeQ = useOfficeMe(staff);
  const hasOffice = (officeMeQ.data?.offices.length ?? 0) > 0;
  const officeKnown = officeMeQ.isSuccess || officeMeQ.isError;
  const { data: strategyBadge = 0 } = useStrategyBadge(staff);

  const [branch, setBranchState] = useState<string | null>(readOfficeBranch);
  const stateQ = useOfficeState(branch, hasOffice);
  const state = stateQ.data;
  const presence = useOfficeOnline(state?.topic);
  const setStatus = useOfficeSetStatus();
  const list = useOfficeMeetingsList(state?.branch ?? branch, !!state);
  const [openSheet, setOpenSheet] = useState(false);
  const [minutesId, setMinutesId] = useState<string | null>(null);
  // 알림 '못 오신 회의 요약'(3단계) · 전략 회의실 지시의 '회의록 보기' — /office?minutes=<회의>
  const [params, setParams] = useSearchParams();
  const minutesParam = params.get("minutes");
  useEffect(() => {
    if (minutesParam && /^[0-9a-f-]{36}$/i.test(minutesParam)) setMinutesId(minutesParam);
  }, [minutesParam]);

  // 탭 — ?tab=strategy 면 전략 회의. 사무실이 없는 지점 코치님은 늘 전략 회의
  const tab: OfficeTab = params.get("tab") === "strategy" || (officeKnown && !hasOffice) ? "strategy" : "office";
  const setTab = (t: OfficeTab) =>
    setParams(
      (p) => {
        if (t === "strategy") p.set("tab", "strategy");
        else p.delete("tab");
        p.delete("minutes");
        return p;
      },
      { replace: true },
    );
  // 회의록의 '확인하러 가기'(→ 전략 회의)로 탭이 바뀌면 열려 있던 회의록을 닫는다
  useEffect(() => {
    if (tab === "strategy") setMinutesId(null);
  }, [tab]);
  const closeMinutes = () => {
    setMinutesId(null);
    if (minutesParam)
      setParams(
        (p) => {
          p.delete("minutes");
          return p;
        },
        { replace: true },
      );
  };

  const setBranch = (b: string) => {
    setBranchState(b);
    saveOfficeBranch(b);
  };

  // 실시간 접속 목록이 아직 안 왔으면 나만이라도 앉혀 둔다 (화면을 연 사람은 지금 들어와 있다)
  const online = useMemo(() => {
    if (!state) return presence.online;
    if (presence.online.has(state.me)) return presence.online;
    const s = new Set(presence.online);
    s.add(state.me);
    return s;
  }, [presence.online, state]);

  const myStatus = state?.people.find((p) => p.user_id === state.me)?.status ?? "on";
  const onlineCount = state ? state.people.filter((p) => online.has(p.user_id)).length : 0;
  const pastMeetings = (list.data ?? []).filter((m) => m.closed_at);

  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/home", { replace: true });
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="지점 회의실"
          subtitle={
            tab === "office" && state ? `${state.label} · 지금 ${onlineCount}명 사무실에 있어요` : "코치님 · 지점장님 · 대표님만"
          }
          sticky
          leftAction={
            <button
              type="button"
              onClick={goBack}
              aria-label="뒤로"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
        />
      }
    >
      {!staffKnown || (staff && !officeKnown) ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-12 animate-pulse rounded-2xl bg-card shadow-elev-1" />
          <div className="aspect-[4/5] w-full animate-pulse rounded-3xl bg-card shadow-elev-1" />
        </div>
      ) : !staff ? (
        <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
          <p className="text-body font-bold text-foreground">지점 회의실에 들어올 수 없어요</p>
          <p className="mt-1.5 text-label leading-relaxed text-muted-foreground">코치님 · 지점장님 · 대표님만 들어올 수 있어요</p>
        </div>
      ) : (
      <div className="space-y-4">
        {/* 탭 — 사무실 · 전략 회의 (사무실이 없는 지점은 전략 회의만) */}
        {hasOffice ? (
          <div role="tablist" aria-label="지점 회의실" className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary/70 p-1">
            {(
              [
                { v: "office", label: "사무실", badge: 0 },
                { v: "strategy", label: "전략 회의", badge: strategyBadge },
              ] as const
            ).map((t) => (
              <button
                key={t.v}
                type="button"
                role="tab"
                aria-selected={tab === t.v}
                onClick={() => tab !== t.v && setTab(t.v)}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-xl text-body font-black transition-all active:scale-[0.98]",
                  tab === t.v ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
                )}
              >
                {t.label}
                {t.badge > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-micro font-black tabular-nums text-destructive-foreground">
                    {t.badge > 99 ? "99+" : t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="px-1 text-label text-muted-foreground">사무실 · 회의는 아직 우리 지점에 열리지 않았어요</p>
        )}

      {tab === "strategy" ? (
        <StrategyRoom />
      ) : stateQ.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <div className="aspect-[4/5] w-full animate-pulse rounded-3xl bg-card shadow-elev-1" />
          <div className="h-24 animate-pulse rounded-3xl bg-card shadow-elev-1" />
        </div>
      ) : stateQ.isError || !state ? (
        <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
          <p className="text-[15px] font-bold text-foreground">지점 회의실에 들어올 수 없어요</p>
          <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-relaxed text-muted-foreground">
            {(stateQ.error as Error | null)?.message ?? "우리 지점 코치님 · 지점장님만 들어올 수 있어요"}
          </p>
          <button
            type="button"
            onClick={() => void stateQ.refetch()}
            className="mt-4 rounded-2xl bg-secondary px-4 py-2 text-[13px] font-bold text-foreground active:scale-95"
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 대표님 — 지점 고르기 (켜진 지점이 둘 이상일 때) */}
          {state.branches.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {state.branches.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBranch(b)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-bold active:scale-95",
                    b === state.branch
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  {b.replace("153복싱짐", "").trim()}
                </button>
              ))}
            </div>
          )}

          <OfficeScene state={state} online={online} voice={{ calls: presence.calls }} className="rounded-3xl shadow-elev-1" />

          {/* 내 상태 말풍선 */}
          <div className="rounded-3xl bg-card p-3.5 shadow-elev-1">
            <p className="px-0.5 text-[12.5px] font-bold text-muted-foreground">내 자리 말풍선</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={setStatus.isPending}
                  onClick={() =>
                    s !== myStatus &&
                    setStatus.mutate(s, { onError: (e) => toast.error((e as Error).message) })
                  }
                  className={cn(
                    "h-10 rounded-2xl border text-[13px] font-black transition-colors active:scale-[0.98] disabled:opacity-70",
                    s === myStatus
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground",
                  )}
                >
                  {OFFICE_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {!presence.connected && (
              <p className="mt-2 px-0.5 text-[11.5px] text-muted-foreground">실시간 연결 중… 접속 표시가 조금 늦을 수 있어요</p>
            )}
          </div>

          {/* 회의 */}
          {state.meeting ? (
            <MeetingSummaryCard state={state} online={online} onEnter={() => navigate("/office/room")} />
          ) : (
            <div className="rounded-3xl bg-card p-4 shadow-elev-1">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-secondary">
                  <Users className="h-[18px] w-[18px] text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-black text-foreground">지금은 열린 회의가 없어요</p>
                  <p className="text-[12px] text-muted-foreground">
                    {state.role === "host"
                      ? "회의를 열면 지도진에게 휴대폰 알림이 가요"
                      : "대표님이나 지점장님이 회의를 열면 알림이 와요"}
                  </p>
                </div>
              </div>
              {state.role === "host" && (
                <button
                  type="button"
                  onClick={() => setOpenSheet(true)}
                  className="mt-3.5 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-foreground text-[15px] font-black text-background active:scale-[0.99]"
                >
                  <Plus className="h-4 w-4" /> 회의 열기
                </button>
              )}
            </div>
          )}

          {/* 정기 회의 예약 — 미리 알림 · 시간에 회의 열기 (2026-10-27) */}
          <ScheduleSection state={state} />

          {/* 지난 회의록 */}
          <section>
            <h2 className="px-1 text-[15px] font-black text-foreground">지난 회의록</h2>
            {list.isLoading ? (
              <div className="mt-2 h-16 animate-pulse rounded-3xl bg-card shadow-elev-1" />
            ) : pastMeetings.length === 0 ? (
              <p className="mt-2 rounded-3xl bg-card px-4 py-5 text-center text-[12.5px] text-muted-foreground shadow-elev-1">
                끝난 회의가 여기에 회의록으로 남아요
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-border/70 overflow-hidden rounded-3xl bg-card shadow-elev-1">
                {pastMeetings.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setMinutesId(m.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-secondary/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-bold text-foreground">{m.title}</p>
                        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                          {officeDateTime(m.opened_at)} · {officeDuration(m.opened_at, m.closed_at)} · 참석 {m.attendees}명
                          {m.decisions > 0 ? ` · 정한 것 ${m.decisions}` : ""} · {m.scheduled ? "정기 회의" : officeName(m.opened_by)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      </div>
      )}

      {state && (
        <OpenMeetingSheet
          open={openSheet}
          onClose={() => setOpenSheet(false)}
          branch={state.branch}
          label={state.label}
          lastLink={state.last_video_url}
          onOpened={() => navigate("/office/room")}
        />
      )}
      <MinutesSheet meetingId={minutesId} onClose={closeMinutes} />
    </AppPage>
  );
};

export default OfficePage;
