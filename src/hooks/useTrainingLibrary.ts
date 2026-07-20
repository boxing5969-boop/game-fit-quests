// 훈련 라이브러리 + AI 수업 구성기
// ─────────────────────────────────────────────────────────────
// training_exercises(DB) 를 읽어 50분 세션의 가변 슬롯(워밍업·줄넘기/리듬·컨디셔닝)을
// "회원ID + 날짜 + 레벨" 시드로 매일 다르게 로테이션한다.
// 같은 날엔 같은 구성(결정적) — 새로고침해도 안 바뀜, 내일이 되면 바뀜.
// 기술 블록(신규 기술·반복 등)은 레벨 커리큘럼 그대로 유지한다.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { SessionBlock } from "@/data/whiteLevel1Data";

export interface TrainingExercise {
  id: string;
  category: string;
  name: string;
  summary: string;
  description: string;
  benefits: string;
  target: string;
  difficulty: string;
  cues: string[];
  mistakes: string[];
  level_min: number;
  sort_order: number;
  image_url: string | null;
  video_url: string | null;
  is_active: boolean;
}

export const useTrainingLibrary = () => {
  return useQuery({
    queryKey: ["training-library"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TrainingExercise[]> => {
      // training_exercises 는 types.ts 재생성 전 테이블 — 기존 캐스트 패턴 사용
      const { data, error } = await (supabase as any)
        .from("training_exercises")
        .select("id, category, name, summary, description, benefits, target, difficulty, cues, mistakes, level_min, sort_order, image_url, video_url, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as TrainingExercise[];
    },
  });
};

// ── 결정적 시드 해시 (FNV-1a) ──
const fnv1a = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
};

const pick = <T,>(arr: T[], seed: number, salt: number): T | undefined =>
  arr.length === 0 ? undefined : arr[(seed + salt * 7919) % arr.length];

const localDateStr = () => new Date().toLocaleDateString("en-CA");

// 이름에 리듬·스텝 성격이 보이는 워밍업 (줄넘기 슬롯 로테이션 후보)
const isRhythmWarmup = (e: TrainingExercise) =>
  /스텝|사다리|라인|줄넘기|홉|바운스/.test(e.name);

/** 블록 하나를 라이브러리 드릴로 교체 (시간·강도·id 는 유지) */
const swapBlock = (block: SessionBlock, ex: TrainingExercise): SessionBlock => ({
  ...block,
  title: ex.name,
  description: ex.summary,
  drills: [
    { name: ex.name, detail: ex.description },
    ...ex.cues.slice(0, 2).map((c) => ({ name: "포인트", detail: c })),
  ],
});

/**
 * 세션 블록에 오늘의 로테이션 적용.
 * - "워밍업" 블록 → 워밍업 풀에서 1개
 * - "줄넘기" 블록 → 줄넘기 + 리듬형 워밍업 풀에서 1개 (밴드/아령 쉐도우·사다리 등)
 * - "서킷/코어/컨디셔닝" 블록 → 컨디셔닝 풀에서 1개
 * 라이브러리 로딩 전이거나 풀이 비면 원본 블록 그대로.
 */
export const composeSession = (
  blocks: SessionBlock[],
  library: TrainingExercise[],
  seedKey: string,
  globalLevel: number,
): SessionBlock[] => {
  if (!blocks?.length || !library?.length) return blocks;
  const seed = fnv1a(seedKey);
  const avail = library.filter((e) => e.level_min <= Math.max(1, globalLevel));
  const warmups = avail.filter((e) => e.category === "워밍업");
  const rhythm = avail.filter((e) => e.category === "줄넘기" || (e.category === "워밍업" && isRhythmWarmup(e)));
  const conditioning = avail.filter((e) => e.category === "컨디셔닝");

  let salt = 0;
  const used = new Set<string>();
  const pickUnused = (pool: TrainingExercise[]): TrainingExercise | undefined => {
    const fresh = pool.filter((e) => !used.has(e.id));
    const ex = pick(fresh.length ? fresh : pool, seed, salt++);
    if (ex) used.add(ex.id);
    return ex;
  };

  return blocks.map((b) => {
    const t = b.title;
    if (/줄넘기/.test(t)) {
      const ex = pickUnused(rhythm);
      return ex ? swapBlock(b, ex) : b;
    }
    if (/워밍업/.test(t)) {
      const ex = pickUnused(warmups);
      return ex ? swapBlock(b, ex) : b;
    }
    if (/서킷|코어|컨디셔닝|체력/.test(t)) {
      const ex = pickUnused(conditioning);
      return ex ? swapBlock(b, ex) : b;
    }
    return b;
  });
};

/** WhiteLeagueTab 등에서 바로 쓰는 훅 — 오늘 날짜+회원+레벨 시드로 구성 */
export const useComposedSession = (
  blocks: SessionBlock[] | null,
  globalLevel: number,
): SessionBlock[] | null => {
  const { user } = useAuth();
  const { data: library } = useTrainingLibrary();
  return useMemo(() => {
    if (!blocks) return blocks;
    const seedKey = `${user?.id ?? "guest"}|${localDateStr()}|${globalLevel}`;
    return composeSession(blocks, library ?? [], seedKey, globalLevel);
  }, [blocks, library, user?.id, globalLevel]);
};

/** 이번 레벨의 "필수 훈련" — 레벨업 심사에 나오는 기술 드릴 */
export const usePriorityDrills = (globalLevel: number, count = 4): TrainingExercise[] => {
  const { data: library } = useTrainingLibrary();
  return useMemo(() => {
    if (!library) return [];
    const SKIP = new Set(["워밍업", "줄넘기", "쿨다운", "컨디셔닝", "회복"]);
    const tech = library.filter((e) => !SKIP.has(e.category) && e.level_min <= globalLevel);
    // 현재 레벨에 가장 가까운(=이번에 배우는) 순 → 정렬 우선
    tech.sort((a, b) => (b.level_min - a.level_min) || (a.sort_order - b.sort_order));
    return tech.slice(0, count);
  }, [library, globalLevel, count]);
};
