/**
 * 앱 JSX 런타임 (개발 서버용) — jsx-runtime.ts 와 같다. 규칙은 core.ts.
 */
import { Fragment, jsxDEV as reactJsxDEV } from "react/jsx-dev-runtime";
import { transformProps } from "./core";

export { Fragment };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsxDEV(type: any, props: any, key: any, isStaticChildren: boolean, source: any, self: any) {
  const next = transformProps(type, props);
  // 글자 하나가 [글자, 아이콘, 글자] 로 바뀌면 정적 자식으로 알린다 (key 경고 없게 — 아이콘에는 key 가 있다)
  const expanded = next !== props && typeof props?.children === "string" && Array.isArray(next?.children);
  return reactJsxDEV(type, next, key, isStaticChildren || expanded, source, self);
}
