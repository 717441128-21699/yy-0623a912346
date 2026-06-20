/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        dark: {
          primary: '#1a1a2e',
          secondary: '#16213e',
          card: '#1e2a4a',
          hover: '#253355',
        },
        accent: {
          red: '#e94560',
          blue: '#0f3460',
          green: '#16c79a',
          orange: '#f5a623',
        },
        txt: {
          primary: '#e8e8e8',
          secondary: '#a0a8c0',
          muted: '#6b7394',
        },
        border: {
          dark: '#2a3a5c',
        },
      },
    },
  },
  plugins: [],
};
