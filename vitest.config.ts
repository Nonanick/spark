import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: "#http", replacement: path.resolve(__dirname, "src", "core", "http") },
      { find: "#ws", replacement: path.resolve(__dirname, "src", "core", "websocket"), },
      { find: "#utils", replacement: path.resolve(__dirname, "src", "core", "utils"), },
      { find: "#config", replacement: path.resolve(__dirname, "src", "config"), },
      { find: "#models", replacement: path.resolve(__dirname, "src", "app", "models"), },
      { find: "#services", replacement: path.resolve(__dirname, "src", "app", "services"), },
      { find: "#common", replacement: path.resolve(__dirname, "src", "app", "common"), },
      { find: "#test", replacement: path.resolve(__dirname, "src", "test"), },
      { find: /#container\/(.*)$/, replacement: path.resolve(__dirname, "src", "core", "dependency_injection",'$1.ts'), },
      { find: "#container", replacement: path.resolve(__dirname, "src", "core", "dependency_injection", "container.ts"), },
      { find: "#logger", replacement: path.resolve(__dirname, "src", "core", "logger", "logger.ts"), },
    ]
  }
});