/**
 * 토스트(sonner) 문구 속 이모지 → 153 입체 아이콘 (2026-10-16 대표님 — map.ts 참고).
 * sonner 는 자기 안에서 글자를 그려 앱 JSX 런타임을 거치지 않는다. 그래서 vite.config.ts 가
 * `import { toast } from "sonner"` 를 이 파일로 돌리고, 여기서 진짜 sonner(sonner-original)를 감싼다.
 * 앱 코드는 지금처럼 "sonner" 에서 가져오면 된다.
 */
import { toast as baseToast, Toaster, useSonner } from "sonner-original";
import type { ReactNode } from "react";
import { renderEmoji3D } from "./core";

export type { Action, ExternalToast, ToastClassnames, ToastT, ToastToDismiss, ToasterProps } from "sonner-original";
export { Toaster, useSonner };

const fixNode = <T,>(m: T): T | ReactNode => (typeof m === "string" ? renderEmoji3D(m) : m);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fixData = (d: any) => (d && typeof d.description === "string" ? { ...d, description: renderEmoji3D(d.description) } : d);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fixResult = (r: any) =>
  typeof r === "function"
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (...args: any[]) => {
        const v = r(...args);
        return v && typeof v.then === "function" ? v.then(fixNode) : fixNode(v);
      }
    : fixNode(r);

type Toast = typeof baseToast;
type Msg = Parameters<Toast["success"]>[0];
type Data = Parameters<Toast["success"]>[1];

/**
 * 같은 문구를 다시 띄우면 새로 쌓지 않고 떠 있는 것을 바꾼다 (2026-10-18 오류 신고: 같은 버튼을 계속 누르면 알림이 여러 개 겹침).
 * id 를 직접 준 토스트는 그대로 둔다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dedupe = (kind: string, m: unknown, d: any) =>
  d?.id != null || typeof m !== "string" ? d : { ...(d ?? {}), id: `${kind}:${m}` };

export const toast: Toast = Object.assign(
  (message: Parameters<Toast>[0], data?: Parameters<Toast>[1]) =>
    baseToast(fixNode(message) as Parameters<Toast>[0], fixData(dedupe("default", message, data))),
  {
    success: (m: Msg, d?: Data) => baseToast.success(fixNode(m), fixData(dedupe("success", m, d))),
    info: (m: Msg, d?: Data) => baseToast.info(fixNode(m), fixData(dedupe("info", m, d))),
    warning: (m: Msg, d?: Data) => baseToast.warning(fixNode(m), fixData(dedupe("warning", m, d))),
    error: (m: Msg, d?: Data) => baseToast.error(fixNode(m), fixData(dedupe("error", m, d))),
    message: (m: Msg, d?: Data) => baseToast.message(fixNode(m), fixData(dedupe("message", m, d))),
    loading: (m: Msg, d?: Data) => baseToast.loading(fixNode(m), fixData(d)),
    custom: baseToast.custom,
    dismiss: baseToast.dismiss,
    promise: ((p, d) =>
      baseToast.promise(
        p,
        d && {
          ...d,
          loading: fixNode(d.loading),
          success: fixResult(d.success),
          error: fixResult(d.error),
          description: fixResult(d.description),
        },
      )) as Toast["promise"],
    getHistory: baseToast.getHistory,
    getToasts: baseToast.getToasts,
  },
);
