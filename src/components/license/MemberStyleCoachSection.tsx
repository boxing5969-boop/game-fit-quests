/**
 * 🧭 회원 카드 안 「지도 카드」 — 코치님 · 지점장님 · 대표님만 (서버 member_style_for_coach 가 다시 본다).
 *   회원이 성향 검사를 했으면 오삼코치가 만든 지도법(첫마디 · 설명 · 교정 · 칭찬 · 강도 · 피할 말 · 이탈 신호)을 접어서 보여 준다.
 *   답 원문은 오지 않는다. 카드가 아직 없으면 「지도 카드 만들기」.
 */
import { useState } from "react";
import { ChevronDown, Compass } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { makeStyleCard, useMemberStyleForCoach } from "@/services/memberStyleService";
import { BIG5_NAMES, scoreStyle, type Big5 } from "../../../supabase/functions/_shared/memberStyle.ts";

const BASIS_TONE: Record<string, string> = { 확정: "text-primary", 추정: "text-amber-600", 불명확: "text-muted-foreground" };

export default function MemberStyleCoachSection({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const qc = useQueryClient();
  const { data } = useMemberStyleForCoach(userId, true);
  if (!data?.ok) return null;
  const p = data.profile;
  if (!p?.scores) return null; // 검사를 안 한 회원 — 아무것도 그리지 않는다
  const s = p.scores ?? scoreStyle({});
  const c = p.card;

  const make = async () => {
    setMaking(true);
    const r = await makeStyleCard(userId);
    setMaking(false);
    if (!r.ok) toast.error(r.error || "잠시 뒤 다시 눌러 주세요");
    qc.invalidateQueries({ queryKey: ["153style", "coach", userId] });
  };

  return (
    <div className="mt-4 rounded-2xl border border-border bg-background text-left">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-4">
        <Compass className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-body font-bold text-foreground">지도 카드 · {s.type16}</span>
          {c?.one_line && <span className="block truncate text-label text-muted-foreground">{c.one_line}</span>}
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 text-body leading-relaxed text-foreground">
          {!c ? (
            <button type="button" disabled={making} onClick={make} className="h-12 w-full rounded-xl bg-primary text-body font-bold text-primary-foreground disabled:opacity-60">
              {making ? "오삼코치가 만드는 중…" : "지도 카드 만들기"}
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-label font-bold text-muted-foreground">첫마디</p>
                {c.first_words.map((w) => <p key={w}>“{w}”</p>)}
              </div>
              <div>
                <p className="text-label font-bold text-muted-foreground">이렇게 가르쳐요</p>
                <p>· 설명: {c.teach.explain}</p>
                <p>· 교정: {c.teach.correct}</p>
                <p>· 칭찬: {c.teach.praise}</p>
                <p>· 강도: {c.teach.intensity}</p>
                <p>· 그룹: {c.teach.group}</p>
              </div>
              <div>
                <p className="text-label font-bold text-muted-foreground">이 말이 통해요</p>
                {c.say.map((w) => <p key={w}>“{w}”</p>)}
              </div>
              <div>
                <p className="text-label font-bold text-muted-foreground">피할 말</p>
                {c.avoid.map((w) => <p key={w}>· {w}</p>)}
              </div>
              <div>
                <p className="text-label font-bold text-muted-foreground">
                  그만둘 위험 · {c.dropout.level} <span className={BASIS_TONE[c.dropout.basis] ?? ""}>({c.dropout.basis})</span>
                </p>
                {c.dropout.signals.map((w) => <p key={w}>· {w}</p>)}
                <p className="mt-1">→ {c.retention}</p>
              </div>
              <p><span className="text-label font-bold text-muted-foreground">다음 목표 </span>{c.next_goal}</p>
              {c.sparring && <p><span className="text-label font-bold text-muted-foreground">스파링 </span>{c.sparring}</p>}
              <ul className="space-y-1.5 pt-1">
                {(Object.keys(BIG5_NAMES) as Big5[]).map((f) => (
                  <li key={f} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-label text-foreground">{BIG5_NAMES[f]}</span>
                    <div className="h-2 flex-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(3, s.big5[f])}%` }} /></div>
                  </li>
                ))}
              </ul>
              <p className="text-label text-muted-foreground">회원이 직접 답한 검사 + 출석 기록으로 오삼코치가 만들었어요 · 평가에 쓰지 않아요</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
