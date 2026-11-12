/**
 * 🥊 153 수업 템플릿 — 순서마다 참고 영상 (2026-11-12 대표님 「각 순서마다 참고할수있는 영상을 첨부해서 알기 쉽게」)
 *   DB: supabase/migrations/20261112020054_class_template_videos.sql
 *   · 보기 = 코치진 모두(모든 지점 공통) · 넣기 · 바꾸기 · 빼기 = 대표님만 (서버가 다시 본다)
 *   · 파일은 전략 회의 영상과 같은 비공개 저장소(strategy-videos, 50MB) — 재생은 1시간짜리 서명 주소
 *   · 함수가 아직 없는 DB(미리보기의 옛 DB · 적용 전)면 영상 없이 템플릿만 보인다
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { translateError } from "@/lib/errorMessages";
import { templateVideoPath, videoTitleFromFileName } from "@/lib/classTemplates";
import { STRATEGY_VIDEO_BUCKET, STRATEGY_VIDEO_MAX_BYTES, videoContentType } from "@/services/strategyService";

export interface ClassTemplateVideo {
  template_id: string;
  step: number;
  storage_path: string;
  title: string | null;
  seconds: number | null;
  updated_at: string;
}

const KEY = ["class-template-videos"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) => (supabase.rpc as any)(name, args);

const missingFn = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST202" || (/class_template_video/i.test(e.message ?? "") && /function|schema cache/i.test(e.message ?? "")));

export const useClassTemplateVideos = (enabled: boolean) =>
  useQuery({
    queryKey: KEY,
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ClassTemplateVideo[]> => {
      const { data, error } = await rpc("class_template_videos_list");
      if (error) {
        if (missingFn(error)) return [];
        throw new Error(translateError(error, "참고 영상을 불러오지 못했어요"));
      }
      return (data as ClassTemplateVideo[] | null) ?? [];
    },
  });

/** 재생 주소 — 1시간짜리 서명 주소 (코치진만 받을 수 있다) */
export async function classTemplateVideoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(STRATEGY_VIDEO_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error("영상을 열 수 없어요 — 잠시 후 다시 눌러 주세요");
  return data.signedUrl;
}

/** 영상 길이(초) — 4초 안에 못 읽으면 null */
function readVideoSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const finish = (sec: number | null) => {
      if (done) return;
      done = true;
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      resolve(sec);
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => finish(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : null);
    v.onerror = () => finish(null);
    window.setTimeout(() => finish(null), 4000);
    v.src = url;
  });
}

export interface AttachInput {
  templateId: string;
  step: number;
  file: File;
  title?: string | null;
}

export const useAttachClassTemplateVideo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, step, file, title }: AttachInput): Promise<void> => {
      if (file.size > STRATEGY_VIDEO_MAX_BYTES) {
        throw new Error(`영상이 너무 커요 (${(file.size / 1024 / 1024).toFixed(0)}MB) — 50MB까지예요`);
      }
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("다시 로그인해 주세요");
      const type = videoContentType(file);
      const ext = type === "video/quicktime" ? "mov" : type === "video/webm" ? "webm" : type === "video/3gpp" ? "3gp" : "mp4";
      const path = templateVideoPath(uid, templateId, step, ext, crypto.randomUUID().slice(0, 8));
      const seconds = await readVideoSeconds(file);
      const body = file.type === type ? file : new Blob([file], { type });
      const up = await supabase.storage
        .from(STRATEGY_VIDEO_BUCKET)
        .upload(path, body, { contentType: type, upsert: false, cacheControl: "3600" });
      if (up.error) {
        const m = up.error.message || "";
        if (/exceed|too large|size/i.test(m)) throw new Error("영상이 너무 커요 — 50MB까지예요");
        throw new Error(`영상을 올리지 못했어요 — 인터넷 연결을 확인하고 다시 눌러 주세요 (${m || "업로드 실패"})`);
      }
      const { error } = await rpc("class_template_video_set", {
        p_template: templateId,
        p_step: step,
        p_storage_path: path,
        p_title: title ?? videoTitleFromFileName(file.name),
        p_seconds: seconds ? Math.round(seconds) : null,
      });
      if (error) throw new Error(translateError(error, "영상을 붙이지 못했어요 — 다시 눌러 주세요"));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

export const useClearClassTemplateVideo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, step }: { templateId: string; step: number }): Promise<void> => {
      const { error } = await rpc("class_template_video_clear", { p_template: templateId, p_step: step });
      if (error) throw new Error(translateError(error, "영상을 빼지 못했어요"));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
