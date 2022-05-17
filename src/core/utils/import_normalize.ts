import path from "node:path";
import { fileURLToPath } from "url";

export function getDirnameFromUrl(importUrl : string) {
  return path.dirname(fileURLToPath(importUrl));
}