/**
 * 📅 153운영본부 「일정」 탭 — 휴대폰 캘린더 가져오기(.ics) (2026-11-13 캘린더 3-1단계 · 대표님 「추천대로 3-1부터」)
 *   구글 · 네이버 · 아웃룩에서 내보낸 .ics 파일을 이 휴대폰 안에서 읽어 미리 보여 주고, 고른 종류로 '내 일정'에 넣는다.
 *   파일은 서버로 보내지 않는다 — 한 줄씩 기존 ops_plan_save(+ 반복에서 빼는 날 ops_plan_skip)로만.
 *   지난 · 취소 · 같은 · 전에 넣은 일정은 빼고 200개까지 · 메모 · 장소는 옮기지 않는다(제목 · 날짜 · 시각 · 반복만).
 *   읽기 · 바꾸기는 src/lib/icsImport.ts (시험 icsImport.test.ts).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { PLAN_KIND_META, type OpsPlan } from "@/lib/opsPlans";
import {
  ICS_FILE_MAX_BYTES,
  itemPayload,
  itemSig,
  itemWhen,
  planIcsImport,
  skippedLine,
  type IcsImportSummary,
} from "@/lib/icsImport";
import { importIcsPlans, readIcsDone, writeIcsDone } from "@/services/calendarFeedService";
import { PLAN_KEY } from "@/services/opsPlanService";
import { OpsButton, OpsChip, OpsLabel, OpsSheet } from "./OpsParts";

type ImportKind = "work" | "personal" | "out" | "off";
const KINDS: readonly ImportKind[] = ["personal", "work", "out", "off"];
const SHOW = 8;

const OpsIcsImportSheet = ({
  open,
  onClose,
  branch,
  me,
  today,
  plans,
}: {
  open: boolean;
  onClose: () => void;
  branch: string;
  me: string;
  today: string;
  /** 지금 받아 둔 일정 — 같은 일정이 이미 있으면 뺀다 */
  plans: OpsPlan[];
}) => {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<IcsImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ImportKind>("personal");
  const [priv, setPriv] = useState(true);
  const [all, setAll] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setPlan(null);
    setError(null);
    setKind("personal");
    setPriv(true);
    setAll(false);
    setProgress(null);
  }, [open]);

  const existing = useMemo(
    () =>
      new Set(
        plans
          .filter((p) => p.mine)
          .map((p) =>
            itemSig({
              title: p.title ?? "",
              start_on: p.start_on,
              end_on: p.end_on,
              start_time: p.start_time ? p.start_time.slice(0, 5) : null,
              end_time: p.end_time ? p.end_time.slice(0, 5) : null,
              repeat_weekdays: p.repeat_weekdays,
            }),
          ),
      ),
    [plans],
  );

  const onFile = async (f: File | null | undefined) => {
    setError(null);
    setPlan(null);
    if (!f) return;
    if (f.size > ICS_FILE_MAX_BYTES) {
      setError("파일이 너무 커요 — 2MB까지예요");
      return;
    }
    try {
      const text = await f.text();
      if (!/BEGIN:VCALENDAR/i.test(text)) {
        setError(".ics 캘린더 파일이 아니에요");
        return;
      }
      const res = planIcsImport(text, today, readIcsDone(me), existing);
      setFileName(f.name);
      setPlan(res);
      setAll(false);
      if (res.total === 0) setError("파일에 일정이 없어요");
    } catch {
      setError("파일을 읽지 못했어요");
    }
  };

  const busy = progress != null;
  const items = plan?.items ?? [];
  const shown = all ? items : items.slice(0, SHOW);
  const skipped = plan ? skippedLine(plan.skipped) : null;

  const submit = async () => {
    if (!plan || items.length === 0 || busy) return;
    setProgress(0);
    const res = await importIcsPlans(
      items.map((i) => ({ payload: itemPayload(i, { branch, kind, private: priv }), skip: i.skip_dates, key: i.key })),
      (n) => setProgress(n),
    );
    writeIcsDone(me, res.saved);
    void qc.invalidateQueries({ queryKey: PLAN_KEY });
    setProgress(null);
    if (res.saved.length > 0) {
      toast.success(`${res.saved.length}개를 내 일정에 넣었어요`);
    }
    if (res.stopped) {
      setError(res.stopped);
      setPlan((p) => (p ? { ...p, items: p.items.filter((i) => !res.saved.includes(i.key)) } : p));
      return;
    }
    if (res.failed > 0) {
      setError(`${res.failed}개는 넣지 못했어요 — 날짜 · 시각을 확인해 주세요`);
      setPlan((p) => (p ? { ...p, items: p.items.filter((i) => !res.saved.includes(i.key)) } : p));
      return;
    }
    onClose();
  };

  return (
    <OpsSheet
      open={open}
      onClose={() => !busy && onClose()}
      title="휴대폰 캘린더 가져오기"
      sub=".ics 파일 → 내 일정"
      footer={
        plan && items.length > 0 ? (
          <div className="space-y-2">
            <OpsButton onClick={() => void submit()} disabled={busy}>
              {busy ? `넣는 중 ${progress}/${items.length}` : `${items.length}개 내 일정에 넣기`}
            </OpsButton>
            <OpsButton tone="plain" onClick={() => fileRef.current?.click()} disabled={busy}>
              다른 파일 고르기
            </OpsButton>
          </div>
        ) : undefined
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept=".ics,text/calendar"
        className="sr-only"
        aria-label="ics 파일 고르기"
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!plan ? (
        <>
          <p className="text-body leading-snug text-foreground">구글 · 네이버 · 아웃룩에서 내보낸 .ics 파일을 고르세요. 파일은 이 휴대폰 안에서만 읽어요.</p>
          <ul className="mt-3 space-y-1.5 rounded-xl bg-muted/60 px-4 py-3">
            <li className="text-label leading-snug text-muted-foreground">구글 — 컴퓨터 calendar.google.com › 설정 › 가져오기/내보내기 › 내보내기</li>
            <li className="text-label leading-snug text-muted-foreground">네이버 — PC 네이버 캘린더 › 캘린더 옆 › 가져오기/내보내기</li>
          </ul>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-foreground text-body font-black text-background active:scale-[0.98]"
          >
            <FileUp className="h-5 w-5" aria-hidden /> 파일 고르기
          </button>
        </>
      ) : (
        <>
          <p className="truncate text-label text-muted-foreground">{fileName}</p>
          <p className="mt-1 text-title font-black text-foreground">
            {items.length > 0 ? `${items.length}개를 내 일정으로 넣어요` : "넣을 일정이 없어요"}
          </p>
          {skipped && <p className="mt-1 text-label leading-snug text-muted-foreground">{skipped}</p>}

          {items.length > 0 && (
            <>
              <OpsLabel>어떤 일정으로 넣을까요?</OpsLabel>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => (
                  <OpsChip key={k} on={kind === k} onClick={() => setKind(k)} disabled={busy}>
                    {PLAN_KIND_META[k].label}
                  </OpsChip>
                ))}
              </div>
              {kind === "personal" && (
                <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-body font-bold text-foreground">대표님 · 지점장님께는 시간만</span>
                    <span className="block text-label text-muted-foreground">제목 대신 '개인 일정'으로 보여요</span>
                  </span>
                  <Switch checked={priv} onCheckedChange={setPriv} disabled={busy} aria-label="시간만 보이기" />
                </label>
              )}
              {kind === "off" && <p className="mt-2 text-label text-muted-foreground">휴무는 하루 종일로 넣어요 · 근무 인정은 「근무」 탭에서</p>}

              <OpsLabel>미리 보기</OpsLabel>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {shown.map((i) => (
                  <li key={i.key + i.start_on} className="flex items-start gap-2 px-3 py-2.5">
                    <span className={cn("mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-micro font-black", PLAN_KIND_META[kind].chip)}>
                      {PLAN_KIND_META[kind].label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-bold text-foreground">{i.title || PLAN_KIND_META[kind].label}</span>
                      <span className="block text-label tabular-nums text-muted-foreground">{itemWhen(i)}</span>
                      {i.note && <span className="block text-micro text-muted-foreground">{i.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {items.length > SHOW && (
                <button
                  type="button"
                  onClick={() => setAll((v) => !v)}
                  className="mt-1 flex h-11 w-full items-center justify-center rounded-xl text-label font-bold text-foreground active:bg-secondary/60"
                >
                  {all ? "접기" : `${items.length - SHOW}개 더 보기`}
                </button>
              )}
            </>
          )}
          {items.length === 0 && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl border border-border text-body font-bold text-foreground active:scale-[0.98]"
            >
              다른 파일 고르기
            </button>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-label font-bold text-destructive">
          {error}
        </p>
      )}
    </OpsSheet>
  );
};

export default OpsIcsImportSheet;
