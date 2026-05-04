/**
 * 153 스토리 RPG — 루트 변경 확인 다이얼로그 (단계 37).
 *
 * 변경 시 기존 진행도는 삭제되지 않는다 — change_story_route RPC 가 active route 만 갱신.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { StoryRoute } from "@/types/storyRpg";

export interface StoryRouteChangeDialogProps {
  open: boolean;
  targetRoute: StoryRoute | null;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const StoryRouteChangeDialog = ({
  open,
  targetRoute,
  loading,
  onConfirm,
  onCancel,
}: StoryRouteChangeDialogProps) => {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <AlertDialogContent className="z-[70]">
        <AlertDialogHeader>
          <AlertDialogTitle>복서의 길을 변경할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            {targetRoute
              ? `"${targetRoute.title}"(으)로 변경합니다. 기존에 진행한 다른 루트의 진행도는 그대로 보존됩니다.`
              : "이 길로 변경합니다."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={loading}>
            {loading ? "변경 중…" : "변경"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default StoryRouteChangeDialog;
