import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/imageCompression";

interface AvatarUploadProps {
  size?: "sm" | "md" | "lg";
  editable?: boolean;
}

const sizeMap = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
};

const AvatarUpload = ({ size = "md", editable = true }: AvatarUploadProps) => {
  const { user, profile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("10MB 이하 이미지만 가능합니다");
      return;
    }

    setUploading(true);
    try {
      // Compress image: max 512px, JPEG quality 0.7
      const compressed = await compressImage(file, 512, 0.7);
      const path = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { 
          upsert: true,
          contentType: "image/jpeg",
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success("프로필 사진이 업데이트되었습니다! 🥊");
    } catch (err: any) {
      toast.error("업로드 실패: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = avatarUrl || profile?.avatar_url;

  return (
    <div className="relative inline-block">
      <Avatar className={`${sizeMap[size]} border-2 border-primary/20`}>
        {displayUrl ? (
          <AvatarImage src={displayUrl} alt={profile?.nickname || "프로필"} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-lg">🥊</AvatarFallback>
      </Avatar>
      {editable && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all active:scale-90"
          >
            {uploading ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
        </>
      )}
    </div>
  );
};

export default AvatarUpload;
