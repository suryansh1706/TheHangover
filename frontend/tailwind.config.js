/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { hangover: { paper: "#f7f5f0", ink: "#232c27", coral: "#d8754d", green: "#354e41" } },
      fontFamily: { sans: ["DM Sans", "sans-serif"], display: ["Playfair Display", "Georgia", "serif"] },
    },
  },
  plugins: [],
};
