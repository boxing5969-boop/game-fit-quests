import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";

interface AvatarUploadProps {
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
}

const sizeMap = {
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-28 w-28",
};

const AvatarUpload = ({ size = "md", editable = true }: AvatarUploadProps) => {
  const { profile } = useAuth();
  // 올리기·바꾸기는 홈 라이센스 카드와 같은 함수 (hooks/useAvatarUpload)
  const { upload, uploading } = useAvatarUpload();
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 같은 사진을 다시 골라도 onChange 가 오게 비운다
    e.target.value = "";
    if (!file) return;
    const url = await upload(file);
    if (url) setAvatarUrl(url);
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
