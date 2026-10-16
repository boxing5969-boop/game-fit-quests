/**
 * 앱 JSX 런타임 (빌드용) — React 의 jsx 를 감싸 글자 속 이모지를 153 입체 아이콘으로 바꾼다.
 * vite.config.ts 의 react({ jsxImportSource: "@/lib/emoji3d" }) 가 모든 .tsx 를 이 파일로 컴파일한다.
 * 규칙은 core.ts. 타입 검사(tsc)는 그대로 react 의 JSX 타입을 쓴다.
 */
import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from "react/jsx-runtime";
import { transformProps } from "./core";

export { Fragment };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsx(type: any, props: any, key?: any) {
  return reactJsx(type, transformProps(type, props), key);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function jsxs(type: any, props: any, key?: any) {
  return reactJsxs(type, transformProps(type, props), key);
}
