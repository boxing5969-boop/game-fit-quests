import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { KBA_CERT_URL, KBA_DAN_APPLY_URL, KBA_EXAMINER_URL, SECRET_MISSIONS } from "./sharedConstants";

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

describe("한국복싱협회 단증 앱 연결 (2026-10-30 대표님 '예전 버전으로 들어가')", () => {
  it("단증 도전 = 새 앱 단증 신청 화면 · 심사관 = 심사관 신청", () => {
    expect(KBA_CERT_URL).toBe("https://korea-boxing-cert.pages.dev");
    expect(KBA_DAN_APPLY_URL).toBe("https://korea-boxing-cert.pages.dev/apply");
    expect(KBA_EXAMINER_URL).toBe("https://korea-boxing-cert.pages.dev/examiner");
    for (const m of SECRET_MISSIONS) expect(m.linkTo.startsWith(KBA_CERT_URL)).toBe(true);
  });

  it("앱 어디에도 예전 승단 신청서 주소(korea-boxing.lovable.app)가 남지 않는다", () => {
    const src = join(__dirname, "..");
    const left = walk(src).filter((f) => !f.endsWith(".test.ts") && readFileSync(f, "utf8").includes("korea-boxing.lovable.app"));
    expect(left).toEqual([]);
  });
});
