import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sceneApiPlugin } from "./server/sceneApiPlugin";

export default defineConfig({
  plugins: [react(), sceneApiPlugin()],
  server: {
    // ローカル専用ツール。LAN 公開しない
    host: "127.0.0.1",
  },
});
