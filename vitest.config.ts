import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve : {
    alias : {
      "#http/*" : path.resolve(__dirname, "src", "core", "http"),
      "#ws/*" : path.resolve(__dirname, "src", "core", "websocket"),
      "#util/*" : path.resolve(__dirname, "src", "core", "utils"),
      "#config/*" : path.resolve(__dirname, "src", "config"),
      "#models/*" : path.resolve(__dirname, "src", "app", "models"),
      "#services/*" : path.resolve(__dirname, "src", "app", "services"),
      "#common/*" : path.resolve(__dirname, "src", "app", "common"),
      "#container/*" : path.resolve(__dirname, "src", "core", "dependency_injection"),
      "#container" : path.resolve(__dirname, "src", "core", "dependency_injection", "container.ts"),
      "#logger" : path.resolve(__dirname, "src", "core", "logger", "logger.ts"),
    }
  }
});