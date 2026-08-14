import type { Config } from "tailwindcss";

/**
 * カラーの考え方
 *
 * - 地はグレーではなく象牙色。掃除・片付けという主題の「清潔さ」と、
 *   オレンジの「温かさ」を両立させる。
 * - ニュートラル（slate）は純粋な灰色を使わず、オレンジ側にわずかに色味を振る。
 *   純グレーは地から浮いて冷たく見えるため。
 * - 強い色はブランドのオレンジ1色に集中させ、他は静かに保つ。
 *   例外は「オンライン提供」の識別色だけで、対比のために深いティールを当てる。
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 地・面・線
        ground: "#FFF8F2",
        surface: "#FFFFFF",
        ink: "#2B1A10",

        // ニュートラル（オレンジ寄りに振った砂色）
        slate: {
          50: "#FBF6F1",
          100: "#F5EDE5",
          200: "#EADCD0",
          300: "#DCC8B7",
          400: "#B49B87",
          500: "#8C7461",
          600: "#6E594A",
          700: "#544236",
          800: "#3B2E25",
          900: "#2B1A10",
        },

        // ブランド（オレンジ）
        brand: {
          50: "#FFF3EA",
          100: "#FDE4D2",
          200: "#FAC7A6",
          300: "#F5A472",
          400: "#EF8244",
          500: "#E8621A",
          600: "#D2500F",
          700: "#AC3F0B",
          800: "#82300A",
          900: "#5C230A",
        },

        // オンライン提供の識別色（オレンジの対比）
        ocean: {
          50: "#EDF7F6",
          100: "#D6ECEA",
          500: "#158C86",
          600: "#0F6E6A",
          700: "#0B5350",
        },

        // 意味を持つ色（ブランド色とは別に持つ）
        good: { 50: "#EDF6F0", 100: "#D6EADD", 600: "#2F7D57", 700: "#23603F" },
        warn: { 50: "#FEF6E7", 100: "#FBEBCB", 600: "#B4791C", 700: "#8A5C12" },
        bad: { 50: "#FDEFEC", 100: "#F9DAD3", 600: "#C4442E", 700: "#9C3322" },
      },

      fontFamily: {
        sans: [
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          '"Noto Sans JP"',
          "Meiryo",
          "system-ui",
          "sans-serif",
        ],
      },

      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },

      borderRadius: {
        card: "1rem",
        pill: "999px",
      },

      boxShadow: {
        card: "0 1px 2px rgba(43,26,16,0.04), 0 8px 24px -12px rgba(43,26,16,0.14)",
        lift: "0 2px 4px rgba(43,26,16,0.05), 0 16px 40px -16px rgba(43,26,16,0.22)",
        phone: "0 32px 80px -24px rgba(43,26,16,0.38)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.6)",
      },

      backgroundImage: {
        "brand-sheen": "linear-gradient(135deg, #EF8244 0%, #E8621A 55%, #D2500F 100%)",
        "ground-warm": "radial-gradient(120% 80% at 50% 0%, #FFF3E8 0%, #FBEFE4 45%, #F6E7DA 100%)",
      },

      letterSpacing: {
        tight: "-0.015em",
        tighter: "-0.03em",
      },
    },
  },
  plugins: [],
} satisfies Config;
