import { describe, expect, it } from "vitest";
import {
  cleanLearnSummary,
  cleanLearnTitle,
  instagramEmbedUrl,
  isInstagramUrl,
  learnPbVideos,
  learnPrograms,
  pbExtraId,
  programBadge,
  programExtraId,
  programShelf,
  splitLearnPoints,
  type LearnProgramSource,
} from "./learnExtras";
import { TEST153_STATIONS } from "./test153";

const prog = (o: Partial<LearnProgramSource> & { id: number; yt_id: string; title: string }): LearnProgramSource => ({
  league: "화이트",
  tags: [],
  train_type: ["기술", "개인"],
  platform: "youtube",
  summary: "",
  channel: "153복싱짐",
  is_active: true,
  visibility: "public",
  ...o,
});

describe("영상으로 배우기 — 153플레이 영상 (2026-11-16)", () => {
  it("이름에서 꼬리표 · 조회수 · 길이 · '국가대표' 말을 뺀다", () => {
    expect(cleanLearnTitle("[레슨] 원투 잘하는 3가지 방법 — 10만뷰 기본기 강의")).toBe("원투 잘하는 3가지 방법");
    expect(cleanLearnTitle("[레슨] 근접전(인파이팅) 잘하는 5가지 방법 — 12만뷰")).toBe("근접전(인파이팅) 잘하는 5가지 방법");
    expect(cleanLearnTitle("[153] 전 국가대표 미트 트레이닝 — 공격·방어·반격")).toBe("미트 트레이닝 — 공격·방어·반격");
    expect(cleanLearnTitle("[153] 샌드백 잘 치려면? — 전 국가대표 원포인트")).toBe("샌드백 잘 치려면? — 원포인트");
    expect(cleanLearnTitle("[분석] 쨉이 중요한 이유 — 국가대표 1분 정보")).toBe("쨉이 중요한 이유 — 1분 정보");
    expect(cleanLearnTitle("[153] 전 국가대표 카운터 포인트 레슨 — 칠금점 (4분)")).toBe("카운터 포인트 레슨 — 칠금점");
    expect(cleanLearnTitle("[153기술] 복싱 풋워크 — 관장 시연 (35초)")).toBe("복싱 풋워크 — 관장 시연");
    expect(cleanLearnTitle("[153연타] 플러리 — L훅 R훅 더킹 R어퍼 L훅 R훅 더킹 위빙")).toBe("플러리 — L훅 R훅 더킹 R어퍼 L훅 R훅 더킹 위빙");
  });

  it("설명에서 조회수 · '국가대표' 말을 빼고 문장은 살린다", () => {
    expect(cleanLearnSummary("원투를 3가지로 압축한 관장 직강 — ① 기본 자세 ② 잽 ③ 투에 체중 싣기. 10만 조회 검증 레슨.")).toBe(
      "원투를 3가지로 압축한 관장 직강 — ① 기본 자세 ② 잽 ③ 투에 체중 싣기.",
    );
    expect(cleanLearnSummary("기술이 아무리 좋아도 체력이 안 되면 끝 — 근지구력의 가치 (18만 조회 대표작).")).toBe(
      "기술이 아무리 좋아도 체력이 안 되면 끝 — 근지구력의 가치.",
    );
    expect(cleanLearnSummary("미트를 잘 치는 3포인트 중 1번 밸런스부터 짚는 2.8만 조회 레슨.")).toBe("미트를 잘 치는 3포인트 중 1번 밸런스부터 짚는 레슨.");
    expect(cleanLearnSummary("공격 후 방어, 방어 후 반격까지 — 국가대표 출신의 미트 시퀀스.")).toBe("공격 후 방어, 방어 후 반격까지 — 미트 시퀀스.");
    expect(cleanLearnSummary("153복싱짐 칠금점에서 진행한 전 복싱 국가대표의 카운터 포인트 레슨.")).toBe("153복싱짐 칠금점에서 진행한 카운터 포인트 레슨.");
    expect(cleanLearnSummary("모든 것의 시작 잽 — 국가대표가 말하는 잽의 가치 1분.")).toBe("모든 것의 시작 잽 — 잽의 가치 1분.");
    expect(cleanLearnSummary("빌드업의 원리, 국가대표 1분 레슨.")).toBe("빌드업의 원리, 1분 레슨.");
    expect(cleanLearnSummary(null)).toBe("");
  });

  it("「① ② ③」은 핵심 포인트로, 맺음 문장은 단락으로", () => {
    expect(splitLearnPoints("카운터를 능가하는 카운터 — ① 올바른 스탠스 ② 상대 잽 타이밍 읽기 ③ 정확한 궤적으로 되받기. 크로스 카운터 3원칙 직강.")).toEqual({
      description: "카운터를 능가하는 카운터 — 크로스 카운터 3원칙 직강.",
      points: ["올바른 스탠스", "상대 잽 타이밍 읽기", "정확한 궤적으로 되받기"],
    });
    expect(splitLearnPoints("승리의 필수 전략 회피 — ① 피해 최소화 ② 체력 보존 ③ 심리적 우위까지, 회피의 가치를 5가지로 정리.")).toEqual({
      description: "승리의 필수 전략 회피 — 회피의 가치를 5가지로 정리.",
      points: ["피해 최소화", "체력 보존", "심리적 우위"],
    });
    expect(splitLearnPoints("힘을 제압하는 건 타이밍 — ① 밸런스 ② 힘 빼고 리듬 타다 마지막에 임팩트, 미트 포인트 레슨 3가지.").points).toEqual([
      "밸런스",
      "힘 빼고 리듬 타다 마지막에 임팩트",
    ]);
    // 포인트 안의 쉼표(맺음 말이 아님)는 그대로
    expect(splitLearnPoints("원투 — ① 기본 자세와 움직임(어깨 전방, 무릎 탄력) ② 투에 체중 싣기.").points).toEqual(["기본 자세와 움직임(어깨 전방, 무릎 탄력)", "투에 체중 싣기"]);
    expect(splitLearnPoints("강약 조절부터 — 힘 빼고 부드럽게 치는 샌드백의 첫 원칙.")).toEqual({
      description: "강약 조절부터 — 힘 빼고 부드럽게 치는 샌드백의 첫 원칙.",
      points: [],
    });
  });

  it("칸 — 꼬리표 · 훈련 종류 · 제목으로", () => {
    expect(programShelf({ title: "[레슨] 미트 잘 치는 3가지 포인트", tags: ["레슨", "미트"], train_type: ["기술"] })).toBe("drill");
    expect(programShelf({ title: "[153] 아령 샌드백 프로그램", tags: ["샌드백", "컨디셔닝"], train_type: ["체력"] })).toBe("fitness");
    expect(programShelf({ title: "[레슨] 시합·스파링 전 몸 풀어야 하는 5가지 이유", tags: ["레슨", "컨디셔닝"], train_type: ["기술"] })).toBe("warmup");
    expect(programShelf({ title: "[레슨] 크로스 카운터 잘하는 3가지 방법", tags: ["레슨", "디펜스"], train_type: ["기술"] })).toBe("defense");
    expect(programShelf({ title: "[153기술] 복싱 풋워크 — 관장 시연", tags: ["풋워크"], train_type: ["기술"] })).toBe("step");
    expect(programShelf({ title: "[레슨] 스텝 어퍼의 5가지 장점", tags: ["레슨", "어퍼컷", "풋워크"], train_type: ["기술"] })).toBe("skill");
    expect(programShelf({ title: "[레슨] 훅 잘 치는 3가지 방법", tags: ["레슨", "기본기"], train_type: ["기술"] })).toBe("basics");
    expect(programShelf({ title: "[레슨] 잽을 잘 쓰면 세계를 제패한다", tags: ["레슨", "잽"], league: "화이트" })).toBe("basics");
    expect(programShelf({ title: "[레슨] 이노우에의 잽투", tags: ["레슨", "잽"], league: "레드" })).toBe("skill");
    expect(programShelf({ title: "[레슨] 숏훅 — 안 보이는 옆 궤적의 주먹", tags: ["레슨", "기본기"], league: "블루" })).toBe("skill");
    expect(programShelf({ title: "[153] 돌리고 훅", tags: ["기본기", "무브먼트"], league: "레드" })).toBe("skill");
    expect(programShelf({ title: "[분석] 카넬로 사기급 기술 3가지", tags: ["분석", "월드챔피언"] })).toBe("skill");
    expect(programBadge("[레슨] 훅")).toBe("153 레슨");
    expect(programBadge("[분석] 훅")).toBe("153 분석");
    expect(programBadge("[153연타] 플러리")).toBe("153 연타");
    expect(programBadge("[153] 미트")).toBe("153 영상");
  });

  it("레벨 미션 영상과 같은 영상 · 코치 교육 · 꺼진 · 관리자 전용 · 다른 채널은 빼고, 리그로 레벨", () => {
    const list = learnPrograms(
      [
        prog({ id: 1, yt_id: "AAAAAAAAAAA", title: "[분석] 밸런스와 가드가 중요한 이유", tags: ["분석", "가드", "기본기"] }),
        prog({ id: 2, yt_id: "SbtjOrbVQTs", title: "[153] 제자리 스텝" }),
        prog({ id: 3, yt_id: "CCCCCCCCCCC", title: "[153] 매뉴얼 1번", league: "블랙", tags: ["코치교육"], platform: "instagram" }),
        prog({ id: 4, yt_id: "DDDDDDDDDDD", title: "[153] 꺼진 영상", is_active: false }),
        prog({ id: 5, yt_id: "EEEEEEEEEEE", title: "[153] 관리자", visibility: "admin" }),
        prog({ id: 6, yt_id: "FFFFFFFFFFF", title: "남의 채널", channel: "Top Rank Boxing" }),
        prog({ id: 7, yt_id: "C0TsXI3vBcG", title: "[레슨] 원투 잘하는 3가지 방법 — 10만뷰 기본기 강의", platform: "instagram", tags: ["레슨", "기본기", "콤비네이션"], summary: "관장 직강 — ① 기본 자세 ② 잽으로 길을 열고 ③ 투에 체중 싣기. 10만 조회 검증 레슨." }),
        prog({ id: 8, yt_id: "GGGGGGGGGGG", title: "[분석] 피스톨 펀치 원샷원킬", league: "레드", tags: ["분석"] }),
        prog({ id: 9, yt_id: "HHHHHHHHHHH", title: "[레슨] 미트를 잘 치는 3가지", league: "블루", tags: ["레슨", "미트"] }),
      ],
      ["https://youtu.be/SbtjOrbVQTs"],
    );
    expect(list.map((x) => x.id)).toEqual([7, 1, 9, 8].map((n) => programExtraId(n)));
    const ig = list[0];
    expect(ig).toMatchObject({
      kind: "program",
      title: "원투 잘하는 3가지 방법",
      level: 1,
      shelf: "basics",
      badge: "153 레슨",
      poster: null,
      videoUrl: "https://www.instagram.com/reel/C0TsXI3vBcG/",
      description: "관장 직강",
      points: ["기본 자세", "잽으로 길을 열고", "투에 체중 싣기"],
    });
    expect(list[1]).toMatchObject({ videoUrl: "https://youtu.be/AAAAAAAAAAA", poster: "https://i.ytimg.com/vi/AAAAAAAAAAA/mqdefault.jpg", level: 1 });
    expect(list[2]).toMatchObject({ level: 11, shelf: "drill" });
    expect(list[3]).toMatchObject({ level: 21, shelf: "skill", badge: "153 분석" });
    // 회원 화면 글에 '국가대표' · 조회수가 남지 않는다
    for (const x of list) {
      expect(`${x.title} ${x.description} ${x.points.join(" ")}`).not.toMatch(/국가대표|만\s*조회|만뷰/);
    }
  });

  it("153 PB 종목 8편 — 체력 칸 · 고정 id · 기준과 요령", () => {
    const list = learnPbVideos(TEST153_STATIONS);
    expect(list).toHaveLength(8);
    expect(list[0]).toMatchObject({
      id: pbExtraId(1),
      kind: "pb",
      title: "복서 버피",
      shelf: "fitness",
      level: 1,
      badge: "153 PB 종목",
      videoUrl: "/test153/pb1.mp4",
      poster: "/test153/pb1.webp",
    });
    expect(list[0].points[0]).toMatch(/^인정 기준 — /);
    expect(new Set(list.map((x) => x.id)).size).toBe(8);
    expect(pbExtraId(8)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("153플레이 영상 번호 → 타일 id (uuid 모양 · 늘 같은 값)", () => {
    expect(programExtraId(1744)).toBe("1530b0b0-0000-4b00-8000-000000001744");
    expect(programExtraId("1744")).toBe("1530b0b0-0000-4b00-8000-000000001744");
    expect(programExtraId("9FEC2574-5132-4D6D-BDC7-09C6C635E5FE")).toBe("9fec2574-5132-4d6d-bdc7-09c6c635e5fe");
    expect(programExtraId("abc")).toBeNull();
    expect(programExtraId(1744)).not.toBe(pbExtraId(1));
  });

  it("인스타 릴스 주소 → 퍼가기 주소", () => {
    expect(isInstagramUrl("https://www.instagram.com/reel/C0TsXI3vBcG/")).toBe(true);
    expect(isInstagramUrl("https://youtu.be/AAAAAAAAAAA")).toBe(false);
    expect(instagramEmbedUrl("https://www.instagram.com/reel/C0TsXI3vBcG/")).toBe("https://www.instagram.com/reel/C0TsXI3vBcG/embed/");
    expect(instagramEmbedUrl("https://youtu.be/x")).toBeNull();
  });
});
