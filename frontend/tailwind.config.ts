import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem"
    },
    extend: {
      colors: {
        border: "hsl(215 27% 16%)",
        input: "hsl(215 27% 16%)",
        ring: "hsl(240 5% 84%)",
        background: "hsl(222 47% 11%)",
        foreground: "hsl(210 40% 98%)",
        primary: {
          DEFAULT: "hsl(199 89% 48%)",
          foreground: "hsl(210 40% 98%)"
        },
        secondary: {
          DEFAULT: "hsl(222 23% 15%)",
          foreground: "hsl(210 40% 96%)"
        },
        muted: {
          DEFAULT: "hsl(223 25% 15%)",
          foreground: "hsl(215 20% 65%)"
        },
        accent: {
          DEFAULT: "hsl(199 89% 48%)",
          foreground: "hsl(210 40% 98%)"
        },
        destructive: {
          DEFAULT: "hsl(0 84% 60%)",
          foreground: "hsl(210 40% 98%)"
        },
        card: {
          DEFAULT: "hsl(222 41% 10%)",
          foreground: "hsl(210 40% 98%)"
        }
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem"
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" }
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out"
      }
    }
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("hocus", "&:hover, &:focus-visible");
    })
  ]
} satisfies Config;
