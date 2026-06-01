import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        glass: "rgba(8, 15, 28, 0.85)",
        accent: "#63b7ff",
        accent2: "#f5a623",
        accent3: "#4ade80",
        ink1: "#f0f4ff",
        ink2: "#8a9bb8",
        ink3: "#4a5a72",
      },
      fontFamily: { sans: ["Pretendard", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
