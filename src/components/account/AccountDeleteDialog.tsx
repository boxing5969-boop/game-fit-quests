/**
 * 🗑️ 계정 삭제(회원 탈퇴) — 설정 화면에서 여는 확인 창 (2026-10-19).
 *
 * App Store 심사 5.1.1(v): 가입이 되는 앱은 앱 안에서 계정 삭제를 시작할 수 있어야 한다(이메일·전화만으로는 안 된다).
 * '탈퇴'를 입력해야 버튼이 켜진다 → 서버 함수 account-delete-request 가 그 자리에서 로그인을 잠그고 모든 기기를 로그아웃시킨다.
 * 기록 삭제는 7일 안에 운영진이 마무리한다 (public/account-delete 안내와 같은 약속). 운영진 계정은 막혀 있다.
 */
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CONFIRM_WORD = "탈퇴";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 요청이 끝난 뒤 (로그아웃·첫 화면으로) */
  onDone: () => void | Promise<void>;
}

const AccountDeleteDialog = ({ open, onOpenChange, onDone }: Props) => {
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = word.trim() === CONFIRM_WORD && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      // 서버 함수 account-delete-request (본인 확인 → 기록 → 알림 끄기 → 전체관리자 알림 → 로그인 잠금·로그아웃)
      const { data, error } = await supabase.functions.invoke("account-delete-request", { body: { confirm: CONFIRM_WORD } });
      if (error) throw error;
      const r = (data ?? {}) as { ok?: boolean; error?: string };
      if (!r.ok) {
        toast.error(
          r.error === "staff_account"
            ? "운영진 계정은 앱에서 삭제할 수 없어요. 전체관리자에게 요청해 주세요."
            : "계정 삭제를 요청하지 못했어요. 잠시 후 다시 시도해 주세요.",
        );
        return;
      }
      toast.success("계정 삭제를 요청했어요", { description: "7일 안에 모든 기록을 지울게요. 이용해 주셔서 감사했습니다." });
      onOpenChange(false);
      await onDone();
    } catch {
      toast.error("계정 삭제를 요청하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setWord("");
        onOpenChange(v);
      }}
    >
      <AlertDialogContent className="max-w-[min(92vw,420px)] rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>계정을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-left text-label leading-relaxed text-muted-foreground">
              <p>요청하면 바로 로그아웃되고, 이 계정으로 다시 로그인할 수 없어요.</p>
              <p>
                7일 안에 프로필·레벨·기록·사진·글·AI 코치 대화를 모두 지워요. 계약·결제 기록은 법에 따라 따로 보관한 뒤
                파기해요.
              </p>
              <p>남은 수강권 정산은 이용 중인 지점에 따로 문의해 주세요.</p>
              <p>
                <a href="/account-delete" className="font-bold text-primary underline">
                  자세한 안내 보기
                </a>
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="account-delete-confirm" className="text-label font-bold text-foreground">
            확인을 위해 &lsquo;{CONFIRM_WORD}&rsquo;를 입력해 주세요
          </label>
          <Input
            id="account-delete-confirm"
            value={word}
            onChange={(e) => setWord(e.target.value)}
            autoComplete="off"
            className="text-body"
          />
        </div>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={busy}>취소</AlertDialogCancel>
          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 text-body font-bold text-destructive-foreground transition-opacity disabled:opacity-40"
          >
            {busy ? "요청 중…" : "계정 삭제"}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AccountDeleteDialog;
