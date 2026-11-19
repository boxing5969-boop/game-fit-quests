import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// 오류 신고 댓글 화면 (2026-11-19) — 서버 함수는 가짜로 · 지어낸 이름
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import MyFeedbackList from "@/components/feedback/MyFeedbackList";
import FeedbackThread from "@/components/feedback/FeedbackThread";

const wrap = (ui: React.ReactNode) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

const FB = "ffffffff-0000-4000-8000-00000000000f";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn(); // jsdom 에 없음
  rpc.mockReset();
  rpc.mockImplementation(async (name: string) => {
    if (name === "get_my_app_feedback")
      return {
        data: {
          unread: 1,
          items: [
            {
              id: FB,
              category: "오류",
              content: "알림이 안 와요",
              status: "seen",
              created_at: "2026-11-18T11:22:00Z",
              handled_at: null,
              comment_count: 2,
              unread: 1,
              last_comment_at: "2026-11-19T03:00:00Z",
            },
          ],
        },
        error: null,
      };
    if (name === "get_app_feedback_thread")
      return {
        data: {
          feedback_id: FB,
          comments: [
            {
              id: "c1",
              body: "설정에서 알림 켜기를 눌러 주세요",
              created_at: "2026-11-19T03:00:00Z",
              is_staff: true,
              mine: false,
              author_name: "운영진A",
              author_avatar: null,
            },
            {
              id: "c2",
              body: "켰는데도 안 와요",
              created_at: "2026-11-19T03:10:00Z",
              is_staff: false,
              mine: true,
              author_name: "회원에이",
              author_avatar: null,
            },
          ],
        },
        error: null,
      };
    if (name === "add_app_feedback_comment") return { data: { ok: true }, error: null };
    if (name === "remove_app_feedback_comment") return { data: { ok: true }, error: null };
    return { data: null, error: null };
  });
});

describe("내 신고 — 운영진 답글 보기 · 댓글 쓰기", () => {
  it("알림으로 온 신고는 펼쳐져 운영진 답글이 보이고, 댓글을 보낼 수 있다", async () => {
    wrap(<MyFeedbackList focusId={FB} onWrite={() => {}} />);
    expect(await screen.findByText("알림이 안 와요")).toBeInTheDocument();
    expect(screen.getByText("확인 중")).toBeInTheDocument();
    expect(screen.getByText("새 답글 1")).toBeInTheDocument();
    expect(await screen.findByText("설정에서 알림 켜기를 눌러 주세요")).toBeInTheDocument();
    expect(screen.getByText("운영진")).toBeInTheDocument();
    expect(screen.getByText("나")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("댓글"), { target: { value: "  다시 확인해 주세요  " } });
    fireEvent.click(screen.getByLabelText("댓글 보내기"));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("add_app_feedback_comment", { p_feedback: FB, p_body: "다시 확인해 주세요" }));
  });
});

describe("댓글 지우기 — 두 번 눌러서", () => {
  it("내 댓글은 한 번 누르면 묻고, 한 번 더 누르면 지운다 · 남의 댓글엔 단추가 없다(회원)", async () => {
    wrap(<FeedbackThread feedbackId={FB} viewer="member" />);
    expect(await screen.findByText("켰는데도 안 와요")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /지우기/ });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(rpc).not.toHaveBeenCalledWith("remove_app_feedback_comment", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: /한 번 더 누르면 지워요/ }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("remove_app_feedback_comment", { p_id: "c2" }));
  });
  it("운영진은 회원 댓글도 지울 수 있다", async () => {
    wrap(<FeedbackThread feedbackId={FB} viewer="staff" />);
    expect(await screen.findByText("켰는데도 안 와요")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /지우기/ })).toHaveLength(2);
  });
});
