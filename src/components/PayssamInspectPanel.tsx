// 결제선생(Payssam) 연동 검수 패널 — 관리자(admin) 전용, 운영 도구.
// 검수 5항목의 BILL-ID를 뽑아 partner_dev@paymint.co.kr 로 보낼 수 있게 돕는다.
//   A 청구서: 생성 → (결제창에서 샌드박스 테스트카드 결제) → 조회 → 승인취소
//             ⇒ 결제승인·승인동기화·청구서조회·승인취소 4항목 커버
//   B 청구서: 생성 → 파기(결제하지 않음)  ⇒ 청구서 파기 1항목 커버
// 실제 API 호출·시크릿은 payssam-inspect 엣지함수에서만 처리(프론트 노출 없음).
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, ExternalLink, Search, XCircle, Trash2, ClipboardCheck, ShieldCheck } from "lucide-react";

const LS = "payssam_inspect_v1";
interface Store {
  billA?: string; priceA?: string; shortA?: string; stateA?: string; canceled?: boolean;
  billB?: string; priceB?: string; destroyed?: boolean;
}
const loadStore = (): Store => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch { return {}; } };

const PARTNER_MAIL = "partner_dev@paymint.co.kr";

const PayssamInspectPanel = () => {
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const [st, setSt] = useState<Store>(loadStore());
  const [priceA, setPriceA] = useState(st.priceA || "1000");
  const [priceB, setPriceB] = useState(st.priceB || "1000");
  const [busy, setBusy] = useState<string>("");
  const [log, setLog] = useState<{ t: string; ok: boolean; msg: string }[]>([]);

  useEffect(() => { localStorage.setItem(LS, JSON.stringify(st)); }, [st]);

  if (!isAdmin) return null;

  const put = (t: string, ok: boolean, msg: string) => setLog((l) => [{ t, ok, msg }, ...l].slice(0, 12));

  const invoke = async (action: string, extra: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("payssam-inspect", { body: { action, ...extra } });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data as Record<string, string> & { data?: Record<string, string> };
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { const m = (e as Error).message; put(key, false, m); toast.error(m); }
    finally { setBusy(""); }
  };

  const createA = () => run("A-생성", async () => {
    const d = await invoke("create", { price: priceA });
    if (!d.shortUrl) { put("결제승인 청구서 생성", false, d.msg || d.code || "shortUrl 없음"); toast.error("생성 실패: " + (d.msg || d.code)); return; }
    setSt((s) => ({ ...s, billA: d.billId, priceA, shortA: d.shortUrl, stateA: "created", canceled: false }));
    put("결제승인 청구서 생성", true, `BILL-ID ${d.billId}`);
    window.open(d.shortUrl, "_blank");
    toast.success("결제창을 열었습니다. 샌드박스 테스트카드로 결제하세요.");
  });

  const readA = () => run("A-조회", async () => {
    if (!st.billA) return;
    const d = await invoke("read", { billId: st.billA });
    const state = d.apprState || d.data?.apprState || "";
    setSt((s) => ({ ...s, stateA: state }));
    put("청구서 조회", d.code === "0000", `상태 ${state || "-"} (code ${d.code})`);
    (d.code === "0000" ? toast.success : toast.error)(`조회 상태: ${state || "-"}`);
  });

  const cancelA = () => run("A-승인취소", async () => {
    if (!st.billA) return;
    const d = await invoke("cancel", { billId: st.billA, price: st.priceA });
    const ok = d.code === "0000";
    setSt((s) => ({ ...s, canceled: ok }));
    put("승인취소", ok, `code ${d.code} ${d.msg || ""}`);
    (ok ? toast.success : toast.error)(`승인취소: ${d.code} ${d.msg || ""}`);
  });

  const createB = () => run("B-생성", async () => {
    const d = await invoke("create", { price: priceB });
    if (!d.billId) { put("파기용 청구서 생성", false, d.msg || d.code); return; }
    setSt((s) => ({ ...s, billB: d.billId, priceB, destroyed: false }));
    put("파기용 청구서 생성", true, `BILL-ID ${d.billId}`);
    toast.success("파기용 청구서 생성됨. 결제하지 말고 [파기]를 누르세요.");
  });

  const destroyB = () => run("B-파기", async () => {
    if (!st.billB) return;
    const d = await invoke("destroy", { billId: st.billB, price: st.priceB });
    const ok = d.code === "0000";
    setSt((s) => ({ ...s, destroyed: ok }));
    put("청구서 파기", ok, `code ${d.code} ${d.msg || ""}`);
    (ok ? toast.success : toast.error)(`파기: ${d.code} ${d.msg || ""}`);
  });

  const copy = (t: string, label = "복사됨") => { navigator.clipboard?.writeText(t); toast.success(label); };

  const mail = [
    "결제선생 기술지원팀께,",
    "",
    "153복싱짐(마이복서153 앱) 결제선생 연동 검수 요청드립니다.",
    "아래 테스트 거래건 BILL-ID 확인 부탁드립니다.",
    "",
    `- 결제승인 : ${st.billA || "(미완료)"}`,
    `- 승인취소 : ${st.billA || "(미완료)"}`,
    `- 청구서 파기 : ${st.billB || "(미완료)"}`,
    `- 청구서 조회 : ${st.billA || "(미완료)"}`,
    `- 승인 동기화 : ${st.billA || "(미완료)"}`,
    "",
    "감사합니다.",
  ].join("\n");

  const Row = ({ label, value }: { label: string; value?: string }) => (
    <div className="flex items-center justify-between gap-2 border-t border-border/60 py-1.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-mono text-xs font-semibold text-foreground">{value || "—"}</span>
        {value && <button onClick={() => copy(value)} className="text-muted-foreground active:scale-90"><Copy className="h-3.5 w-3.5" /></button>}
      </span>
    </div>
  );

  const btn = "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition-all active:scale-95 disabled:opacity-50";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">결제선생 연동 검수 (관리자)</h3>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        샌드박스 테스트입니다. A청구서는 <b className="text-foreground">생성→결제→조회→승인취소</b>, B청구서는 <b className="text-foreground">생성→파기</b> 순서로 진행하면
        검수 5항목 BILL-ID가 모두 채워집니다.
      </p>

      {/* A: 결제승인·조회·승인취소 */}
      <div className="mb-2.5 rounded-xl border border-border bg-background p-3">
        <p className="mb-2 text-xs font-bold text-foreground">① 결제승인 · 승인동기화 · 조회 · 승인취소</p>
        <div className="mb-2 flex items-center gap-2">
          <input value={priceA} onChange={(e) => setPriceA(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
            className="w-24 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground" placeholder="금액" />
          <button disabled={!!busy} onClick={createA} className={`${btn} bg-primary text-primary-foreground`}>
            {busy === "A-생성" ? "생성 중…" : "테스트 청구서 생성"}
          </button>
        </div>
        {st.billA && (
          <div className="rounded-lg bg-muted/40 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono font-semibold text-foreground">{st.billA}</span>
              <span className="text-muted-foreground">상태 {st.stateA || "-"}{st.canceled ? " · 취소됨" : ""}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {st.shortA && (
                <button onClick={() => window.open(st.shortA, "_blank")} className={`${btn} bg-secondary text-secondary-foreground`}>
                  <ExternalLink className="h-3.5 w-3.5" /> 결제창 열기
                </button>
              )}
              <button disabled={!!busy} onClick={readA} className={`${btn} bg-secondary text-secondary-foreground`}>
                <Search className="h-3.5 w-3.5" /> {busy === "A-조회" ? "조회 중…" : "조회"}
              </button>
              <button disabled={!!busy} onClick={cancelA} className={`${btn} bg-secondary text-secondary-foreground`}>
                <XCircle className="h-3.5 w-3.5" /> {busy === "A-승인취소" ? "취소 중…" : "승인취소"}
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">결제창에서 테스트카드로 결제 후 [조회]로 상태 F(결제완료) 확인 → [승인취소]</p>
          </div>
        )}
      </div>

      {/* B: 청구서 파기 */}
      <div className="mb-2.5 rounded-xl border border-border bg-background p-3">
        <p className="mb-2 text-xs font-bold text-foreground">② 청구서 파기 (결제하지 않음)</p>
        <div className="mb-2 flex items-center gap-2">
          <input value={priceB} onChange={(e) => setPriceB(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
            className="w-24 rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm text-foreground" placeholder="금액" />
          <button disabled={!!busy} onClick={createB} className={`${btn} bg-primary text-primary-foreground`}>
            {busy === "B-생성" ? "생성 중…" : "파기용 청구서 생성"}
          </button>
        </div>
        {st.billB && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <span className="font-mono text-xs font-semibold text-foreground">{st.billB}{st.destroyed ? " · 파기됨" : ""}</span>
            <button disabled={!!busy} onClick={destroyB} className={`${btn} bg-secondary text-secondary-foreground`}>
              <Trash2 className="h-3.5 w-3.5" /> {busy === "B-파기" ? "파기 중…" : "파기"}
            </button>
          </div>
        )}
      </div>

      {/* 검수 결과 요약 + 메일 */}
      <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          <p className="text-xs font-bold text-foreground">검수 결과 (메일에 넣을 BILL-ID)</p>
        </div>
        <Row label="결제승인" value={st.billA} />
        <Row label="승인취소" value={st.canceled ? st.billA : undefined} />
        <Row label="청구서 파기" value={st.destroyed ? st.billB : undefined} />
        <Row label="청구서 조회" value={st.billA} />
        <Row label="승인 동기화" value={st.billA} />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button onClick={() => copy(mail, "메일 내용 복사됨")} className={`${btn} bg-primary text-primary-foreground`}>
            <Copy className="h-3.5 w-3.5" /> 메일 내용 복사
          </button>
          <button onClick={() => copy(PARTNER_MAIL, "주소 복사됨")} className={`${btn} bg-secondary text-secondary-foreground`}>
            {PARTNER_MAIL}
          </button>
        </div>
      </div>

      {/* 실행 로그 */}
      {log.length > 0 && (
        <div className="mt-3 space-y-1">
          {log.map((l, i) => (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span className={l.ok ? "text-primary" : "text-destructive"}>{l.ok ? "✓" : "✕"}</span>
              <span className="font-semibold text-foreground">{l.t}</span>
              <span className="truncate text-muted-foreground">{l.msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PayssamInspectPanel;
