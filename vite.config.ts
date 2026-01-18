import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mapbox: ["mapbox-gl"],
          react: ["react", "react-dom"],
        },
      },
    },
  },
});
