import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve : {
    alias : {
      "#http" : path.resolve(__dirname, "src", "core", "http")
    }
  }
});