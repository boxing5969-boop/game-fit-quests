/**
 * 🏢 지점 회의실 /office (2026-10-27 · 「마이복서153 지점 회의실 상세 보고서」 1단계)
 *
 *   보고서 추천안대로(대표님 2026-10-27 "다른 계정에서 이어서 하자"):
 *   · 위에서 내려다본 2D 블록 사무실 — 대표 책상 · 지점장 책상 · 코치 책상 8 · 회의실(10인 탁자)
 *   · 앱에 들어와 있는 지도진의 캐릭터가 자기 자리에 앉고(앱 전체 접속 신호 — OfficePresenceBridge), 나가면 30초 뒤 일어난다
 *   · 내 상태 말풍선: 자리에 있음 · 수업 중 · 자리 비움 (본인이 누르기)
 *   · 회의 열기(대표님 · 지점장) → 지도진 알림 → 회의실 화면(/office/room — 그림 + 채팅 한 화면, 말풍선) → 끝내면 회의록
 *   · 출입은 서버가 정한다(office_* 함수 · 비공개 실시간 채널) — 회원 화면에는 입구 자체가 없다.
 *   2단계 음성 · 카메라(Cloudflare RealtimeKit) · 3단계 회의록 → 전략 회의실 지시는 다음에.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import OfficeScene from "@/components/office/OfficeScene";
import { MeetingSummaryCard, MinutesSheet, OpenMeetingSheet } from "@/components/office/OfficeMeeting";
import { useOfficeOnline } from "@/lib/officePresence";
import {
  OFFICE_STATUS_LABEL,
  officeDateTime,
  officeDuration,
  officeName,
  readOfficeBranch,
  saveOfficeBranch,
  useOfficeMeetingsList,
  useOfficeSetStatus,
  useOfficeState,
  type OfficeStatus,
} from "@/services/officeService";

const STATUSES: OfficeStatus[] = ["on", "class", "away"];

const OfficePage = () => {
  const navigate = useNavigate();
  const [branch, setBranchState] = useState<string | null>(readOfficeBranch);
  const stateQ = useOfficeState(branch);
  const state = stateQ.data;
  const presence = useOfficeOnline(state?.topic);
  const setStatus = useOfficeSetStatus();
  const list = useOfficeMeetingsList(state?.branch ?? branch, !!state);
  const [openSheet, setOpenSheet] = useState(false);
  const [minutesId, setMinutesId] = useState<string | null>(null);

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
          subtitle={state ? `${state.label} · 지금 ${onlineCount}명 사무실에 있어요` : "코치님 · 지점장님 · 대표님만"}
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
      {stateQ.isLoading ? (
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

          <OfficeScene state={state} online={online} className="rounded-3xl shadow-elev-1" />

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
                          {m.decisions > 0 ? ` · 정한 것 ${m.decisions}` : ""} · {officeName(m.opened_by)}
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

      {state && (
        <OpenMeetingSheet
          open={openSheet}
          onClose={() => setOpenSheet(false)}
          branch={state.branch}
          label={state.label}
          onOpened={() => navigate("/office/room")}
        />
      )}
      <MinutesSheet meetingId={minutesId} onClose={() => setMinutesId(null)} />
    </AppPage>
  );
};

export default OfficePage;
