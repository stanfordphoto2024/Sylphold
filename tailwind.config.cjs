module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0B",
        "muted-coral": "#FF7F50",
      },
      fontFamily: {
        sans: ["system-ui", "ui-sans-serif", "SF Pro Text", "Inter", "sans-serif"],
      },
      boxShadow: {
        glass: "0 0 40px rgba(0,0,0,0.7)",
      },
    },
  },
  plugins: [],
};

