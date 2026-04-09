import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload, Loader2, Video, X, Play, Clock, Send, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface TimestampComment {
  time: number;
  text: string;
  by?: string;
}

interface Props {
  submissionId: string;
  videoUrl?: string | null;
  timestampComments?: TimestampComment[];
  isManager?: boolean;
  onVideoUploaded?: (url: string) => void;
}

const MissionVideoUpload = ({ submissionId, videoUrl, timestampComments = [], isManager, onVideoUploaded }: Props) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(videoUrl || null);
  const [newComment, setNewComment] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  const handleUpload = async (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error("영상 파일은 100MB 이하만 가능합니다");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `submissions/${user?.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("mission-videos").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("mission-videos").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Update submission with video url
      await supabase
        .from("mission_submissions")
        .update({ video_url: publicUrl } as any)
        .eq("id", submissionId);

      setPreviewUrl(publicUrl);
      onVideoUploaded?.(publicUrl);
      toast.success("영상 업로드 완료! 🎬");
      qc.invalidateQueries({ queryKey: ["my-mission-submissions"] });
    } catch (e: any) {
      toast.error(e?.message || "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const addTimestampComment = useMutation({
    mutationFn: async () => {
      const time = videoRef.current?.currentTime || 0;
      const newComments = [...timestampComments, { time: Math.floor(time), text: newComment, by: "manager" }];
      const { error } = await supabase
        .from("mission_submissions")
        .update({ video_timestamp_comments: newComments } as any)
        .eq("id", submissionId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("타임스탬프 코멘트 추가");
      setNewComment("");
      qc.invalidateQueries({ queryKey: ["member-mission-subs"] });
      qc.invalidateQueries({ queryKey: ["my-mission-submissions"] });
    },
  });

  const requestReshoot = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("request_mission_revision", {
        _submission_id: submissionId,
        _coach_note: "영상 재촬영이 필요합니다. 다시 제출해주세요.",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.info("재촬영 요청 완료");
      qc.invalidateQueries({ queryKey: ["member-mission-subs"] });
    },
  });

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {/* Video preview or upload */}
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-xl">
          <video
            ref={videoRef}
            src={previewUrl}
            controls
            playsInline
            onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
            className="w-full rounded-xl"
            style={{ maxHeight: "300px" }}
          />
          {!isManager && (
            <button
              onClick={() => { setPreviewUrl(null); }}
              className="absolute right-2 top-2 rounded-full bg-foreground/50 p-1.5 text-primary-foreground backdrop-blur-sm active:scale-95"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 py-8 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">업로드 중...</span>
              </>
            ) : (
              <>
                <Video className="h-8 w-8 text-muted-foreground" />
                <span className="text-sm font-bold text-foreground">영상 증빙 업로드</span>
                <span className="text-xs text-muted-foreground">탭하여 영상 선택 (최대 100MB)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Timestamp comments (visible to both) */}
      {timestampComments.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> 타임스탬프 코멘트
          </p>
          {timestampComments.map((c, i) => (
            <button
              key={i}
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = c.time;
                  videoRef.current.play();
                }
              }}
              className="flex w-full items-start gap-2 rounded-lg bg-muted/30 px-3 py-2 text-left transition-all active:scale-[0.98]"
            >
              <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                {formatTime(c.time)}
              </span>
              <span className="text-xs text-foreground">{c.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Manager: add timestamp comment */}
      {isManager && previewUrl && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="shrink-0 rounded-lg bg-primary/10 px-2 py-1.5 text-xs font-bold text-primary">
              {formatTime(currentTime)}
            </div>
            <input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="이 시점에 대한 코멘트..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground"
              onKeyDown={e => e.key === "Enter" && newComment.trim() && addTimestampComment.mutate()}
            />
            <button
              onClick={() => newComment.trim() && addTimestampComment.mutate()}
              disabled={!newComment.trim() || addTimestampComment.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground active:scale-95 disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>

          {/* Reshoot request */}
          <button
            onClick={() => requestReshoot.mutate()}
            disabled={requestReshoot.isPending}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/5 py-2 text-xs font-bold text-amber-600 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 재촬영 요청
          </button>
        </div>
      )}
    </div>
  );
};

export default MissionVideoUpload;
