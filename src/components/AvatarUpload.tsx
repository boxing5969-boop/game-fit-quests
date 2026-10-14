import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera } from "lucide-react";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";
import { useAvatarRewardState } from "@/hooks/useAvatarReward";
import { rewardHint } from "@/lib/avatarReward";

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
  // 처음 올리면 받는 챔피언 머니 — 홈 카드와 같은 금색 알약 (서버 금액)
  const { data: reward } = useAvatarRewardState();
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
  const badge = editable ? rewardHint(reward, !!displayUrl) : null;

  return (
    <div className="relative inline-block">
      <Avatar className={`${sizeMap[size]} border-2 border-primary/20`}>
        {displayUrl ? (
          <AvatarImage src={displayUrl} alt={profile?.nickname || "프로필"} />
        ) : null}
        <AvatarFallback className="bg-primary/10 text-lg">🥊</AvatarFallback>
      </Avatar>
      {badge && !uploading && (
        <span className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-reward px-2 py-0.5 text-[10px] font-black text-reward-foreground shadow-md">
          🎁 {badge}
        </span>
      )}
      {editable && (
        <>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={badge ? `프로필 사진 올리기 (처음 올리면 챔피언 머니 ${badge})` : "프로필 사진 올리기·바꾸기"}
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
