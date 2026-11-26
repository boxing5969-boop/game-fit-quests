/**
 * 📷 지도자 홈 — 코치용 얼굴 사진 남기기 (2026-11-26 대표님 「추천대로 가자」 · 사진 A안)
 *   코치가 회원님께 휴대폰을 보여 드리면 회원님이 직접 읽고 「동의하고 사진 찍기」를 누른다 → 사진 한 장 → 저장.
 *   그 지점 지도진 · 본사만 보는 비공개 저장소(coach-photos). 출입 얼굴 인식에는 쓰지 않는다 · TV 표시 없음.
 *   이미 있으면 지금 사진 + 「사진 빼기」(두 번 눌러). 저장 · 빼기는 services/leaderHomeService.ts.
 */
import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { COACH_PHOTO_CONSENT_LINES } from "@/lib/leaderHome";
import { useRemoveCoachPhoto, useSaveCoachPhoto } from "@/services/leaderHomeService";

export interface LeaderPhotoTarget {
  userId: string;
  name: string;
  photoPath: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: LeaderPhotoTarget | null;
  photoUrl?: string | null;
}

const LeaderPhotoSheet = ({ open, onOpenChange, target, photoUrl }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const save = useSaveCoachPhoto();
  const remove = useRemoveCoachPhoto();

  useEffect(() => {
    if (!open) {
      setFile(null);
      setConfirmRemove(false);
    }
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!target) return null;
  const busy = save.isPending || remove.isPending;

  const pick = () => inputRef.current?.click();

  const onSave = async () => {
    if (!file) return;
    try {
      await save.mutateAsync({ member: target.userId, file });
      toast.success(`${target.name}님 사진을 남겼어요`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const onRemove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      return;
    }
    try {
      await remove.mutateAsync(target.userId);
      toast.success("사진을 뺐어요");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-heading font-black">{target.name}님 사진 남기기</DrawerTitle>
          <DrawerDescription className="text-label">회원님께 휴대폰을 보여 드리고 직접 읽고 누르시게 해 주세요</DrawerDescription>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              if (f) setFile(f);
            }}
          />
          {preview ? (
            <>
              <img src={preview} alt="찍은 사진" className="mx-auto aspect-square w-56 rounded-2xl object-cover" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={pick}
                  disabled={busy}
                  className="h-12 rounded-xl bg-secondary text-body font-bold text-foreground active:scale-[0.99] disabled:opacity-50"
                >
                  다시 찍기
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={busy}
                  className="h-12 rounded-xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-50"
                >
                  {save.isPending ? "저장하는 중" : "이 사진으로 저장"}
                </button>
              </div>
            </>
          ) : (
            <>
              {photoUrl && (
                <img src={photoUrl} alt="지금 사진" className="mx-auto mb-4 aspect-square w-32 rounded-2xl object-cover" />
              )}
              <ul className="space-y-2 rounded-xl bg-secondary/70 p-4">
                {COACH_PHOTO_CONSENT_LINES.map((line) => (
                  <li key={line} className="text-label leading-relaxed text-foreground">
                    {line}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={pick}
                disabled={busy}
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-foreground text-body font-black text-background active:scale-[0.99] disabled:opacity-50"
              >
                <Camera className="h-5 w-5" aria-hidden />
                {target.photoPath ? "동의하고 다시 찍기" : "동의하고 사진 찍기"}
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mt-2 h-11 w-full rounded-xl text-label font-bold text-muted-foreground active:bg-secondary/60"
              >
                다음에 할게요
              </button>
              {target.photoPath && (
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={busy}
                  className="mt-1 h-11 w-full rounded-xl text-label font-bold text-destructive active:bg-secondary/60 disabled:opacity-50"
                >
                  {confirmRemove ? "한 번 더 누르면 사진을 빼요" : "사진 빼기"}
                </button>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default LeaderPhotoSheet;
