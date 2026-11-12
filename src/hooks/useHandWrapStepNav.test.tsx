import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { useHandWrapStepNav } from "./useHandWrapStepNav";

/** 열고 닫는 단추 + 지금 주소를 보여 주는 작은 화면 */
const Probe = () => {
  const nav = useHandWrapStepNav();
  const loc = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <p data-testid="loc">{loc.pathname + loc.search}</p>
      <p data-testid="open">{nav.openIdx == null ? "closed" : String(nav.openIdx)}</p>
      <button onClick={() => nav.open(2)}>open3</button>
      <button onClick={() => nav.open(99)}>openFar</button>
      <button onClick={() => nav.go((nav.openIdx ?? 0) + 1)}>next</button>
      <button onClick={() => nav.go(-5)}>first</button>
      <button onClick={nav.close}>close</button>
      <button onClick={() => navigate(-1)}>back</button>
    </div>
  );
};

const loc = () => screen.getByTestId("loc").textContent;
const open = () => screen.getByTestId("open").textContent;
const press = (name: string) =>
  act(() => {
    fireEvent.click(screen.getByText(name));
  });

describe("붕대 감기 — 단계 상세 열고 닫기 (주소 ?step=N)", () => {
  it("이 화면에서 눌러 연 상세 — 주소에 남고, 넘겨도 기록이 쌓이지 않고, 닫으면 한 번에 원래 화면", () => {
    render(
      <MemoryRouter initialEntries={["/home", "/handwrap"]} initialIndex={1}>
        <Probe />
      </MemoryRouter>,
    );
    expect(open()).toBe("closed");
    press("open3");
    expect(loc()).toBe("/handwrap?step=3");
    expect(open()).toBe("2");
    press("next");
    press("next");
    expect(loc()).toBe("/handwrap?step=5");
    press("close");
    expect(loc()).toBe("/handwrap");
    expect(open()).toBe("closed");
    // 닫은 뒤 뒤로 가기 = 앞 화면 (상세가 다시 뜨지 않는다)
    press("back");
    expect(loc()).toBe("/home");
  });

  it("뒤로 가기로 닫아도 된다 — 그다음에 다시 열고 닫아도 한 칸만 거둔다", () => {
    render(
      <MemoryRouter initialEntries={["/home", "/handwrap"]} initialIndex={1}>
        <Probe />
      </MemoryRouter>,
    );
    press("open3");
    press("back");
    expect(loc()).toBe("/handwrap");
    expect(open()).toBe("closed");
    press("open3");
    press("close");
    expect(loc()).toBe("/handwrap");
    press("back");
    expect(loc()).toBe("/home");
  });

  it("주소로 바로 들어온 상세 — 닫으면 주소에서 step 만 지운다 (다른 값은 그대로)", () => {
    render(
      <MemoryRouter initialEntries={["/handwrap?step=13&from=push"]}>
        <Probe />
      </MemoryRouter>,
    );
    expect(open()).toBe("12");
    press("close");
    expect(loc()).toBe("/handwrap?from=push");
    expect(open()).toBe("closed");
  });

  it("범위 밖 단계는 맨 앞 · 맨 뒤로 맞춘다 · 주소의 이상한 값은 닫힌 것으로", () => {
    render(
      <MemoryRouter initialEntries={["/handwrap?step=abc"]}>
        <Probe />
      </MemoryRouter>,
    );
    expect(open()).toBe("closed");
    press("openFar");
    expect(loc()).toBe("/handwrap?step=13");
    press("first");
    expect(loc()).toBe("/handwrap?step=1");
  });
});
