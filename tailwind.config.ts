import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  // /minigame (복싱 트레이닝) 에서 동적으로 조립되는 색 유틸리티.
  // 문자열 템플릿(`text-rating-${judgement}`, `text-tier-${t}`) 로 만들어져
  // 컨텐트 스캔에 잡히지 않으므로 강제 포함. CSS 변수는 src/features/minigame/minigame.css
  // 의 .minigame-app 스코프에서만 값이 설정되므로 앱 전체에 영향 없음.
  safelist: [
    "text-rating-lightning", "text-rating-fast", "text-rating-good", "text-rating-slow", "text-rating-miss",
    "text-rating-lightning/80", "text-rating-fast/80", "text-rating-good/80", "text-rating-slow/80", "text-rating-miss/80",
    "text-tier-bronze", "text-tier-silver", "text-tier-gold", "text-tier-platinum", "text-tier-legend",
    "text-tier-bronze/80", "text-tier-silver/80", "text-tier-gold/80", "text-tier-platinum/80", "text-tier-legend/80",
    "text-punch-jab", "text-punch-straight", "text-punch-hook", "text-punch-upper",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "480px",
      },
    },
    extend: {
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          '"Helvetica Neue"',
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          "sans-serif",
        ],
        // Scoreboard numerals — use for ranking / level / XP digits only
        number: [
          '"Space Grotesk"',
          '"Pretendard Variable"',
          "Pretendard",
          "-apple-system",
          "system-ui",
          "sans-serif",
        ],
        display: [
          '"Pretendard Variable"',
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          '"Helvetica Neue"',
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          "sans-serif",
        ],
        body: [
          '"Pretendard Variable"',
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          '"Helvetica Neue"',
          '"Segoe UI"',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '"Malgun Gothic"',
          '"Apple Color Emoji"',
          '"Segoe UI Emoji"',
          "sans-serif",
        ],
      },
      colors: {
        /* ─────────────────────────────────────────────
         * 3-tier palette — every chrome color below is
         * a shade of one of these. See src/index.css for
         * the HSL values and the rationale.
         *   primary   — CTA, emphasis  (orange-red)
         *   secondary — info surfaces  (neutral gray)
         *   accent    — reward / achievement (gold)
         * ───────────────────────────────────────────── */
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        // achievement / badges / currency (gold — separate from accent)
        reward: {
          DEFAULT: "hsl(var(--reward))",
          foreground: "hsl(var(--reward-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        // error-only, kept in primary red family
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // game-league identity tokens — not chrome; do not repurpose
        rank: {
          white: "hsl(var(--rank-white))",
          blue: "hsl(var(--rank-blue))",
          red: "hsl(var(--rank-red))",
          black: "hsl(var(--rank-black))",
        },
        // status — each is a shade of one of the 3 tiers above
        status: {
          locked: "hsl(var(--status-locked))",      // muted
          active: "hsl(var(--status-active))",      // primary
          pending: "hsl(var(--status-pending))",    // primary family
          complete: "hsl(var(--status-complete))",  // accent family
        },
        xp: {
          bar: "hsl(var(--xp-bar))",
          bg: "hsl(var(--xp-bar-bg))",
        },
        // surface elevation — layered neutrals for depth
        surface: {
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // 153 스토리 RPG 전용 비주얼 토큰 (Stage 47A).
        // 한국 90년대 PC RPG 일반 시각 언어 — 마이복서153 자체 IP 만 사용.
        story: {
          "amber-deep": "#b87900",
          "blood-red": "#a40e1a",
          "fog-gray": "#8a92a3",
          "lantern-glow": "#fdb85c",
        },
        // 복싱 트레이닝(/minigame) 전용 토큰. 실제 CSS 변수 값은
        // src/features/minigame/minigame.css 의 .minigame-app 안에서만 설정됨.
        punch: {
          jab: "hsl(var(--punch-jab))",
          straight: "hsl(var(--punch-straight))",
          hook: "hsl(var(--punch-hook))",
          upper: "hsl(var(--punch-upper))",
        },
        rating: {
          lightning: "hsl(var(--rating-lightning))",
          fast: "hsl(var(--rating-fast))",
          good: "hsl(var(--rating-good))",
          slow: "hsl(var(--rating-slow))",
          miss: "hsl(var(--rating-miss))",
        },
        tier: {
          bronze: "hsl(var(--tier-bronze))",
          silver: "hsl(var(--tier-silver))",
          gold: "hsl(var(--tier-gold))",
          platinum: "hsl(var(--tier-platinum))",
          legend: "hsl(var(--tier-legend))",
        },
      },
      borderRadius: {
        // Existing semantic aliases (kept for back-compat with
        // shadcn primitives that use rounded-lg/md/sm).
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Design-system radius scale (see rankingup-design-system.md)
        card: "20px",
        hero: "24px",
        pill: "9999px",
      },
      // Design-system type scale. Numbers (ranking / level / XP)
      // are intentionally named separately so Space Grotesk + tabular
      // digits can be pinned via the `.number-font` utility.
      fontSize: {
        "display-lg":  ["28px", { lineHeight: "36px", fontWeight: "800" }],
        "display-md":  ["24px", { lineHeight: "32px", fontWeight: "800" }],
        "display-sm":  ["20px", { lineHeight: "28px", fontWeight: "700" }],
        "body-lg":     ["16px", { lineHeight: "24px", fontWeight: "500" }],
        "body-sm":     ["14px", { lineHeight: "21px", fontWeight: "500" }],
        "caption":     ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "button":      ["16px", { lineHeight: "20px", fontWeight: "700" }],
        "badge":       ["12px", { lineHeight: "16px", fontWeight: "700" }],
        "number-lg":   ["32px", { lineHeight: "40px", fontWeight: "800" }],
        "number-md":   ["24px", { lineHeight: "32px", fontWeight: "800" }],
        "number-sm":   ["16px", { lineHeight: "22px", fontWeight: "700" }],
      },
      // premium-sport depth + game-style energy
      boxShadow: {
        "elev-1": "var(--shadow-elev-1)",
        "elev-2": "var(--shadow-elev-2)",
        "elev-3": "var(--shadow-elev-3)",
        "glow-primary": "var(--shadow-glow-primary)",
        "glow-gold": "var(--shadow-glow-gold)",
        "glow-reward": "var(--shadow-glow-reward)",
        "glow-blue": "var(--shadow-glow-blue)",
        "glow-soft": "var(--shadow-glow-soft)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px hsl(14 90% 55% / 0.3)" },
          "50%": { boxShadow: "0 0 20px hsl(14 90% 55% / 0.5)" },
        },
        "slide-up": {
          from: { transform: "translateY(16px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "bounce-in": {
          "0%": { transform: "scale(0.3)", opacity: "0" },
          "50%": { transform: "scale(1.05)" },
          "70%": { transform: "scale(0.95)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "slide-up": "slide-up 0.35s ease-out",
        "bounce-in": "bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
