import localFont from "next/font/local";

// Self-hosted (latin subset) so builds never depend on fetching Google Fonts
export const poppins = localFont({
  src: [
    { path: "./poppins-300.woff2", weight: "300", style: "normal" },
    { path: "./poppins-400.woff2", weight: "400", style: "normal" },
    { path: "./poppins-500.woff2", weight: "500", style: "normal" },
    { path: "./poppins-600.woff2", weight: "600", style: "normal" },
    { path: "./poppins-700.woff2", weight: "700", style: "normal" },
    { path: "./poppins-800.woff2", weight: "800", style: "normal" },
    { path: "./poppins-900.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-poppins",
  display: "swap",
});

export const montserrat = localFont({
  src: "./montserrat-latin.woff2",
  weight: "400 700",
  variable: "--font-montserrat",
  display: "swap",
});

// Geist Sans — the app's UI typeface (variable font, SIL OFL 1.1, from the `geist` package)
export const geist = localFont({
  src: "./geist-variable.woff2",
  weight: "100 900",
  variable: "--font-geist-sans",
  display: "swap",
});
