/**
 * 🧭 지도자 홈 — 서버 함수 감싸기 (DB 20261126122904_leader_home.sql · Edge Function leader-kpi)
 *   leader_home · leader_contact_save · leader_contact_undo · leader_photo_saved · leader_photo_remove
 *   코치용 사진 = 비공개 저장소 coach-photos/<회원>/face.jpg (그 지점 지도진 · 본사만 — 1시간짜리 서명 주소로 본다)
 *   재등록률이 없거나 오래됐으면 leader-kpi 를 한 번 불러 다시 계산한다(서버가 30분 안 계산은 건너뜀).
 *   함수가 아직 없거나(적용 전 · 옛 DB 미리보기) 막히면 꺼진 것으로 본다 — 홈은 지금 그대로.
 *   캐시 키는 "153leader" 로 시작. 글 · 계산은 src/lib/leaderHome.ts.
 */
import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";
import { translateError } from "@/lib/errorMessages";
import {
  COACH_PHOTO_CONSENT_VERSION,
  LEADER_OFF,
  normalizeLeaderHome,
  type ContactKind,
  type LeaderHomeData,
  type LeaderTopic,
  type RxKey,
} from "@/lib/leaderHome";

export const LEADER_KEY = ["153leader"] as const;
const BUCKET = "coach-photos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase as any).rpc(name, args);

/** 지도자 홈 한 번에 — 켠 지점 지도진 · 본사만(그 밖은 꺼짐) */
export function useLeaderHome(branch: string | null, enabled = true) {
  const { user } = useAuth();
  return useQuery<LeaderHomeData>({
    queryKey: [...LEADER_KEY, "home", branch ?? "mine", user?.id ?? "anon"],
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    refetchInterval: 120_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await rpc("leader_home", { p_branch: branch ?? null });
      if (error) return LEADER_OFF;
      return normalizeLeaderHome(data);
    },
  });
}

/** 재등록률이 없거나 오래됐으면 한 번만 다시 계산을 부탁한다 */
export function useLeaderKpiRefresh(data: LeaderHomeData | undefined) {
  const qc = useQueryClient();
  const asked = useRef<string | null>(null);
  const need = !!data?.on && !!data.branch && (!data.kpi || data.kpi.stale);
  const branch = data?.branch ?? null;
  useEffect(() => {
    if (!need || !branch || asked.current === branch) return;
    asked.current = branch;
    void supabase.functions
      .invoke("leader-kpi", { body: { branch } })
      .then(({ error }) => {
        if (!error) void qc.invalidateQueries({ queryKey: [...LEADER_KEY, "home"] });
      })
      .catch(() => undefined);
  }, [need, branch, qc]);
}

/** 「이야기함 · 안내 보냄 · 처방함」 */
export function useLeaderContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { member: string; kind: ContactKind; topic: LeaderTopic; rx?: RxKey | null; note?: string | null }) => {
      const { data, error } = await rpc("leader_contact_save", {
        p_member: v.member,
        p_kind: v.kind,
        p_topic: v.topic,
        p_rx: v.kind === "rx" ? v.rx ?? "other" : null,
        p_note: v.note ?? null,
      });
      if (error) throw new Error(translateError(error, "기록을 남기지 못했어요"));
      return data as { ok: boolean; id: string };
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...LEADER_KEY, "home"] }),
  });
}

/** 잘못 누른 기록 되돌리기 — 내가 남긴 것 · 24시간 안 */
export function useLeaderUndo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rpc("leader_contact_undo", { p_id: id });
      if (error) throw new Error(translateError(error, "되돌리지 못했어요"));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...LEADER_KEY, "home"] }),
  });
}

/** 코치용 사진 서명 주소(1시간) — 화면에 보이는 회원 것만 한 번에 */
export function useCoachPhotoUrls(paths: readonly string[]) {
  const sorted = [...new Set(paths.filter(Boolean))].sort();
  return useQuery<Record<string, string>>({
    queryKey: [...LEADER_KEY, "photos", sorted.join("|")],
    enabled: sorted.length > 0,
    staleTime: 50 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(sorted, 3600);
      if (error || !data) return {};
      const out: Record<string, string> = {};
      for (const d of data) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
      return out;
    },
  });
}

/** 회원이 코치 휴대폰에서 동의한 뒤 찍은 사진 올리기 — 가장 긴 변 512px JPEG 로 줄여서 */
export function useSaveCoachPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { member: string; file: File }) => {
      if (!v.file.type.startsWith("image/")) throw new Error("사진 파일만 올릴 수 있어요");
      const blob = await compressImage(v.file, 512, 0.75);
      const path = `${v.member}/face.jpg`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw new Error(translateError(upErr, "사진을 올리지 못했어요"));
      const { error } = await rpc("leader_photo_saved", { p_member: v.member, p_consent_version: COACH_PHOTO_CONSENT_VERSION });
      if (error) throw new Error(translateError(error, "사진을 저장하지 못했어요"));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: LEADER_KEY }),
  });
}

/** 사진 빼기 — 기록을 먼저 빼고 파일을 지운다(못 지운 파일은 밤 정리가 지운다) */
export function useRemoveCoachPhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: string) => {
      const { data, error } = await rpc("leader_photo_remove", { p_member: member, p_reason: "staff" });
      if (error) throw new Error(translateError(error, "사진을 빼지 못했어요"));
      const path = (data as { path?: string | null } | null)?.path;
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: LEADER_KEY }),
  });
}
