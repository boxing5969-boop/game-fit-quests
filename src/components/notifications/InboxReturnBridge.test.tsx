import { act, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import InboxReturnBridge from "@/components/notifications/InboxReturnBridge";
import { readInboxReturn, rememberInboxOpen } from "@/lib/inboxReturn";

const settle = async (n = 5) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 15));
    });
  }
};

function Home() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/notifications")}>알림함 열기</button>;
}
function Inbox() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>알림함</h1>
      <button
        onClick={() => {
          rememberInboxOpen();
          navigate("/target?received=1");
        }}
      >
        알림 열기
      </button>
    </div>
  );
}
function Target() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>알림 화면</h1>
      <button onClick={() => navigate("/deeper")}>더 들어가기</button>
    </div>
  );
}

const App = () => (
  <BrowserRouter>
    <InboxReturnBridge />
    <Routes>
      <Route path="/home" element={<Home />} />
      <Route path="/notifications" element={<Inbox />} />
      <Route path="/target" element={<Target />} />
      <Route path="/deeper" element={<h1>더 들어간 화면</h1>} />
    </Routes>
  </BrowserRouter>
);

const path = () => window.location.pathname;

async function openNotification() {
  window.history.replaceState({ usr: null, key: "start", idx: 0 }, "", "/home");
  const view = render(<App />);
  fireEvent.click(screen.getByText("알림함 열기"));
  await settle(2);
  fireEvent.click(screen.getByText("알림 열기"));
  await settle(2);
  expect(path()).toBe("/target");
  return view;
}

describe("InboxReturnBridge — 알림함에서 연 화면 → 뒤로가기 = 다시 알림함", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("크롬처럼 알림함에 바로 떨어지면 아무것도 안 한다", async () => {
    const view = await openNotification();
    await act(async () => window.history.back());
    await settle();
    expect(path()).toBe("/notifications");
    expect(screen.getByText("알림함")).toBeInTheDocument();
    expect(readInboxReturn()).not.toBeNull(); // 다른 알림을 또 열 수 있게 남긴다
    view.unmount();
  });

  it("브라우저가 알림함을 건너뛰고 첫 화면에 떨어져도 → 알림함으로 다시 연다", async () => {
    const view = await openNotification();
    await act(async () => window.history.go(-2)); // 삼성 인터넷처럼 알림함 칸을 건너뛴 뒤로가기
    await settle();
    expect(path()).toBe("/notifications");
    expect(screen.getByText("알림함")).toBeInTheDocument();
    // 다시 알림을 열고 또 건너뛰어도 같은 길
    fireEvent.click(screen.getByText("알림 열기"));
    await settle(2);
    expect(path()).toBe("/target");
    await act(async () => window.history.go(-2));
    await settle();
    expect(path()).toBe("/notifications");
    view.unmount();
  });

  it("연 알림에서 더 들어간 화면에서 건너뛰어도 알림함으로", async () => {
    const view = await openNotification();
    fireEvent.click(screen.getByText("더 들어가기"));
    await settle(2);
    expect(path()).toBe("/deeper");
    await act(async () => window.history.go(-3));
    await settle();
    expect(path()).toBe("/notifications");
    view.unmount();
  });

  it("알림함에서 뒤로(홈)는 그대로 · 기록을 지운다", async () => {
    const view = await openNotification();
    await act(async () => window.history.back());
    await settle();
    expect(path()).toBe("/notifications");
    await act(async () => window.history.back());
    await settle();
    expect(path()).toBe("/home");
    expect(readInboxReturn()).toBeNull();
    view.unmount();
  });
});
