import { describe, expect, it } from "vitest";
import {
  attemptsLeft,
  formatKoMonthDay,
  formatKoShortDateTime,
  invitePopupKey,
  isTitleFlowLeague,
  kstDateKey,
  memberPhase,
  parseTitleMatchState,
  pickRecorderMime,
  retryAtFrom,
  shouldShowInvite,
  titleMatchLink,
  titleMissionRules,
  titleVideoPath,
  videoContentType,
  type TitleMatchState,
} from "./titleMatchChallenge";

const base = {
  ok: true,
  rank: "white",
  level: 10,
  isTitleLevel: true,
  flowEnabled: true,
  cleared: false,
  authority: "manager",
  maxAttempts: 3,
  retryDays: 7,
  retryAt: null,
  challenge: null,
  canRequest: true,
};

const parse = (over: Record<string, unknown>) => parseTitleMatchState({ ...base, ...over }) as TitleMatchState;

describe("parseTitleMatchState", () => {
  it("ok 가 아니면 null", () => {
    expect(parseTitleMatchState(null)).toBeNull();
    expect(parseTitleMatchState({ ok: false, reason: "no_progress" })).toBeNull();
    expect(parseTitleMatchState("x")).toBeNull();
  });

  it("도전 기록을 번호순으로 읽고 모양이 틀린 줄은 버린다", () => {
    const s = parse({
      canRequest: false,
      challenge: {
        id: "c1",
        status: "requested",
        requestedAt: "2026-10-14T10:00:00Z",
        requestedBySelf: true,
        closedAt: null,
        attempts: [
          { no: 2, passed: false, note: " ", recordedAt: "2026-10-14T11:00:00Z", videoPath: "u/2.mp4" },
          { no: 1, passed: false, note: "가드", recordedAt: "2026-10-14T10:30:00Z", videoPath: "u/1.mp4" },
          { no: 0, passed: true },
          "쓰레기",
        ],
      },
    });
    expect(s.challenge?.attempts.map((a) => a.no)).toEqual([1, 2]);
    expect(s.challenge?.attempts[1].note).toBeNull();
    expect(s.challenge?.attempts[0].note).toBe("가드");
    expect(attemptsLeft(s)).toBe(1);
  });

  it("모르는 상태의 신청은 없는 것으로 본다", () => {
    expect(parse({ challenge: { id: "c1", status: "weird", attempts: [] } }).challenge).toBeNull();
  });

  it("서버가 숫자를 안 주면 3번 · 7일", () => {
    const s = parseTitleMatchState({ ok: true, rank: "white", level: 10 }) as TitleMatchState;
    expect(s.maxAttempts).toBe(3);
    expect(s.retryDays).toBe(7);
    expect(s.authority).toBe("manager");
  });
});

describe("memberPhase · shouldShowInvite", () => {
  it("레벨 10 · 신청 전이면 ready → 팝업", () => {
    const s = parse({});
    expect(memberPhase(s)).toBe("ready");
    expect(shouldShowInvite(s)).toBe(true);
  });

  it("레벨 9 · 다른 리그 · 정보 없음은 not_title (팝업 없음)", () => {
    expect(memberPhase(parse({ level: 9, isTitleLevel: false, canRequest: false }))).toBe("not_title");
    expect(memberPhase(parse({ rank: "blue", flowEnabled: false, canRequest: false }))).toBe("not_title");
    expect(memberPhase(null)).toBe("not_title");
    expect(shouldShowInvite(undefined)).toBe(false);
  });

  it("신청함 → requested, 도전 1번 이상 → challenging (팝업 없음)", () => {
    const ch = { id: "c", status: "requested", requestedAt: "", attempts: [] as unknown[] };
    const s1 = parse({ canRequest: false, challenge: ch });
    expect(memberPhase(s1)).toBe("requested");
    expect(shouldShowInvite(s1)).toBe(false);
    const s2 = parse({
      canRequest: false,
      challenge: { ...ch, attempts: [{ no: 1, passed: false, recordedAt: "", videoPath: "" }] },
    });
    expect(memberPhase(s2)).toBe("challenging");
    expect(attemptsLeft(s2)).toBe(2);
  });

  it("3번 마감 → locked, 지난 신청이 실패여도 잠금이 풀리면 다시 ready", () => {
    const failed = { id: "c", status: "failed", requestedAt: "", closedAt: "2026-10-14T05:00:00Z", attempts: [] };
    expect(memberPhase(parse({ canRequest: false, retryAt: "2026-10-20T15:00:00Z", challenge: failed }))).toBe("locked");
    expect(memberPhase(parse({ canRequest: true, retryAt: null, challenge: failed }))).toBe("ready");
  });

  it("통과했으면 cleared — 신청 취소 기록은 신청 전과 같다", () => {
    expect(memberPhase(parse({ cleared: true, canRequest: false }))).toBe("cleared");
    const cancelled = { id: "c", status: "cancelled", requestedAt: "", attempts: [] };
    expect(memberPhase(parse({ challenge: cancelled }))).toBe("ready");
  });
});

describe("한국 날짜", () => {
  it("kstDateKey — UTC 15:00 이후는 한국 다음 날", () => {
    expect(kstDateKey(new Date("2026-10-14T14:59:59Z"))).toBe("2026-10-14");
    expect(kstDateKey(new Date("2026-10-14T15:00:00Z"))).toBe("2026-10-15");
  });

  it("retryAtFrom — DB title_match_retry_at 과 같다 (마감된 한국 날짜 + 7일 0시)", () => {
    // DB 실측: 10/14 23:30 KST · 10/14 00:10 KST → 둘 다 10/21 00:00 KST
    expect(retryAtFrom("2026-10-14T14:30:00Z")).toBe("2026-10-20T15:00:00.000Z");
    expect(retryAtFrom("2026-10-13T15:10:00Z")).toBe("2026-10-20T15:00:00.000Z");
    // 한국 자정 직후에 마감 → 그날 기준
    expect(retryAtFrom("2026-10-14T15:00:00Z")).toBe("2026-10-21T15:00:00.000Z");
    expect(retryAtFrom(null)).toBeNull();
    expect(retryAtFrom("엉뚱")).toBeNull();
  });

  it("formatKoMonthDay · formatKoShortDateTime", () => {
    expect(formatKoMonthDay("2026-10-20T15:00:00Z")).toBe("10월 21일");
    expect(formatKoShortDateTime("2026-10-14T10:05:00Z")).toBe("10/14 19:05");
    expect(formatKoMonthDay(null)).toBe("");
  });

  it("팝업 기억 키는 사람·한국 날짜마다 다르다", () => {
    const a = invitePopupKey("u1", new Date("2026-10-14T14:59:00Z"));
    const b = invitePopupKey("u1", new Date("2026-10-14T15:01:00Z"));
    expect(a).toBe("153title:invite:u1:2026-10-14");
    expect(b).toBe("153title:invite:u1:2026-10-15");
    expect(invitePopupKey("u2", new Date("2026-10-14T14:59:00Z"))).not.toBe(a);
  });
});

describe("영상", () => {
  it("형식 맞추기 — 코덱 꼬리 제거 · 확장자로 짐작 · 모르면 null", () => {
    expect(videoContentType({ type: "video/mp4;codecs=avc1" })).toBe("video/mp4");
    expect(videoContentType({ type: "video/quicktime", name: "IMG_1.MOV" })).toBe("video/quicktime");
    expect(videoContentType({ type: "", name: "clip.MOV" })).toBe("video/quicktime");
    expect(videoContentType({ type: "", name: "a.3gp" })).toBe("video/3gpp");
    expect(videoContentType({ type: "application/octet-stream", name: "a.webm" })).toBe("video/webm");
    expect(videoContentType({ type: "image/png", name: "a.png" })).toBeNull();
    expect(videoContentType({ type: "video/x-matroska", name: "a.mkv" })).toBeNull();
  });

  it("저장 경로가 DB 검사식을 통과한다", () => {
    const uid = "0b6f3a4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";
    for (const r of [0, 0.5, 0.999999]) {
      for (const t of ["video/mp4", "video/quicktime", "video/webm"]) {
        const p = titleVideoPath(uid, t, new Date("2026-10-14T10:05:33Z"), r);
        expect(p).toMatch(new RegExp(`^${uid}/[A-Za-z0-9._-]{1,120}$`));
        expect(p.startsWith(`${uid}/20261014-190533-`)).toBe(true);
      }
    }
    expect(titleVideoPath(uid, "video/quicktime", new Date(), 0.1).endsWith(".mov")).toBe(true);
  });

  it("촬영 형식 — mp4 먼저, 안 되면 webm, 둘 다 안 되면 null", () => {
    expect(pickRecorderMime((t) => t === "video/mp4")).toEqual({ mimeType: "video/mp4", contentType: "video/mp4" });
    expect(pickRecorderMime((t) => t.startsWith("video/webm"))).toEqual({
      mimeType: "video/webm;codecs=vp9",
      contentType: "video/webm",
    });
    expect(pickRecorderMime(() => false)).toBeNull();
    expect(
      pickRecorderMime(() => {
        throw new Error("x");
      }),
    ).toBeNull();
  });
});

describe("기타", () => {
  it("흐름 리그는 화이트만", () => {
    expect(isTitleFlowLeague("white")).toBe(true);
    expect(isTitleFlowLeague("blue")).toBe(false);
    expect(isTitleFlowLeague(undefined)).toBe(false);
  });

  it("타이틀매치 화면 주소", () => {
    expect(titleMatchLink("white")).toBe("/title-match?lv=10");
    expect(titleMatchLink("black")).toBe("/title-match?lv=40");
  });

  it("심사 기준 문구는 서버 숫자를 따른다 · 금지어 없음", () => {
    const rules = titleMissionRules(3, 7).join(" ");
    expect(rules).toContain("3번 연속");
    expect(rules).toContain("미트로 3번");
    expect(rules).toContain("도전은 3번까지");
    expect(rules).toContain("7일 뒤");
    for (const bad of ["벨트", "계급", "무조건", "확정 혜택", "자동 가산점"]) expect(rules).not.toContain(bad);
  });
});
