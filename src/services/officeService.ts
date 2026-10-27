/**
 * 🏢 지점 회의실 (2026-10-27 · 「마이복서153 지점 회의실 상세 보고서」 1단계 — 사무실 · 접속 표시 · 회의 채팅)
 *   DB: supabase/migrations/20261027140013_branch_office_room.sql — 읽기 · 쓰기는 모두 office_* 함수(서버가 지점 지도진 + 대표님만 통과)
 *   실시간: 비공개 채널 'office:<지점 코드>' — 접속 표시(Presence) + 바뀜 신호(broadcast 'changed'). lib/officePresence.ts
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export type OfficeRole = "host" | "member";
export type OfficeStatus = "on" | "class" | "away";

export interface OfficeEntry {
  branch: string;
  /** '선릉역점' */
  label: string;
  topic: string;
  role: OfficeRole;
  meeting: { id: string; title: string; opened_at: string } | null;
}

export interface OfficeMe {
  me?: string;
  offices: OfficeEntry[];
}

export interface OfficeDisplay {
  user_id: string;
  name: string;
  /** '대표' · '지점장' · '코치' (153os 직함) */
  title: string;
  avatar_url: string | null;
}

export interface OfficePerson extends OfficeDisplay {
  hq: boolean;
  host: boolean;
  /** 'boss' · 'mgr' · 'c1'~'c8' · 'x1'~'x4' · null(자리 없음) */
  seat: string | null;
  status: OfficeStatus;
  /** 캐릭터 프리셋 (없으면 기본 캐릭터) */
  style: string | null;
}

export interface OfficeAttendee {
  user_id: string;
  first_joined_at: string;
  last_joined_at: string;
  in_room: boolean;
}

export interface OfficeMeeting {
  id: string;
  title: string;
  agenda: string[];
  opened_at: string;
  opened_by: OfficeDisplay;
  /** 줌 · 구글 미트 링크 (없으면 null — 20261027204015) */
  video_url?: string | null;
  attendees: OfficeAttendee[];
}

export interface OfficeState {
  branch: string;
  label: string;
  topic: string;
  me: string;
  role: OfficeRole;
  branches: string[];
  people: OfficePerson[];
  meeting: OfficeMeeting | null;
  /** 그 지점이 마지막에 쓴 줌 · 구글 미트 링크 — 대표님 · 지점장에게만 (회의 열 때 미리 채움) */
  last_video_url?: string | null;
}

export type OfficeMessageKind = "chat" | "decision" | "system";

export interface OfficeMessage {
  id: string;
  kind: OfficeMessageKind;
  body: string;
  created_at: string;
  mine: boolean;
  author: OfficeDisplay;
}

export interface OfficeMinutes {
  meeting: {
    id: string;
    branch: string;
    title: string;
    agenda: string[];
    opened_at: string;
    closed_at: string | null;
    opened_by: OfficeDisplay;
    closed_by: OfficeDisplay | null;
    attendees: Array<OfficeDisplay & { first_joined_at: string; in_room: boolean }>;
  };
  messages: OfficeMessage[];
}

export interface OfficeMeetingSummary {
  id: string;
  title: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: OfficeDisplay;
  attendees: number;
  decisions: number;
  messages: number;
}

export const OFFICE_STATUS_LABEL: Record<OfficeStatus | "meeting", string> = {
  on: "자리에 있음",
  class: "수업 중",
  away: "자리 비움",
  meeting: "회의 중",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback || "잠시 후 다시 시도해 주세요"));
  return data as T;
}

export const OFFICE_KEY = ["office"] as const;

/* ───────────── 읽기 ───────────── */

/** 내가 들어갈 수 있는 회의실 — 코치는 내 지점 하나, 대표님은 켜진 지점 모두. 없으면 offices = [] */
export const useOfficeMe = (enabled = true) =>
  useQuery({
    queryKey: [...OFFICE_KEY, "me"],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const d = await call<OfficeMe | null>("office_me", undefined, "회의실 정보를 불러오지 못했어요");
      return { me: d?.me, offices: Array.isArray(d?.offices) ? d!.offices : [] } as OfficeMe;
    },
  });

export const useOfficeState = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...OFFICE_KEY, "state", branch],
    enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: () => call<OfficeState>("office_state", { p_branch: branch }, "회의실을 불러오지 못했어요"),
  });

export const useOfficeMessages = (meetingId: string | null | undefined, enabled = true) =>
  useQuery({
    queryKey: [...OFFICE_KEY, "messages", meetingId],
    enabled: enabled && !!meetingId,
    staleTime: 5_000,
    queryFn: () => call<OfficeMinutes>("office_messages", { p_meeting: meetingId }, "회의 채팅을 불러오지 못했어요"),
  });

export const useOfficeMeetingsList = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...OFFICE_KEY, "list", branch],
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const d = await call<OfficeMeetingSummary[] | null>("office_meetings_list", { p_branch: branch, p_limit: 20 }, "회의록을 불러오지 못했어요");
      return Array.isArray(d) ? d : [];
    },
  });

/** 음성 · 카메라 회의(2단계)를 켰나 — 영상 서비스 설정이 끝나야 회의 화면에 '음성 참여' 막대가 보인다 (실패하면 안 보임) */
export const useOfficeCallReady = (enabled = true) =>
  useQuery({
    queryKey: [...OFFICE_KEY, "call-ready"],
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("office_call_ready");
      return !error && data === true;
    },
  });

/* ───────────── 쓰기 ───────────── */

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: OFFICE_KEY });
};

export const useOfficeSetStatus = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (status: OfficeStatus) => call<void>("office_set_status", { p_status: status }, "상태를 바꾸지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useOpenMeeting = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { branch: string; title: string; agenda: string[] }) =>
      call<string>("office_open_meeting", { p_branch: v.branch, p_title: v.title, p_agenda: v.agenda }, "회의를 열지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useJoinMeeting = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (meetingId: string) => call<void>("office_join_meeting", { p_meeting: meetingId }, "회의에 들어가지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useLeaveMeeting = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (meetingId: string) => call<void>("office_leave_meeting", { p_meeting: meetingId }, "회의에서 나가지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useSendOfficeMessage = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { meetingId: string; body: string; kind?: "chat" | "decision" }) =>
      call<{ id: string }>("office_send_message", { p_meeting: v.meetingId, p_body: v.body, p_kind: v.kind ?? "chat" }, "보내지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useMarkDecision = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { messageId: string; on: boolean }) =>
      call<void>("office_mark_decision", { p_message: v.messageId, p_on: v.on }, "바꾸지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useCloseMeeting = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (meetingId: string) => call<void>("office_close_meeting", { p_meeting: meetingId }, "회의를 끝내지 못했어요"),
    onSuccess: invalidate,
  });
};

/** 줌 · 구글 미트 링크 넣기 · 바꾸기 · 빼기(빈 값) — 대표님 · 지점장 */
export const useSetMeetingLink = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (v: { meetingId: string; url: string }) =>
      call<string | null>("office_set_meeting_link", { p_meeting: v.meetingId, p_url: v.url }, "링크를 넣지 못했어요"),
    onSuccess: invalidate,
  });
};

/* ───────────── 화면 도우미 ───────────── */

/** '이재우 코치님' */
export const officeName = (p: Pick<OfficeDisplay, "name" | "title">) => `${p.name} ${p.title}님`;

/** 오후 3:05 */
export const officeTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });

/** 10월 27일 (월) 오후 3:05 */
export const officeDateTime = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });

/** 회의 시간 — '42분' · '1시간 5분' */
export const officeDuration = (from: string, to: string | null) => {
  const min = Math.max(1, Math.round(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 60_000));
  return min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ""}` : `${min}분`;
};

/** 대표님이 고른 지점 (이 기기) — 사무실 · 회의실 화면이 같이 쓴다 */
const OFFICE_BRANCH_KEY = "153office:branch";
export const readOfficeBranch = (): string | null => {
  try {
    return window.localStorage.getItem(OFFICE_BRANCH_KEY);
  } catch {
    return null;
  }
};
export const saveOfficeBranch = (branch: string) => {
  try {
    window.localStorage.setItem(OFFICE_BRANCH_KEY, branch);
  } catch {
    /* 무시 */
  }
};
