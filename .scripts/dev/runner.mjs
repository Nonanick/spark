// @ts-check
import EventEmitter from "node:events";
import { Worker } from "node:worker_threads";
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from "node:url";

export class ProjectRunner extends EventEmitter {
  
  workerPath = '';

  /**
   * @type {Worker}
   */
  #worker;

  constructor() {
    super();
  }

  start() {
    if(this.#worker != null) {
      this.#worker.terminate();
    }

    this.workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)),'..','project_worker.mjs');
    this.#worker = new Worker(this.workerPath);
    this.#worker.on('error', (err) => {
      console.log("Runner encountered and error!", err);
    });
    this.#worker.on("exit", this.autoRespawn);
  }

  autoRespawn() {
    this.#worker = null;
    this.start();
  }

  terminate() {
    if(this.#worker != null) {
      this.#worker.off('exit', this.autoRespawn);
      this.#worker.terminate();
    }
  }

  respawn() {
    this.terminate();
    this.start();
  }

  reloadRoutesFrom(location) {
    if(this.#worker != null) {
      this.#worker.postMessage(JSON.stringify({
        type : 'route',
        location
      }));
    }
  }

  reloadControllersFrom(location) {
    if(this.#worker != null) {
      this.#worker.postMessage(JSON.stringify({
        type : 'controller',
        location
      }));
    }
  }

  reloadServicesFrom(location) {
    if(this.#worker != null) {
      this.#worker.postMessage(JSON.stringify({
        type : 'service',
        location
      }));
    }
  }


}