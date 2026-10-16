/**
 * 🧠 전략 회의실 — 코치진 전용 (2026-10-16 대표님: "수업 내용 저장·공유, 지점장이나 내가 전략을 공유하고 지시하는 방,
 *   드릴·트레이닝 영상을 올려 그 영상으로 오늘 훈련 프로그램을 공유받아 적용")
 *   DB: supabase/migrations/20261016030000_strategy_room.sql — 읽기·쓰기는 모두 strategy_* 함수(서버가 직원만 통과시킨다)
 *   글 종류: directive 지시 · strategy 전략 · praise 칭찬 · principle 운영 원칙 · program 오늘 프로그램 · class_log 수업 기록
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";

export type StrategyKind = "directive" | "strategy" | "praise" | "principle" | "program" | "class_log";
export type BlockKind = "warmup" | "skill" | "mitt" | "defense" | "conditioning" | "cooldown" | "etc";
export type VideoCategory = "warmup" | "drill" | "mitt" | "defense" | "conditioning" | "etc";

export interface StrategyPerson {
  user_id: string;
  name: string;
  title: string;
  avatar_url: string | null;
  has_push?: boolean;
}

export interface StrategyMe {
  staff: boolean;
  me?: string;
  hq?: boolean;
  can_direct?: boolean;
  branch?: string;
  branches?: string[];
  my_push?: boolean;
  staff_list?: StrategyPerson[];
}

export interface ProgramBlock {
  kind: BlockKind;
  title: string;
  minutes: number;
  video_id?: string | null;
  note?: string;
}

export interface DirectiveData {
  situation?: string;
  standard?: string;
  request?: string;
  target?: string;
}

export interface ProgramData {
  slot?: string;
  blocks?: ProgramBlock[];
  total_min?: number;
  template?: boolean;
}

export interface ClassLogData {
  hour?: number;
  attendees?: number | null;
  program_id?: string | null;
  program_title?: string | null;
  went_well?: string;
  issues?: string;
  next_focus?: string;
}

export interface StrategyAck {
  read_at: string | null;
  acked_at: string | null;
  applied_at: string | null;
}

export interface StrategyItem {
  id: string;
  kind: StrategyKind;
  title: string;
  body: string;
  data: DirectiveData & ProgramData & ClassLogData & Record<string, unknown>;
  principle_no: number | null;
  starred: boolean;
  event_date: string | null;
  target_user_ids: string[] | null;
  created_at: string;
  updated_at: string;
  author: StrategyPerson;
  mine: boolean;
  my_ack: StrategyAck | null;
  targets: number;
  acked: number;
  applied: number;
  comments: number;
}

export interface StrategyComment {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  author: StrategyPerson;
}

export interface StrategyVideo {
  id: string;
  title: string;
  category: VideoCategory;
  level_min: number | null;
  minutes: number | null;
  equipment: string | null;
  points: string[];
  source: "upload" | "youtube" | "url";
  storage_path: string | null;
  url: string | null;
  created_at: string;
  mine: boolean;
  uploader: StrategyPerson;
}

export interface AckStatusRow extends StrategyPerson, StrategyAck {}

export const KIND_LABEL: Record<StrategyKind, string> = {
  directive: "지시",
  strategy: "전략",
  praise: "칭찬",
  principle: "운영 원칙",
  program: "오늘 프로그램",
  class_log: "수업 기록",
};

/** 50분 4블록 수업(docs/50분수업-새틀.md) 이름을 따른다 — 본운동 안에서 기술·미트·수비로 더 나눠 쓸 수 있다 */
export const BLOCK_LABEL: Record<BlockKind, string> = {
  warmup: "워밍업",
  skill: "본운동",
  mitt: "미트",
  defense: "수비",
  conditioning: "마무리운동",
  cooldown: "쿨다운",
  etc: "기타",
};

/** 새 프로그램 기본 틀 — 50분 4블록 (워밍업 10 · 본운동 25 · 마무리 10 · 쿨다운 5) */
export const DEFAULT_BLOCKS: ProgramBlock[] = [
  { kind: "warmup", title: "", minutes: 10 },
  { kind: "skill", title: "", minutes: 25 },
  { kind: "conditioning", title: "", minutes: 10 },
  { kind: "cooldown", title: "", minutes: 5 },
];

export const VIDEO_CATEGORY_LABEL: Record<VideoCategory, string> = {
  warmup: "워밍업",
  drill: "드릴",
  mitt: "미트",
  defense: "수비",
  conditioning: "컨디셔닝",
  etc: "기타",
};

export const STRATEGY_VIDEO_BUCKET = "strategy-videos";
export const STRATEGY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

async function call<T>(name: string, args: Record<string, unknown> | undefined, fallback: string): Promise<T> {
  const { data, error } = await rpc(name, args);
  if (error) throw new Error(translateError(error, fallback || "잠시 후 다시 시도해 주세요"));
  return data as T;
}

const KEY = ["strategy"] as const;

/* ───────────── 읽기 ───────────── */

export const useStrategyMe = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...KEY, "me", branch],
    enabled,
    staleTime: 60_000,
    queryFn: () => call<StrategyMe>("strategy_me", { p_branch: branch }, "전략 회의실 정보를 불러오지 못했어요"),
  });

export const useStrategyFeed = (branch: string | null, kinds: StrategyKind[], enabled = true) =>
  useQuery({
    queryKey: [...KEY, "feed", branch, kinds.join(",")],
    enabled,
    staleTime: 15_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<StrategyItem[]> => {
      const res = await call<{ rows?: StrategyItem[] }>(
        "strategy_feed",
        { p_branch: branch, p_kinds: kinds, p_limit: 100 },
        "글을 불러오지 못했어요",
      );
      return res?.rows ?? [];
    },
  });

export const useStrategyVideos = (branch: string | null, enabled = true) =>
  useQuery({
    queryKey: [...KEY, "videos", branch],
    enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<StrategyVideo[]> =>
      (await call<StrategyVideo[]>("strategy_videos_list", { p_branch: branch }, "영상을 불러오지 못했어요")) ?? [],
  });

export const useStrategyComments = (itemId: string | null) =>
  useQuery({
    queryKey: [...KEY, "comments", itemId],
    enabled: !!itemId,
    staleTime: 10_000,
    queryFn: async (): Promise<StrategyComment[]> =>
      (await call<StrategyComment[]>("strategy_comments", { p_item: itemId }, "댓글을 불러오지 못했어요")) ?? [],
  });

export const useStrategyAckStatus = (itemId: string | null) =>
  useQuery({
    queryKey: [...KEY, "acks", itemId],
    enabled: !!itemId,
    staleTime: 10_000,
    queryFn: async (): Promise<AckStatusRow[]> =>
      (await call<AckStatusRow[]>("strategy_ack_status", { p_item: itemId }, "확인 현황을 불러오지 못했어요")) ?? [],
  });

/** 메시지 탭 '전략' 빨간 점 — 내가 아직 확인 안 한 지시·프로그램 수 */
export const useStrategyBadge = (enabled: boolean) =>
  useQuery({
    queryKey: [...KEY, "badge"],
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<number> => Number(await call<number>("strategy_badge", undefined, "")) || 0,
  });

export async function fetchHeadcount(branch: string | null, date: string, hour: number) {
  return call<{ attendees: number; staff_checked_in: string[] }>(
    "strategy_class_headcount",
    { p_branch: branch, p_date: date, p_hour: hour },
    "출석 인원을 불러오지 못했어요",
  );
}

/** 올린 영상 보기 — 1시간짜리 서명 주소 (직원만 받을 수 있다) */
export async function strategyVideoUrl(v: StrategyVideo): Promise<string> {
  if (v.source !== "upload") return v.url ?? "";
  const { data, error } = await supabase.storage.from(STRATEGY_VIDEO_BUCKET).createSignedUrl(v.storage_path ?? "", 3600);
  if (error || !data?.signedUrl) throw new Error("영상을 열 수 없어요 — 잠시 후 다시 눌러 주세요");
  return data.signedUrl;
}

/* ───────────── 쓰기 ───────────── */

const useInvalidate = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
};

export interface SaveInput {
  id?: string | null;
  branch: string | null;
  kind: StrategyKind;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  eventDate?: string | null;
  targets?: string[] | null;
}

export const useSaveStrategy = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (i: SaveInput) =>
      call<string>(
        "strategy_save",
        {
          p_id: i.id ?? null,
          p_branch: i.branch,
          p_kind: i.kind,
          p_title: i.title,
          p_body: i.body ?? "",
          p_data: i.data ?? {},
          p_event_date: i.eventDate ?? null,
          p_targets: i.targets && i.targets.length > 0 ? i.targets : null,
        },
        "저장하지 못했어요 — 다시 눌러 주세요",
      ),
    onSuccess: invalidate,
  });
};

export const useDeleteStrategy = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("strategy_delete", { p_id: id }, "지우지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useAckStrategy = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, what }: { id: string; what: "read" | "ack" | "applied" }) =>
      call<void>("strategy_ack", { p_id: id, p_what: what }, "확인을 저장하지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useStarStrategy = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => call<void>("strategy_star", { p_id: id, p_on: on }, "추천을 저장하지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useAddComment = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ itemId, body }: { itemId: string; body: string }) =>
      call<string>("strategy_comment_add", { p_item: itemId, p_body: body }, "댓글을 남기지 못했어요"),
    onSuccess: invalidate,
  });
};

export const useDeleteComment = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("strategy_comment_delete", { p_id: id }, "댓글을 지우지 못했어요"),
    onSuccess: invalidate,
  });
};

export interface VideoInput {
  branch: string | null;
  title: string;
  category: VideoCategory;
  minutes: number | null;
  equipment: string;
  points: string[];
  file?: File | null;
  url?: string | null;
}

const videoContentType = (file: File): string => {
  if (file.type && file.type.startsWith("video/")) return file.type === "video/x-matroska" ? "video/webm" : file.type;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "mov") return "video/quicktime";
  if (ext === "webm") return "video/webm";
  if (ext === "3gp") return "video/3gpp";
  if (ext === "m4v") return "video/x-m4v";
  return "video/mp4";
};

export const useAddVideo = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: VideoInput): Promise<string> => {
      let source: "upload" | "youtube" | "url" = "url";
      let storagePath: string | null = null;
      let url: string | null = null;
      if (v.file) {
        if (v.file.size > STRATEGY_VIDEO_MAX_BYTES) {
          throw new Error(`영상이 너무 커요 (${(v.file.size / 1024 / 1024).toFixed(0)}MB) — 50MB까지예요. 길면 유튜브 링크로 올려 주세요`);
        }
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("다시 로그인해 주세요");
        const type = videoContentType(v.file);
        const ext = type === "video/quicktime" ? "mov" : type === "video/webm" ? "webm" : type === "video/3gpp" ? "3gp" : "mp4";
        storagePath = `${uid}/${crypto.randomUUID()}.${ext}`;
        const body = v.file.type === type ? v.file : new Blob([v.file], { type });
        const up = await supabase.storage
          .from(STRATEGY_VIDEO_BUCKET)
          .upload(storagePath, body, { contentType: type, upsert: false, cacheControl: "3600" });
        if (up.error) {
          const m = up.error.message || "";
          if (/exceed|too large|size/i.test(m)) throw new Error("영상이 너무 커요 — 50MB까지예요");
          throw new Error(`영상을 올리지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요 (${m || "업로드 실패"})`);
        }
        source = "upload";
      } else {
        url = (v.url ?? "").trim();
        if (!/^https:\/\/\S+$/i.test(url)) throw new Error("https:// 로 시작하는 영상 주소를 넣어 주세요");
        source = /youtube\.com|youtu\.be/i.test(url) ? "youtube" : "url";
      }
      return call<string>(
        "strategy_video_add",
        {
          p_branch: v.branch,
          p_title: v.title,
          p_category: v.category,
          p_level_min: null,
          p_minutes: v.minutes,
          p_equipment: v.equipment,
          p_points: v.points.filter((p) => p.trim()),
          p_source: source,
          p_storage_path: storagePath,
          p_url: url,
        },
        "영상을 저장하지 못했어요",
      );
    },
    onSuccess: invalidate,
  });
};

export const useDeleteVideo = () => {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => call<void>("strategy_video_delete", { p_id: id }, "영상을 지우지 못했어요"),
    onSuccess: invalidate,
  });
};

/* ───────────── 오삼코치 지시 다듬기 (기존 AI 경로 chat-assistant 의 action) ───────────── */

export interface PolishedDirective {
  title: string;
  situation: string;
  standard: string;
  request: string;
  target: string;
}

export async function polishDirective(text: string): Promise<PolishedDirective> {
  const { data, error } = await supabase.functions.invoke("chat-assistant", {
    body: { action: "polish-directive", text },
  });
  if (error) {
    // 서버가 돌려준 한국어 안내가 있으면 그대로
    let message = "";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctx = (error as any)?.context;
      if (ctx && typeof ctx.json === "function") message = (await ctx.json())?.message ?? "";
    } catch {
      /* 무시 */
    }
    throw new Error(message || "지금은 정리하지 못했어요 — 4칸을 직접 써 주세요");
  }
  if (!data?.ok || !data?.result) throw new Error(data?.message || "지금은 정리하지 못했어요 — 4칸을 직접 써 주세요");
  return data.result as PolishedDirective;
}

/* ───────────── 도우미 ───────────── */

export const kstToday = (): string =>
  new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export const kstHour = (): number => new Date(Date.now() + 9 * 3600_000).getUTCHours();

export const strategyTime = (iso: string): string =>
  new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const shortDate = (d: string | null | undefined): string => {
  if (!d) return "";
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
};

export const programTotal = (blocks: ProgramBlock[] | undefined): number =>
  (blocks ?? []).reduce((s, b) => s + (Number(b.minutes) || 0), 0);
