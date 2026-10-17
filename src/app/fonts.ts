import localFont from "next/font/local";

// Self-hosted so builds work offline (Docker, CI) and no font request leaves
// for a third party. Both families are licensed under the SIL Open Font License.

export const spectral = localFont({
  variable: "--font-spectral",
  display: "swap",
  src: [
    {
      path: "../fonts/spectral-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/spectral-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/spectral-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
});

// Atkinson Hyperlegible Next: designed by the Braille Institute for
// low-vision readers. Variable weight 200-800.
export const atkinson = localFont({
  variable: "--font-atkinson",
  display: "swap",
  src: [
    {
      path: "../fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2",
      weight: "200 800",
      style: "normal",
    },
    {
      path: "../fonts/atkinson-hyperlegible-next-latin-wght-italic.woff2",
      weight: "200 800",
      style: "italic",
    },
  ],
});
