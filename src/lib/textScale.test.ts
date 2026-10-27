import { afterEach, describe, expect, it } from "vitest";
import { applyTextScale, readTextScale, saveTextScale } from "./textScale";

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.style.removeProperty("font-size");
});

describe("글씨 크기 (작게 · 보통 · 크게)", () => {
  it("처음에는 보통 — html 글씨 크기를 건드리지 않는다", () => {
    expect(readTextScale()).toBe("md");
    applyTextScale(readTextScale(), "/home");
    expect(document.documentElement.style.fontSize).toBe("");
  });

  it("크게 · 작게는 저장되고 바로 반영된다", () => {
    saveTextScale("lg");
    expect(readTextScale()).toBe("lg");
    expect(document.documentElement.style.fontSize).toBe("112.5%");
    saveTextScale("sm");
    expect(readTextScale()).toBe("sm");
    expect(document.documentElement.style.fontSize).toBe("93.75%");
  });

  it("보통으로 돌리면 저장을 지우고 기본 크기로", () => {
    saveTextScale("lg");
    saveTextScale("md");
    expect(window.localStorage.getItem("153.textScale")).toBeNull();
    expect(document.documentElement.style.fontSize).toBe("");
  });

  it("이상한 값은 보통으로 읽는다", () => {
    window.localStorage.setItem("153.textScale", "xl");
    expect(readTextScale()).toBe("md");
  });

  it("체육관 TV · 키오스크 화면은 회원 폰 설정과 상관없이 바꾸지 않는다", () => {
    applyTextScale("lg", "/tv/seolleung/1");
    expect(document.documentElement.style.fontSize).toBe("");
    applyTextScale("lg", "/face-kiosk");
    expect(document.documentElement.style.fontSize).toBe("");
  });
});
