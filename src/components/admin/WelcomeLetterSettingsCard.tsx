/**
 * 웰컴 편지 편집 카드 (설정 화면 · 관리자 전용, 2026-09-23)
 *
 * 대표님 지시: "웰컴 편지는 개발자에게 보내는 편지 말고 회원님들에게 보내는 편지,
 * 코치님이 회원가입하면 코치님에게 보내는 편지로".
 *   · 회원님께 — 회원이 온보딩·튜토리얼을 마치면 한 번 도착
 *   · 코치님께 — 지도진·코치·관장 계정이 처음 들어오면 한 번 도착
 *   · 관리자 계정에는 자동으로 뜨지 않는다 → 여기 "미리보기" 로 확인한다.
 * {이름} 자리에 회원은 닉네임(없으면 이름), 코치님은 "이름 직함"(예: 홍길동 코치)이 들어간다.
 * 저장은 set_app_setting('welcome_letters') — 서버가 권한(전체관리자·관리자)·형식·글자 수를 검사한다.
 * 비워 둔 칸은 기본 문구로 나간다. "기본 편지로" 는 저장본에서 그 대상을 지운다.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LetterModal } from "@/components/WelcomeLetter";
import {
  DEFAULT_LETTERS, LETTER_AUDIENCE_LABEL, LETTER_LIMITS, NAME_TOKEN, WELCOME_LETTERS_KEY,
  buildLetter, fetchWelcomeLetters, resolveLetter, saveWelcomeLetters,
  type LetterAudience, type LetterTemplate, type WelcomeLetters,
} from "@/lib/welcomeLetters";

const AUDIENCES: LetterAudience[] = ["member", "coach"];
const SAMPLE_NAME: Record<LetterAudience, string> = { member: "김복서", coach: "김코치 코치" };

const sameLetter = (a: LetterTemplate, b: LetterTemplate) =>
  a.title === b.title && a.body === b.body && a.sign === b.sign && a.cta === b.cta;

const WelcomeLetterSettingsCard = () => {
  const qc = useQueryClient();
  const { data: saved, isLoading, isError } = useQuery({
    queryKey: WELCOME_LETTERS_KEY,
    queryFn: fetchWelcomeLetters,
    staleTime: 60_000,
  });

  const [aud, setAud] = useState<LetterAudience>("member");
  const [drafts, setDrafts] = useState<Partial<Record<LetterAudience, LetterTemplate>>>({});
  const [preview, setPreview] = useState(false);

  // 저장본이 오면 대상별로 한 번만 폼을 채운다 (다시 읽을 때마다 덮어쓰면 고치던 글이 사라진다)
  useEffect(() => {
    if (saved === undefined) return;
    setDrafts((d) => {
      const next = { ...d };
      for (const a of AUDIENCES) if (!next[a]) next[a] = resolveLetter(saved, a);
      return next;
    });
  }, [saved]);

  const draft = drafts[aud] ?? resolveLetter(saved, aud);
  const current = resolveLetter(saved, aud);
  const dirty = !sameLetter(draft, current);
  const customized = !!saved?.[aud];

  const setField = (k: keyof LetterTemplate, v: string) =>
    setDrafts((d) => ({ ...d, [aud]: { ...(d[aud] ?? draft), [k]: v } }));

  const save = useMutation({
    mutationFn: (value: WelcomeLetters) => saveWelcomeLetters(value),
    onSuccess: () => qc.invalidateQueries({ queryKey: WELCOME_LETTERS_KEY }),
  });

  const onSave = async () => {
    if (!draft.body.trim()) { toast.error("편지 본문을 입력해 주세요"); return; }
    // 기본 문구와 같은 칸은 저장하지 않는다 — 나중에 기본 문구를 고치면 그대로 따라가게
    const d = DEFAULT_LETTERS[aud];
    const entry: Partial<LetterTemplate> = {};
    (Object.keys(d) as Array<keyof LetterTemplate>).forEach((k) => {
      if (draft[k].trim() && draft[k] !== d[k]) entry[k] = draft[k];
    });
    const next: WelcomeLetters = { ...(saved ?? {}) };
    if (Object.keys(entry).length === 0) delete next[aud];
    else next[aud] = { ...entry, body: entry.body ?? d.body };
    try {
      await save.mutateAsync(next);
      toast.success(`${LETTER_AUDIENCE_LABEL[aud]} 편지를 저장했어요. 다음에 편지를 받는 분부터 이 문구로 도착합니다.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    }
  };

  const onReset = async () => {
    if (!window.confirm(`${LETTER_AUDIENCE_LABEL[aud]} 편지를 기본 문구로 되돌릴까요?`)) return;
    const next: WelcomeLetters = { ...(saved ?? {}) };
    delete next[aud];
    try {
      if (customized) await save.mutateAsync(next);
      setDrafts((d) => ({ ...d, [aud]: DEFAULT_LETTERS[aud] }));
      toast.success("기본 편지로 되돌렸어요");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "되돌리기 실패");
    }
  };

  const previewLetter = useMemo(() => buildLetter(aud, draft, SAMPLE_NAME[aud]), [aud, draft]);

  const counter = (k: keyof LetterTemplate) => (
    <span className={`text-[10px] tabular-nums ${draft[k].length > LETTER_LIMITS[k] ? "text-destructive" : "text-muted-foreground"}`}>
      {draft[k].length}/{LETTER_LIMITS[k]}
    </span>
  );

  return (
    <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1" style={{ animationDelay: "0.145s" }}>
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
        <Mail className="h-4 w-4 text-reward" /> 웰컴 편지
      </h2>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        회원은 앱을 처음 시작할 때(온보딩·튜토리얼 뒤), 코치님은 처음 들어올 때 한 번 받는 편지예요.
        <b className="text-foreground"> {NAME_TOKEN}</b> 자리에 회원은 닉네임, 코치님은 &quot;이름 직함&quot;이 들어갑니다.
        관리자 계정에는 자동으로 뜨지 않으니 미리보기로 확인하세요.
      </p>

      {/* 대상 */}
      <div role="tablist" aria-label="편지 대상" className="mb-3 flex rounded-pill border border-border bg-muted/30 p-0.5">
        {AUDIENCES.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={a === aud}
            onClick={() => setAud(a)}
            className={`flex-1 rounded-pill px-3 py-1.5 text-[12px] font-bold transition-all active:scale-95 ${
              a === aud ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground"
            }`}
          >
            {LETTER_AUDIENCE_LABEL[a]}
            {saved?.[a] ? " · 수정됨" : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <div className="space-y-3">
          {isError && (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
              저장된 편지를 불러오지 못해 기본 문구를 보여 드려요(저장은 잠시 막아 둡니다). 잠시 후 다시 열어 주세요.
            </p>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="letter-title" className="text-sm text-muted-foreground">제목 (줄바꿈 가능)</Label>
              {counter("title")}
            </div>
            <Textarea
              id="letter-title"
              rows={2}
              maxLength={LETTER_LIMITS.title}
              value={draft.title}
              onChange={(e) => setField("title", e.target.value)}
              className="rounded-xl text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="letter-body" className="text-sm text-muted-foreground">본문</Label>
              {counter("body")}
            </div>
            <Textarea
              id="letter-body"
              rows={10}
              maxLength={LETTER_LIMITS.body}
              value={draft.body}
              onChange={(e) => setField("body", e.target.value)}
              className="rounded-xl text-sm leading-relaxed"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="letter-sign" className="text-sm text-muted-foreground">서명</Label>
                {counter("sign")}
              </div>
              <Input
                id="letter-sign"
                maxLength={LETTER_LIMITS.sign}
                value={draft.sign}
                onChange={(e) => setField("sign", e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="letter-cta" className="text-sm text-muted-foreground">버튼 문구</Label>
                {counter("cta")}
              </div>
              <Input
                id="letter-cta"
                maxLength={LETTER_LIMITS.cta}
                value={draft.cta}
                onChange={(e) => setField("cta", e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPreview(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary py-3 text-sm font-bold text-secondary-foreground transition-all active:scale-[0.98]"
            >
              <Eye className="h-4 w-4" /> 미리보기
            </button>
            <button
              type="button"
              onClick={onSave}
              // 저장본을 못 읽었으면 저장 금지 — 빈 값 위에 저장하면 다른 대상(회원/코치)의 편지가 지워진다
              disabled={save.isPending || !dirty || isError}
              className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {save.isPending ? "저장 중..." : dirty ? "편지 저장" : "저장됨"}
            </button>
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={save.isPending || isError || (!customized && sameLetter(draft, DEFAULT_LETTERS[aud]))}
            className="flex w-full items-center justify-center gap-1.5 py-1 text-[11px] font-bold text-muted-foreground disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" /> 기본 편지로 되돌리기
          </button>
        </div>
      )}

      <LetterModal open={preview} letter={previewLetter} onClose={() => setPreview(false)} />
    </div>
  );
};

export default WelcomeLetterSettingsCard;
