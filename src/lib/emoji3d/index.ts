/**
 * JSX 컴파일러가 `<X {...props} key={k}>` (key 가 펼침 뒤) 모양을 만나면 jsx() 대신 이 파일의 createElement 를 부른다
 * (esbuild·SWC 공통 — jsxImportSource 패키지 루트에서 가져온다). 그래서 이 파일이 없으면 그런 코드가 생기는 순간 빌드가 깨진다.
 * 규칙은 jsx-runtime 과 같다 (core.ts).
 */
import { createElement as reactCreateElement } from "react";
import { transformProps } from "./core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createElement(type: any, config: any, ...children: any[]) {
  if (children.length === 0) return reactCreateElement(type, transformProps(type, config));
  const kids = children.length === 1 ? children[0] : children;
  const next = transformProps(type, { ...(config ?? {}), children: kids });
  const { children: newKids, ...rest } = next;
  if (children.length === 1) return reactCreateElement(type, rest, newKids);
  return reactCreateElement(type, rest, ...(Array.isArray(newKids) ? newKids : [newKids]));
}
