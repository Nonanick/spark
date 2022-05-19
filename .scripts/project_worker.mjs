// @ts-check
import { fileURLToPath, pathToFileURL,} from 'node:url';
import { isMainThread, parentPort } from 'node:worker_threads';
import path from 'node:path';

if (isMainThread) {
  console.error("🚨 This script is meant to be run as a worker thread and will be terminated!");
  process.exit(1);
}

const rootPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const runRoot = path.join(rootPath, 'dist');

// normal invokation of server!
const server = await import(
  pathToFileURL(path.join(runRoot, 'main.js')).toString()
);

// check for "hot reload" messages
parentPort.on('message', (message) => {
  try {
    let parsed = JSON.parse(String(message));
    switch (parsed.type) {
      case 'route':
        console.log("Hot reload routes imported from", parsed.location);
        break;
      case 'controller':
        console.log("Hot reload all routes imported from", parsed.location);
        break;
      case 'service':
        console.log("Hot reload services imported from", parsed.location);
        break;
      default:
        console.error("Worker does not know how to handle this message type");
    }
  } catch (err) {
    console.error("Failed parsing message from main thread!");
  }
});