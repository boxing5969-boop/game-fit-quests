/**
 * 💳 계좌이체 · 현장 결제 안내 카드 — 앱 결제(결제선생)를 아직 쓰지 않는 지점 (2026-10-21 대표님: 칠금점).
 *   수강권 탭 · 가입 신청 마지막 단계 · 승인 대기 화면에서 같은 카드를 쓴다 (lib/branchPayment).
 *   계좌는 app_settings 'offline_payment' — 비어 있으면 '데스크에서 안내'.
 */
import { useQuery } from "@tanstack/react-query";
import { Banknote, Copy, Store } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { OFFLINE_PAY_SETTING_KEY, branchShortName, offlinePayInfoFor } from "@/lib/branchPayment";
import { cn } from "@/lib/utils";

interface Props {
  branch: string;
  /** 가입 신청 중 — '승인' 안내를 '가입 신청 뒤' 기준으로 */
  context?: "membership" | "signup" | "waiting";
  className?: string;
}

const OfflinePayCard = ({ branch, context = "membership", className }: Props) => {
  const { data: setting } = useQuery({
    queryKey: ["app-settings", OFFLINE_PAY_SETTING_KEY],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).from("app_settings").select("value").eq("key", OFFLINE_PAY_SETTING_KEY).maybeSingle();
      return (data?.value ?? null) as unknown;
    },
  });
  const info = offlinePayInfoFor(setting, branch);
  const label = branchShortName(branch);

  const copy = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.account.replace(/[^0-9-]/g, ""));
      toast.success("계좌번호를 복사했어요");
    } catch {
      toast.error("복사하지 못했어요 — 길게 눌러 직접 복사해 주세요");
    }
  };

  const after =
    context === "signup"
      ? "가입 신청을 마친 뒤 결제해 주세요. 결제가 확인되면 데스크에서 가입을 승인하고 수강권을 등록해 드려요."
      : context === "waiting"
        ? "결제가 확인되면 데스크에서 가입을 승인해 드려요. 승인되면 바로 앱을 쓸 수 있어요."
        : "결제가 확인되면 데스크에서 수강권을 등록해 드려요.";

  return (
    <section className={cn("rounded-2xl bg-card p-4 text-left shadow-elev-1 ring-1 ring-border/60", className)} aria-label={`${label} 수강권 결제 안내`}>
      <p className="text-[12px] font-bold text-muted-foreground">{label} 수강권 결제</p>
      <h3 className="mt-0.5 text-[16px] font-black leading-snug text-foreground">계좌이체 · 현장 결제로 받아요</h3>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">앱 결제는 준비 중이에요. 편한 방법으로 결제해 주세요.</p>

      <div className="mt-3 space-y-2.5">
        <div className="flex items-start gap-3 rounded-xl bg-secondary/70 px-3.5 py-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Banknote className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black text-foreground">계좌이체</p>
            {info ? (
              <>
                <p className="mt-0.5 break-all text-[14px] font-bold tabular-nums text-foreground">
                  {info.bank} {info.account}
                </p>
                <p className="text-[12.5px] text-muted-foreground">예금주 {info.holder} · 입금자명은 가입한 이름으로</p>
                <button
                  type="button"
                  onClick={copy}
                  className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-background px-3 text-[12.5px] font-bold text-foreground ring-1 ring-border transition-transform active:scale-[0.97]"
                >
                  <Copy className="h-3.5 w-3.5" /> 계좌번호 복사
                </button>
              </>
            ) : (
              <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">계좌번호는 데스크에서 안내해 드려요. 입금자명은 가입한 이름으로 해 주세요.</p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl bg-secondary/70 px-3.5 py-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Store className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-black text-foreground">현장 결제</p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-foreground">{label} 데스크에서 카드 · 현금으로 결제해요.</p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">{after} 수강권 종류 · 금액도 데스크에서 안내해 드려요.</p>
    </section>
  );
};

export default OfflinePayCard;
