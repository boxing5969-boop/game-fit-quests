/**
 * 메시지 설정 — '메시지 요청 받기' 켜고 끄기 · 차단한 사람 · 제한 안내.
 * 끄면: 다른 회원이 새 대화를 시작할 수 없다. 이미 나눈 대화와 코치님·본사 메시지는 그대로 온다.
 */
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useDmBlock, useDmSettings, useSetDmAllowRequests } from "@/hooks/useDm";
import { dmUntilLabel } from "@/lib/dmTime";
import { shortBranch } from "@/lib/dmPeople";
import { DmSheet } from "@/components/dm/DmParts";

interface Props {
  open: boolean;
  onClose: () => void;
}

const DmSettingsSheet = ({ open, onClose }: Props) => {
  const { data, isLoading, isError, refetch } = useDmSettings(open);
  const setAllow = useSetDmAllowRequests();
  const block = useDmBlock();

  const onToggle = async (next: boolean) => {
    try {
      await setAllow.mutateAsync(next);
      toast.success(next ? "메시지 요청을 다시 받아요" : "새 메시지 요청을 받지 않아요");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장하지 못했어요");
    }
  };

  const onUnblock = async (userId: string, display: string) => {
    try {
      await block.mutateAsync({ userId, block: false });
      toast.success(`${display}님 차단을 풀었어요`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리하지 못했어요");
    }
  };

  const allow = data?.allow_requests ?? true;
  const blocks = data?.blocks ?? [];
  // '메시지 요청 받기'는 회원끼리만 뜻이 있다 — 코치님·본사에게 오는 메시지는 요청 없이 바로 온다
  const isMember = data?.kind === "member";

  if (isError && !data) {
    return (
      <DmSheet open={open} onClose={onClose} title="메시지 설정">
        <div className="rounded-2xl bg-muted/50 px-4 py-8 text-center">
          <p className="text-[14px] font-bold text-foreground">설정을 불러오지 못했어요</p>
          <button type="button" onClick={() => refetch()} className="mt-3 rounded-full bg-secondary px-4 py-2 text-[13px] font-bold active:scale-95">
            다시 불러오기
          </button>
        </div>
      </DmSheet>
    );
  }

  return (
    <DmSheet open={open} onClose={onClose} title="메시지 설정">
      {data?.suspended_until && (
        <p className="mb-3 rounded-xl bg-amber-500/10 px-3.5 py-3 text-[12.5px] leading-snug text-amber-800 dark:text-amber-300">
          신고 처리로 {dmUntilLabel(data.suspended_until)}까지 메시지를 보낼 수 없어요. 받은 메시지는 그대로 볼 수 있어요.
        </p>
      )}

      {isMember && (
        <section className="rounded-2xl bg-secondary/60 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-foreground">메시지 요청 받기</p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                끄면 다른 회원이 새 대화를 시작할 수 없어요. 이미 나눈 대화와 코치님·본사 메시지는 그대로 와요.
              </p>
            </div>
            <Switch
              checked={allow}
              disabled={isLoading || setAllow.isPending}
              onCheckedChange={onToggle}
              aria-label="메시지 요청 받기"
            />
          </div>
        </section>
      )}

      <section className={isMember ? "mt-5" : undefined}>
        <h3 className="mb-2 px-1 text-[13px] font-bold text-foreground">
          차단한 사람 <span className="font-medium text-muted-foreground">{blocks.length}</span>
        </h3>
        {blocks.length === 0 ? (
          <p className="rounded-2xl bg-muted/40 px-4 py-5 text-center text-[12.5px] text-muted-foreground">
            차단한 사람이 없어요 · 대화방 ⋯ 에서 차단할 수 있어요
          </p>
        ) : (
          <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl bg-secondary/40">
            {blocks.map((b) => (
              <li key={b.user_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-foreground">{b.display}</p>
                  {b.branch && <p className="truncate text-[12px] text-muted-foreground">{shortBranch(b.branch)}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => onUnblock(b.user_id, b.display)}
                  disabled={block.isPending}
                  className="shrink-0 rounded-full bg-card px-3.5 py-2 text-[12.5px] font-bold text-foreground shadow-elev-1 active:scale-95 disabled:opacity-50"
                >
                  차단 풀기
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-5 px-1 text-[11.5px] leading-relaxed text-muted-foreground">
        차단하면 서로 메시지를 보낼 수 없고, 상대에게는 알리지 않아요. 불편한 메시지는 대화방 ⋯ 에서 신고하면 본사가 확인해요.
      </p>
    </DmSheet>
  );
};

export default DmSettingsSheet;
