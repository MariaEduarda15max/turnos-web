/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Paleta propia: verde bosque oscuro (calma, confianza) + acento
        // cálido para acciones — no el azul/violeta genérico de SaaS.
        bosque: {
          50: "#f2f6f3",
          100: "#dfe9e1",
          400: "#4a7a5d",
          600: "#2f4f3f",
          800: "#1a2e24",
          900: "#101f19",
        },
        arcilla: {
          400: "#d98a4f",
          500: "#c4763c",
          600: "#a86230",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
    },
  },
  plugins: [],
};
