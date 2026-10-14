/**
 * 프로필 사진 올리기·바꾸기 — 단일 경로 (2026-10-14 대표님: 홈 라이센스 카드 사진을 누르면 교체).
 *
 * 내정보(AvatarUpload)와 홈 라이센스 카드가 같은 함수를 쓴다.
 *   · 이미지 파일만, 10MB 이하 → 가장 긴 변 512px JPEG(0.7)로 줄여 avatars/{uid}/avatar.jpg 에 덮어쓴다
 *   · profiles.avatar_url 에 새 주소(?t=시각 — 예전 사진 캐시 무효화)를 쓰고
 *     refreshProfile() 로 홈 카드·내정보·헤더가 한 번에 새 사진을 보게 한다
 */
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/imageCompression";

export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

export function useAvatarUpload() {
  const { user, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);

  /** 성공하면 새 사진 주소, 아니면 null (안내 토스트는 여기서 띄운다) */
  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      if (!user) {
        toast.error("로그인이 필요해요");
        return null;
      }
      if (!file.type.startsWith("image/")) {
        toast.error("이미지 파일만 업로드 가능합니다");
        return null;
      }
      if (file.size > AVATAR_MAX_BYTES) {
        toast.error("10MB 이하 이미지만 가능합니다");
        return null;
      }

      setUploading(true);
      try {
        const compressed = await compressImage(file, 512, 0.7);
        const path = `${user.id}/avatar.jpg`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ avatar_url: publicUrl })
          .eq("user_id", user.id);
        if (updateError) throw updateError;

        await refreshProfile();
        toast.success("프로필 사진이 업데이트되었습니다! 🥊");
        return publicUrl;
      } catch (err) {
        toast.error("업로드 실패: " + ((err as Error)?.message ?? "잠시 후 다시 시도해 주세요"));
        return null;
      } finally {
        setUploading(false);
      }
    },
    [user, refreshProfile],
  );

  return { upload, uploading };
}
