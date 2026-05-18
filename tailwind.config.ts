import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        zju: {
          blue: "#004683",
          "blue-light": "#1A6FB5",
          "blue-bg": "#E8F0FE",
          gold: "#F5A623",
          red: "#D0021B",
        },
      },
    },
  },
  plugins: [],
};
export default config;
