/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
    "./store/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        border: "rgba(255, 255, 255, 0.08)",
        input: "rgba(255, 255, 255, 0.05)",
        background: "#08070d",
        foreground: "#f3f4f6",
        primary: {
          DEFAULT: "#6366f1", // Sleek Indigo
          hover: "#4f46e5",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#1e1b4b", // Deep Indigo/Dark Blue
          foreground: "#e0e7ff",
        },
        dark: {
          DEFAULT: "#0f0e17",
          card: "#141320",
          border: "#1f1d2f",
        },
        accent: {
          DEFAULT: "#f43f5e", // Crimson accent
          hover: "#e11d48",
          purple: "#a855f7",
          cyan: "#06b6d4",
        },
        muted: {
          DEFAULT: "#9ca3af",
          foreground: "#6b7280",
        }
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(31, 38, 135, 0.37)",
        glow: "0 0 15px rgba(99, 102, 241, 0.5)",
      },
      backdropFilter: {
        glass: "blur(12px)",
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glow 3s infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
