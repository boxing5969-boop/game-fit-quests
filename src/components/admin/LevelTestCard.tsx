/**
 * 레벨 테스트 카드 (설정 화면 · 체험용 계정과 전체 관리자만, 2026-09-28)
 *
 * 대표님 요청: "내 계정과 체험용 계정은 레벨을 바꿔서 레벨 1·2·10·40 일 때 어떻게 열리고 앱이 어떻게 움직이는지 테스트하게".
 * 버튼 하나로 자기 계정의 리그·레벨을 바꾸고(서버 set_test_level), 끝나면 "테스트 전으로 되돌리기"(reset_test_level).
 * XP·젬·마일리지·출석은 그대로 — 레벨과 그에 딸린 상태(타이틀매치 통과 수·승급 진행도 시작 시각·마스터 트랙)만 바뀐다.
 * 권한은 서버가 다시 확인한다(전체 관리자 또는 체험용 계정, 자기 계정만).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import {
  LEVEL_PRESETS, TEST_RANKS, TEST_RANK_KO,
  getTestLevelState, isPresetActive, resetTestLevel, setTestLevel, testPosLabel,
  type TestRank,
} from "@/services/levelTestService";

const LEVEL_TEST_KEY = ["153leveltest"] as const;

const LevelTestCard = () => {
  const { user, role, profile, refreshProgress } = useAuth();
  const qc = useQueryClient();
  const isTestAccount = (profile as { is_test_account?: boolean } | null)?.is_test_account === true;
  const canUse = !!user && (role === "super_admin" || isTestAccount);

  const stateQ = useQuery({
    queryKey: [...LEVEL_TEST_KEY, "state", user?.id ?? "anon"],
    enabled: canUse,
    staleTime: 10_000,
    queryFn: getTestLevelState,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [rank, setRank] = useState<TestRank>("white");
  const [level, setLevel] = useState(1);

  if (!canUse || (stateQ.data && !stateQ.data.allowed)) return null;
  const st = stateQ.data;

  // 레벨을 보는 화면(홈 카드·승급 진행도·리그 탭·마스터 트랙·편지 등)이 전부 새 값으로 다시 그려지게
  const afterChange = async () => {
    await refreshProgress();
    await qc.invalidateQueries();
  };

  const apply = async (key: string, r: TestRank, l: number, complete = false) => {
    if (busy) return;
    setBusy(key);
    try {
      await setTestLevel(r, l, complete);
      await afterChange();
      toast.success(`${TEST_RANK_KO[r]} 리그 · 레벨 ${l}${complete ? " 완주" : ""}(으)로 바꿨어요. MY복서에서 확인해 보세요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "레벨을 바꾸지 못했어요");
    } finally {
      setBusy(null);
    }
  };

  const restore = async () => {
    if (busy) return;
    setBusy("reset");
    try {
      const restored = await resetTestLevel();
      await afterChange();
      toast.success(restored ? "테스트 전 상태로 되돌렸어요" : "아직 바꾼 적이 없어서 되돌릴 게 없어요");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "되돌리지 못했어요");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="animate-slide-up rounded-2xl border border-primary/30 bg-card p-5 shadow-elev-1">
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
        <FlaskConical className="h-4 w-4 text-primary" /> 레벨 테스트
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary">
          {isTestAccount ? "체험용 계정" : "관리자"}
        </span>
      </h2>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        이 계정의 레벨만 바꿔서 레벨마다 앱이 어떻게 열리고 움직이는지 확인해요. XP·젬·마일리지·출석은 그대로이고,
        승급 진행도는 바꾼 순간부터 새로 쌓여요.
        {isTestAccount ? " 체험용 계정은 다른 회원이 보는 순위·명예의 전당에 나오지 않아요." : ""}
      </p>

      <div className="mb-3 rounded-xl border border-border bg-secondary/30 px-3 py-2 text-[12px]">
        <p className="font-bold text-foreground">지금 · {stateQ.isLoading ? "확인 중…" : testPosLabel(st?.current)}</p>
        {st?.original && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">테스트 전 · {testPosLabel(st.original)}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {LEVEL_PRESETS.map((p) => {
          const active = isPresetActive(p, st?.current);
          return (
            <button
              key={p.key}
              type="button"
              disabled={!!busy}
              onClick={() => apply(p.key, p.rank, p.level, !!p.complete)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all active:scale-[0.98] disabled:opacity-60 ${
                active ? "border-primary bg-primary/10" : "border-border bg-card"
              }`}
            >
              <p className={`text-sm font-black ${active ? "text-primary" : "text-foreground"}`}>
                {busy === p.key ? "바꾸는 중…" : p.label}
              </p>
              <p className="text-[10.5px] leading-snug text-muted-foreground">{p.sub}</p>
            </button>
          );
        })}
      </div>

      {/* 직접 고르기 */}
      <div className="mt-3 flex items-center gap-2">
        <select
          value={rank}
          onChange={(e) => setRank(e.target.value as TestRank)}
          aria-label="리그"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-card px-2 text-sm text-foreground"
        >
          {TEST_RANKS.map((r) => (
            <option key={r} value={r}>{TEST_RANK_KO[r]} 리그</option>
          ))}
        </select>
        <select
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          aria-label="레벨"
          className="h-10 w-24 rounded-xl border border-border bg-card px-2 text-sm text-foreground"
        >
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>레벨 {n}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => apply("custom", rank, level)}
          className="h-10 shrink-0 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-60"
        >
          {busy === "custom" ? "…" : "적용"}
        </button>
      </div>

      <button
        type="button"
        disabled={!!busy || !st?.original}
        onClick={restore}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-[13px] font-bold text-foreground transition-all active:scale-[0.98] disabled:opacity-50"
      >
        <RotateCcw className="h-4 w-4" />
        {busy === "reset"
          ? "되돌리는 중…"
          : st?.original
            ? `테스트 전으로 되돌리기 · ${testPosLabel(st.original)}`
            : "테스트 전으로 되돌리기 (아직 바꾼 적 없음)"}
      </button>
    </div>
  );
};

export default LevelTestCard;
