import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck } from "lucide-react";

interface ConsentRow {
  id: string;
  participant_name: string;
  is_minor: boolean;
  guardian_name: string | null;
  status: string;
  signed_at: string;
  health_ok: boolean;
  health_note: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  signed: { label: "서명 완료", cls: "bg-status-pending/15 text-status-pending" },
  coach_confirmed: { label: "코치 확인됨", cls: "bg-status-complete/15 text-status-complete" },
  revoked: { label: "철회됨", cls: "bg-muted text-muted-foreground" },
};

const CoachSparringInbox = () => {
  const [rows, setRows] = useState<ConsentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("sparring_consents")
      .select("id,participant_name,is_minor,guardian_name,status,signed_at,health_ok,health_note")
      .order("signed_at", { ascending: false })
      .limit(200);
    setLoading(false);
    if (error) {
      toast.error("스파링 동의 목록을 불러오지 못했습니다");
      return;
    }
    setRows((data ?? []) as ConsentRow[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleConfirm = async (id: string) => {
    setConfirming(id);
    const { error } = await supabase.rpc("confirm_sparring_consent", { _consent_id: id });
    setConfirming(null);
    if (error) {
      toast.error("확인 처리에 실패했습니다");
      return;
    }
    toast.success("코치 확인 완료");
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "coach_confirmed" } : r)));
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <span className="text-4xl">🥊</span>
        <p className="mt-3 text-sm text-muted-foreground">스파링 동의서가 아직 없습니다</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const st = STATUS_LABEL[r.status] ?? STATUS_LABEL.signed;
        return (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-elev-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-bold text-foreground">{r.participant_name}</p>
                  {r.is_minor && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                      미성년
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {new Date(r.signed_at).toLocaleDateString("ko-KR")} 서명
                  {r.is_minor && r.guardian_name ? ` · 대리인 ${r.guardian_name}` : ""}
                </p>
                {!r.health_ok && r.health_note && (
                  <p className="mt-1 text-[11px] text-status-pending">건강 고지: {r.health_note}</p>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>
                {st.label}
              </span>
            </div>

            {r.status === "signed" && (
              <button
                onClick={() => handleConfirm(r.id)}
                disabled={confirming === r.id}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-status-complete py-2.5 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
              >
                <ShieldCheck className="h-4 w-4" /> {confirming === r.id ? "확인 중..." : "코치 확인"}
              </button>
            )}
            {r.status === "coach_confirmed" && (
              <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-status-complete/10 py-2.5 text-sm font-bold text-status-complete">
                <CheckCircle2 className="h-4 w-4" /> 확인 완료
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CoachSparringInbox;
