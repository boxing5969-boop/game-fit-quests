import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { KBA_CERT_URL, KBA_HOME_URL, SECRET_MISSIONS } from "./sharedConstants";

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

describe("한국복싱협회 단증 앱 연결 (2026-10-30 대표님 '예전 버전으로 들어가')", () => {
  it("단증 앱 단추는 모두 첫 화면(홈)으로 — 로그인 화면으로 가는 /apply · /examiner 쓰지 않음 (2026-10-31)", () => {
    expect(KBA_CERT_URL).toBe("https://korea-boxing-cert.pages.dev");
    expect(KBA_HOME_URL).toBe("https://korea-boxing-cert.pages.dev/");
    for (const m of SECRET_MISSIONS) expect(m.linkTo).toBe(KBA_HOME_URL);
    const src = join(__dirname, "..");
    const deep = walk(src).filter((f) => !f.endsWith(".test.ts") && /korea-boxing-cert\.pages\.dev\/\w|KBA_CERT_URL\}\/\w/.test(readFileSync(f, "utf8")));
    expect(deep).toEqual([]);
  });

  it("앱 어디에도 예전 승단 신청서 주소(korea-boxing.lovable.app)가 남지 않는다", () => {
    const src = join(__dirname, "..");
    const left = walk(src).filter((f) => !f.endsWith(".test.ts") && readFileSync(f, "utf8").includes("korea-boxing.lovable.app"));
    expect(left).toEqual([]);
  });
});
