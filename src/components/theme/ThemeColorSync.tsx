// 브라우저 상단바(안드로이드 크롬·설치형 앱 상태바) 색을 지금 테마에 맞춘다.
// index.html 의 <meta name="theme-color"> 는 라이트 기본값(#F2F4F6) — 회원이 다크를 고르면 여기서 같이 바꾼다.
import { useEffect } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS = { light: "#F2F4F6", dark: "#0B0F17" } as const;

const ThemeColorSync = () => {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const color = resolvedTheme === "dark" ? THEME_COLORS.dark : THEME_COLORS.light;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = color;
  }, [resolvedTheme]);

  return null;
};

export default ThemeColorSync;
