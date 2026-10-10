/** @type {import('tailwindcss').Config} */

// Figma "Basics" variable collection. Values live as CSS variables in src/styles.css so
// components and inline styles share one source; Tailwind only maps names onto them.
const scale = (name) =>
  Object.fromEntries(
    ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"].map((step) => [
      step,
      `rgb(var(--colors-${name}-${step}) / <alpha-value>)`,
    ]),
  );

const type = (size, lineHeight) => [`var(--type-size-${size})`, { lineHeight: `var(--type-line-${lineHeight})` }];

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        grey: scale("grey"),
        lime: scale("lime"),
        yellow: scale("yellow"),
        orange: scale("orange"),
        red: scale("red"),
        green: scale("green"),
      },
      fontFamily: {
        primary: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        secondary: ["'IBM Plex Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": type("2xs", "2xs"),
        xs: type("xs", "xs"),
        sm: type("sm", "sm"),
        paragraph: type("paragraph", "paragraph"),
        code: type("code", "code"),
        xl: type("xl", "xl"),
        "2xl": type("2xl", "2xl"),
        "3xl": type("3xl", "3xl"),
        "4xl": type("4xl", "4xl"),
        "5xl": type("5xl", "5xl"),
        "6xl": type("6xl", "6xl"),
      },
      borderRadius: {
        DEFAULT: "2px",
      },
      height: {
        dvh: "100dvh",
      },
    },
  },
  plugins: [],
};
