/**
 * ⭐ 리뷰 미션 — 네이버 · 구글 · 당근 (2026-11-21 대표님 「버튼을 클릭하면 리뷰를 달 수 있는 주소로 이동하고 리뷰를 달면 마일리지와 선물」).
 *
 * 정본은 서버 — get_my_review_missions · review_mission_open · review_mission_submit (회원)
 *              review_mission_admin_board · review_mission_link_save · review_mission_decide (운영진)
 * 흐름: 버튼 → 주소 열기(open) → 인증 사진(review-proofs/<내 id>/…) → 확인 요청(submit · 지점장님 알림)
 *       → 운영진 승인(decide) = 153 마일리지 + 카드 꾸미기 선물 + 알림. 별점 · 내용과 상관없이 드린다.
 * 캐시 키는 153review: 로 시작한다.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/imageCompression";
import { translateError } from "@/lib/errorMessages";

export type ReviewPlatform = "naver" | "google" | "daangn";
export type ReviewStatus = "none" | "opened" | "submitted" | "approved" | "rejected";

export const REVIEW_PLATFORMS: readonly ReviewPlatform[] = ["naver", "google", "daangn"];

export const PLATFORM_LABEL: Record<ReviewPlatform, string> = {
  naver: "네이버",
  google: "구글",
  daangn: "당근",
};

/** 버튼 색 — 플랫폼을 바로 알아보게(로고는 쓰지 않는다 · 글자 + 색만) */
export const PLATFORM_TONE: Record<ReviewPlatform, { bg: string; fg: string; ring: string }> = {
  naver: { bg: "bg-[#03C75A]", fg: "text-white", ring: "ring-[#03C75A]/30" },
  google: { bg: "bg-white", fg: "text-[#1f1f1f]", ring: "ring-black/10" },
  daangn: { bg: "bg-[#FF6F0F]", fg: "text-white", ring: "ring-[#FF6F0F]/30" },
};

/** 리뷰 쓰는 법 한 줄 — 플랫폼마다 막히는 곳이 달라서 */
export const PLATFORM_HOWTO: Record<ReviewPlatform, string> = {
  naver: "네이버 플레이스 › 리뷰 › 영수증 · 결제 인증 뒤 리뷰 쓰기",
  google: "구글 지도 › 리뷰 › 리뷰 작성 (구글 계정 로그인)",
  daangn: "당근 › 우리 체육관 프로필 › 후기 남기기",
};

export interface ReviewMission {
  platform: ReviewPlatform;
  /** 보상 없이 부탁만(구글 — 구글 지도 정책은 대가를 준 리뷰를 금지) · 인증 사진 없음 */
  askOnly: boolean;
  url: string;
  mileage: number;
  gifts: string[];
  status: ReviewStatus;
  reject_reason: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  reward_mileage: number | null;
}

export interface MyReviewMissions {
  on: boolean;
  branch: string | null;
  missions: ReviewMission[];
  allGifts: string[];
  allDone: boolean;
  done: number;
  total: number;
}

const isPlatform = (v: unknown): v is ReviewPlatform => v === "naver" || v === "google" || v === "daangn";
const STATUSES: readonly ReviewStatus[] = ["none", "opened", "submitted", "approved", "rejected"];
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

export function parseMyReviewMissions(raw: unknown): MyReviewMissions {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const missions: ReviewMission[] = (Array.isArray(r.missions) ? r.missions : [])
    .map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>) : null))
    .filter((m): m is Record<string, unknown> => !!m && isPlatform(m.platform) && typeof m.url === "string")
    .map((m) => ({
      platform: m.platform as ReviewPlatform,
      askOnly: m.ask_only === true || m.platform === "google",
      url: m.url as string,
      mileage: num(m.mileage),
      gifts: strs(m.gifts),
      status: STATUSES.find((s) => s === m.status) ?? "none",
      reject_reason: str(m.reject_reason),
      submitted_at: str(m.submitted_at),
      decided_at: str(m.decided_at),
      reward_mileage: typeof m.reward_mileage === "number" ? m.reward_mileage : null,
    }));
  return {
    on: r.on === true && missions.length > 0,
    branch: str(r.branch),
    missions,
    allGifts: strs(r.all_gifts),
    allDone: r.all_done === true,
    done: num(r.done),
    total: num(r.total, missions.length),
  };
}

/** 남은 미션의 마일리지 합 — 홈 띠 '+9,000점' */
export const remainingMileage = (d: MyReviewMissions | null | undefined) =>
  (d?.missions ?? []).filter((m) => m.status !== "approved").reduce((s, m) => s + m.mileage, 0);

/** 상태 글 */
export function statusText(m: ReviewMission): string {
  switch (m.status) {
    case "approved":
      return "완료 · 선물 받았어요";
    case "submitted":
      return "확인 중 · 보통 하루 안에 확인해요";
    case "rejected":
      return m.reject_reason ? `다시 올려 주세요 · ${m.reject_reason}` : "다시 올려 주세요";
    case "opened":
      return "리뷰를 남겼으면 인증 사진을 올려 주세요";
    default:
      return "";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args ?? {});

export const REVIEW_KEY = "153review";

export function useMyReviewMissions(enabled = true) {
  const { user } = useAuth();
  return useQuery<MyReviewMissions>({
    queryKey: [REVIEW_KEY, "me", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await rpc("get_my_review_missions");
      if (error) {
        // 서버 함수가 아직 없는 옛 DB · 지도진 등 — 미션을 안 보인다
        return parseMyReviewMissions(null);
      }
      return parseMyReviewMissions(data);
    },
  });
}

export function useInvalidateReview() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [REVIEW_KEY] });
}

/** 버튼 → 리뷰 주소 (기록을 남기고 주소를 돌려받는다). 실패하면 알던 주소 그대로 */
export async function openReviewMission(platform: ReviewPlatform, fallbackUrl: string): Promise<string> {
  try {
    const { data, error } = await rpc("review_mission_open", { p_platform: platform });
    if (!error && data && typeof (data as { url?: unknown }).url === "string") return (data as { url: string }).url;
  } catch {
    /* 기록을 못 남겨도 리뷰 쓰러 가는 길은 막지 않는다 */
  }
  return fallbackUrl;
}

/** 인증 사진 올리기 + 확인 요청 — 사진은 긴 변 1600px JPEG 로 줄여 내 폴더에 */
export async function submitReviewMission(userId: string, platform: ReviewPlatform, file: File, note?: string) {
  if (!file.type.startsWith("image/")) throw new Error("사진 파일을 골라 주세요");
  let blob: Blob = file;
  try {
    blob = await compressImage(file, 1600, 0.8);
  } catch {
    /* 줄이기에 실패하면 원본(5MB 까지) */
  }
  if (blob.size > 5 * 1024 * 1024) throw new Error("사진이 너무 커요 · 화면 캡처로 다시 올려 주세요");
  const path = `${userId}/${platform}_${Date.now()}.jpg`;
  const up = await supabase.storage.from("review-proofs").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new Error("사진을 올리지 못했어요 · 잠시 뒤 다시 해 주세요");
  const { error } = await rpc("review_mission_submit", { p_platform: platform, p_proof_path: path, p_note: note ?? null });
  if (error) throw new Error(translateError(error));
}

// ── 운영진 ──────────────────────────────────────────────────────────────────────────────
export interface ReviewLinkAdmin {
  platform: ReviewPlatform;
  url: string | null;
  enabled: boolean;
  mileage: number;
  gifts: string[];
}
export interface ReviewClaimAdmin {
  id: string;
  platform: ReviewPlatform;
  status: "submitted" | "approved" | "rejected";
  proof_path: string | null;
  note: string | null;
  member_name: string;
  member_nickname: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  reject_reason: string | null;
  reward_mileage: number | null;
}
export interface ReviewAdminBoard {
  available: boolean;
  scope: "all" | "branch";
  branch: string;
  canEdit: boolean;
  links: ReviewLinkAdmin[];
  claims: ReviewClaimAdmin[];
  allGifts: string[];
  pending: number;
  approved: number;
}

export function parseReviewAdminBoard(raw: unknown): ReviewAdminBoard {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!r) return { available: false, scope: "branch", branch: "", canEdit: false, links: [], claims: [], allGifts: [], pending: 0, approved: 0 };
  const links = (Array.isArray(r.links) ? r.links : [])
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => !!x && isPlatform(x.platform))
    .map((x) => ({
      platform: x.platform as ReviewPlatform,
      url: str(x.url),
      enabled: x.enabled !== false,
      mileage: num(x.mileage, 3000),
      gifts: strs(x.gifts),
    }));
  const claims = (Array.isArray(r.claims) ? r.claims : [])
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => !!x && isPlatform(x.platform) && typeof x.id === "string")
    .map((x) => ({
      id: x.id as string,
      platform: x.platform as ReviewPlatform,
      status: (x.status === "approved" || x.status === "rejected" ? x.status : "submitted") as ReviewClaimAdmin["status"],
      proof_path: str(x.proof_path),
      note: str(x.note),
      member_name: str(x.member_name) ?? "회원",
      member_nickname: str(x.member_nickname),
      submitted_at: str(x.submitted_at),
      decided_at: str(x.decided_at),
      reject_reason: str(x.reject_reason),
      reward_mileage: typeof x.reward_mileage === "number" ? x.reward_mileage : null,
    }));
  return {
    available: true,
    scope: r.scope === "all" ? "all" : "branch",
    branch: str(r.branch) ?? "",
    canEdit: r.can_edit === true,
    links,
    claims,
    allGifts: strs(r.all_gifts),
    pending: num(r.pending),
    approved: num(r.approved),
  };
}

export function useReviewAdminBoard(branch: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery<ReviewAdminBoard>({
    queryKey: [REVIEW_KEY, "admin", user?.id ?? "anon", branch ?? ""],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await rpc("review_mission_admin_board", { p_branch: branch });
      if (error) return parseReviewAdminBoard(null);
      return parseReviewAdminBoard(data);
    },
  });
}

export async function saveReviewLink(branch: string, l: { platform: ReviewPlatform; url: string | null; enabled: boolean; mileage: number }) {
  const { error } = await rpc("review_mission_link_save", {
    p_branch: branch,
    p_platform: l.platform,
    p_url: l.url,
    p_enabled: l.enabled,
    p_mileage: l.mileage,
  });
  if (error) throw new Error(translateError(error));
}

export async function decideReviewClaim(id: string, approve: boolean, reason?: string) {
  const { data, error } = await rpc("review_mission_decide", { p_id: id, p_approve: approve, p_reason: reason ?? null });
  if (error) throw new Error(translateError(error));
  return data as { status?: string; mileage?: number; bonus?: boolean } | null;
}

/** 인증 사진 보기 — 10분짜리 주소 */
export async function proofUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("review-proofs").createSignedUrl(path, 600);
  return error ? null : data?.signedUrl ?? null;
}
