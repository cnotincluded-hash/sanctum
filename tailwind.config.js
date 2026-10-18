/** @type {import('tailwindcss').Config} */

// The amber and violet classes (text-amber-400, border-violet-400/25, …) follow
// the chosen theme. Each shade reads a CSS variable that themeCssVars() in
// src/App.tsx sets; in the Amethyst theme they equal Tailwind's own colours.
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const themed = (name) =>
  Object.fromEntries(SHADES.map((shade) => [shade, `hsl(var(--th-${name}-${shade}) / <alpha-value>)`]));

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        amber: themed("amber"),
        violet: themed("violet"),
      },
    },
  },
  plugins: [],
};
