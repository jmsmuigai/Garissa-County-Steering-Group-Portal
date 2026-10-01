/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        garissa: {
          red: '#d32f2f', // Bright red for boundaries and alerts
          earth: '#8d6e63', // Earthy tone for land/nature
          sand: '#f4a460', // Sandy tone
          water: '#1976d2', // Deep blue for Tana River
          dark: '#1e1e1e', // Dark mode background
          light: '#f5f5f5', // Light mode background
        }
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
