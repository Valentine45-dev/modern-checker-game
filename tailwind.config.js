/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#141414",
        // Foreground accent.
        //
        // `primary` is a near-black meant for surfaces and button fills. Used as
        // a *text* colour it sat at 1.04:1 against this app's dark background —
        // indistinguishable from it. Anything that needs to be read or seen uses
        // this instead, which measures about 10:1 on the same background.
        accent: "#fbbf24",
        "background-light": "#f7f7f7",
        "background-dark": "#191919",
        "board-light": "#EADCCF",
        "board-dark": "#A98467",
      },
      fontFamily: {
        display: ["Space Grotesk", "system-ui", "sans-serif"],
      },
      // visualThemes.ts uses `hover:scale-115` and `sm:border-3`. Neither is a
      // default Tailwind class, so both were silently dropped — the "Detailed"
      // piece style had no hover effect at all. Registering them here makes the
      // existing markup mean what it was written to mean.
      scale: {
        115: "1.15",
      },
      borderWidth: {
        3: "3px",
      },
    },
  },
  plugins: [],
}

