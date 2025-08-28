import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#145A32", // Verde Esmeralda Oscuro - para botones principales
          foreground: "#ffffff",
          50: "#f0f9f4",
          100: "#dcf2e3",
          200: "#bce5ca",
          300: "#8dd1a7",
          400: "#57b67d",
          500: "#339b5b",
          600: "#257d47",
          700: "#1f653a",
          800: "#145A32", // Verde Esmeralda Oscuro
          900: "#0F3D2E", // Verde Pino Profundo
        },
        secondary: {
          DEFAULT: "#EAE3D2", // Beige Arena Suave
          foreground: "#2C2C2C", // Gris Grafito
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "#f5f3f0", // Beige más claro
          foreground: "#6b6b6b", // Gris medio
        },
        accent: {
          DEFAULT: "#C2A878", // Dorado Suave
          foreground: "#2C2C2C", // Gris Grafito
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Paleta Business elegante + Eco-friendly
        pine: {
          DEFAULT: "#0F3D2E", // Verde Pino Profundo
          50: "#f0f7f4",
          100: "#dcede3",
          200: "#bcdcc9",
          300: "#8fc4a6",
          400: "#5da67e",
          500: "#3d8b60",
          600: "#2d6e4a",
          700: "#25583c",
          800: "#1f4631",
          900: "#0F3D2E",
        },
        emerald: {
          DEFAULT: "#145A32", // Verde Esmeralda Oscuro
          50: "#f0f9f4",
          100: "#dcf2e3",
          200: "#bce5ca",
          300: "#8dd1a7",
          400: "#57b67d",
          500: "#339b5b",
          600: "#257d47",
          700: "#1f653a",
          800: "#145A32",
          900: "#0f4428",
        },
        graphite: {
          DEFAULT: "#2C2C2C", // Gris Grafito
          50: "#f8f8f8",
          100: "#f0f0f0",
          200: "#e4e4e4",
          300: "#d1d1d1",
          400: "#b4b4b4",
          500: "#9a9a9a",
          600: "#818181",
          700: "#6a6a6a",
          800: "#5a5a5a",
          900: "#2C2C2C",
        },
        sand: {
          DEFAULT: "#EAE3D2", // Beige Arena Suave
          50: "#faf9f7",
          100: "#f5f3f0",
          200: "#EAE3D2",
          300: "#ddd4c0",
          400: "#cfc3a8",
          500: "#c2b394",
          600: "#b5a485",
          700: "#a08e73",
          800: "#857760",
          900: "#6d624f",
        },
        gold: {
          DEFAULT: "#C2A878", // Dorado Suave
          50: "#faf8f4",
          100: "#f4f0e8",
          200: "#e8dcc8",
          300: "#dbc8a8",
          400: "#ceb488",
          500: "#C2A878",
          600: "#b59a6a",
          700: "#a08659",
          800: "#8a7249",
          900: "#735e3a",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
