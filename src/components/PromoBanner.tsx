// 수강권 화면 상단 공지/이벤트 배너 캐러셀 — 자동 롤링 + 탭 시 상세(쿠폰/이벤트) 바텀시트.
// 데이터: promotions 테이블(활성). 마스터가 관리, 회원은 열람.
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Copy, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Promo {
  id: string;
  branch_name: string | null;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  detail: string | null;
  coupon_code: string | null;
  link_url: string | null;
  bg_color: string | null;
}

const PromoBanner = () => {
  const { profile } = useAuth();
  const branch = profile?.branch_name ?? null;
  const [promos, setPromos] = useState<Promo[]>([]);
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState<Promo | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("promotions")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      const list = ((data as Promo[]) || []).filter((p) => p.branch_name === null || p.branch_name === branch);
      setPromos(list);
    })();
  }, [branch]);

  useEffect(() => {
    if (promos.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % promos.length), 4000);
    return () => clearInterval(t);
  }, [promos.length]);

  if (promos.length === 0) return null;
  const cur = promos[Math.min(idx, promos.length - 1)];

  return (
    <>
      <button
        onClick={() => setOpen(cur)}
        className="relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl px-4 py-4 text-left shadow-elev-1 transition-all active:scale-[0.99]"
        style={{ background: cur.bg_color || "#111827" }}
      >
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-white">{cur.title}</p>
          {cur.subtitle && <p className="mt-0.5 truncate text-xs text-white/75">{cur.subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white/80">
            {idx + 1} / {promos.length}
          </span>
          <ChevronRight className="h-4 w-4 text-white/70" />
        </div>
      </button>

      {promos.length > 1 && (
        <div className="mt-2 flex justify-center gap-1">
          {promos.map((_, i) => (
            <button
              key={i}
              aria-label={`배너 ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50" onClick={() => setOpen(null)}>
          <div
            className="w-full max-w-lg rounded-t-3xl border-t border-border bg-card p-5 pb-8 safe-area-bottom animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground">{open.title}</h2>
                {open.subtitle && <p className="mt-0.5 text-sm text-primary">{open.subtitle}</p>}
              </div>
              <button
                onClick={() => setOpen(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {open.image_url && <img src={open.image_url} alt="" className="mb-3 w-full rounded-xl" />}
            {open.detail && <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{open.detail}</p>}
            {open.coupon_code && (
              <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">쿠폰 코드</p>
                  <p className="text-base font-black tracking-wider text-primary">{open.coupon_code}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(open.coupon_code || "");
                    toast.success("쿠폰 코드를 복사했습니다");
                  }}
                  className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5" /> 복사
                </button>
              </div>
            )}
            {open.link_url && (
              <a
                href={open.link_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 block w-full rounded-xl bg-primary py-3 text-center text-sm font-bold text-primary-foreground active:scale-[0.98]"
              >
                자세히 보기
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PromoBanner;
