import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn — 글씨 크기 이름과 글자 색이 같이 남는다 (2026-10-28)", () => {
  it("크기 뒤에 색 · 색 뒤에 크기 — 둘 다 남는다", () => {
    expect(cn("text-label text-muted-foreground")).toBe("text-label text-muted-foreground");
    expect(cn("text-muted-foreground", "text-heading")).toBe("text-muted-foreground text-heading");
    expect(cn("text-display font-black", "text-foreground")).toBe("text-display font-black text-foreground");
    expect(cn("text-tv-micro text-primary")).toBe("text-tv-micro text-primary");
  });
  it("크기끼리 · 색끼리는 뒤에 온 것이 이긴다", () => {
    expect(cn("text-label", "text-body")).toBe("text-body");
    expect(cn("text-white", "text-primary")).toBe("text-primary");
    expect(cn("text-sm", "text-label")).toBe("text-label");
  });
});
