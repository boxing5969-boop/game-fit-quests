// 브로제이 회원목록 엑셀 일괄 등록 — 관장(본인 지점)/마스터(지점 선택) 전용.
// SheetJS로 .xlsx 파싱 → 상태 필터 → 미리보기 → bulk-import-members 엣지함수 호출.
import { useState, useRef, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

interface ParsedMember {
  name: string;
  phone: string;
  birth_date: string;
  reg_date: string;
  membership_end: string;
  status: string;
}

interface ImportResult {
  created: number;
  skipped: number;
  failed: { name: string; phone: string; reason: string }[];
}

const ALL_STATUSES = ["활성", "임박", "홀딩", "만료", "미등록", "예정"];
const DEFAULT_STATUSES = ["활성", "임박", "홀딩"];

const BulkMemberImport = ({ onClose }: { onClose: () => void }) => {
  const { profile, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const fileRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<ParsedMember[]>([]);
  const [fileName, setFileName] = useState("");
  const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);
  const [branch, setBranch] = useState<string>(isAdmin ? "" : profile?.branch_name || "");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    if (isAdmin) {
      supabase.from("branches").select("id, name").order("name").then(({ data }) => setBranches(data || []));
    }
  }, [isAdmin]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });
      if (!aoa.length) throw new Error("빈 파일입니다");
      const header = (aoa[0] as unknown[]).map((h) => String(h).trim());
      const col = (n: string) => header.findIndex((h) => h === n);
      const ci = {
        name: col("고객명"),
        phone: col("연락처"),
        birth: col("생년월일"),
        reg: col("최초 등록일"),
        end: col("최종 이용 만료일"),
        status: col("상태"),
      };
      if (ci.name < 0 || ci.phone < 0) {
        throw new Error("'고객명' 또는 '연락처' 열을 찾을 수 없습니다. 브로제이 고객목록 엑셀이 맞는지 확인해주세요.");
      }
      const get = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
      const parsed: ParsedMember[] = (aoa.slice(1) as unknown[][])
        .filter((r) => r && get(r, ci.phone))
        .map((r) => ({
          name: get(r, ci.name),
          phone: get(r, ci.phone),
          birth_date: get(r, ci.birth),
          reg_date: get(r, ci.reg),
          membership_end: get(r, ci.end),
          status: get(r, ci.status),
        }));
      setRows(parsed);
      setFileName(file.name);
    } catch (err) {
      toast.error("엑셀 읽기 실패: " + ((err as Error)?.message || ""));
    } finally {
      setParsing(false);
    }
  };

  const filtered = useMemo(() => rows.filter((r) => statuses.includes(r.status)), [rows, statuses]);
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    rows.forEach((r) => {
      const k = r.status || "(없음)";
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [rows]);

  const toggleStatus = (s: string) =>
    setStatuses((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const handleImport = async () => {
    if (!filtered.length) {
      toast.info("등록할 회원이 없습니다 (상태 필터를 확인하세요)");
      return;
    }
    if (isAdmin && !branch) {
      toast.error("지점을 선택해주세요");
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const members = filtered.map((r) => ({
        name: r.name,
        phone: r.phone,
        birth_date: r.birth_date,
        reg_date: r.reg_date,
        membership_end: r.membership_end,
      }));
      const { data, error } = await supabase.functions.invoke("bulk-import-members", {
        body: { ...(isAdmin ? { branch_name: branch } : {}), members },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setResult({ created: data.created ?? 0, skipped: data.skipped ?? 0, failed: data.failed ?? [] });
      toast.success(`${data.created ?? 0}명 등록 완료 · 중복 ${data.skipped ?? 0} · 실패 ${data.failed?.length ?? 0}`);
    } catch (err) {
      toast.error("등록 실패: " + ((err as Error)?.message || ""));
    } finally {
      setSubmitting(false);
    }
  };

  const targetBranch = isAdmin ? branch : profile?.branch_name || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-elev-3">
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">회원 엑셀 일괄 등록</h2>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted active:scale-95">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 지점 */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">등록 지점</label>
          {isAdmin ? (
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="지점을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium text-foreground">
              {profile?.branch_name || "지점 정보 없음"} <span className="text-xs text-muted-foreground">(본인 지점 고정)</span>
            </div>
          )}
        </div>

        {/* 파일 선택 */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={parsing}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-4 text-sm font-bold text-primary transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {parsing ? "읽는 중..." : fileName ? `다시 선택 (${fileName})` : "브로제이 고객목록 .xlsx 선택"}
        </button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />

        {rows.length > 0 && (
          <>
            {/* 상태 필터 */}
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">등록할 상태 선택 (총 {rows.length}명)</p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_STATUSES.map((s) => {
                  const on = statuses.includes(s);
                  const cnt = statusCounts[s] || 0;
                  return (
                    <button
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className={`rounded-full px-3 py-1 text-xs font-bold transition-all active:scale-95 ${
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {s} {cnt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 미리보기 */}
            <div className="mb-3 rounded-xl border border-border bg-background">
              <div className="border-b border-border px-3 py-2 text-xs font-bold text-foreground">
                등록 대상 <span className="text-primary">{filtered.length}명</span> · 아이디·비번 = 전화번호 · 자동 승인
              </div>
              <div className="max-h-44 overflow-y-auto">
                {filtered.slice(0, 30).map((m, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-border/50 px-3 py-1.5 text-xs last:border-0">
                    <span className="font-medium text-foreground">{m.name || "(이름없음)"}</span>
                    <span className="text-muted-foreground">{m.phone}</span>
                    <span className="text-[11px] text-muted-foreground">~{m.membership_end || "-"}</span>
                  </div>
                ))}
                {filtered.length > 30 && (
                  <div className="px-3 py-1.5 text-center text-[11px] text-muted-foreground">외 {filtered.length - 30}명…</div>
                )}
              </div>
            </div>

            {/* 결과 */}
            {result && (
              <div className="mb-3 rounded-xl border border-border bg-muted/30 p-3 text-sm">
                <div className="flex items-center gap-2 font-bold text-status-complete">
                  <CheckCircle2 className="h-4 w-4" /> 등록 {result.created}명
                </div>
                <p className="mt-1 text-xs text-muted-foreground">중복(건너뜀) {result.skipped}명 · 실패 {result.failed.length}명</p>
                {result.failed.length > 0 && (
                  <div className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-destructive/5 p-2 text-[11px] text-destructive">
                    {result.failed.slice(0, 20).map((f, i) => (
                      <div key={i}>{f.name || f.phone}: {f.reason}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 실행 */}
            <button
              onClick={handleImport}
              disabled={submitting || !filtered.length}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow-soft transition-all active:scale-[0.98] hover:shadow-glow-primary disabled:opacity-50"
            >
              {submitting ? "등록 중..." : `${filtered.length}명 일괄 등록 (자동 승인)`}
            </button>
            <p className="mt-2 flex items-start gap-1 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              이미 등록된 전화번호는 자동으로 건너뜁니다. 회원은 최초 로그인 시 아이디·비밀번호를 변경하도록 안내됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default BulkMemberImport;
