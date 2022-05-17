//@ts-check
import { watch } from 'chokidar';
import path from 'path';
import { build } from 'esbuild';
import { promises as fs } from 'fs';
import EventEmitter from 'node:events';

const chalk = await import('chalk');
const colorize  =new chalk.Chalk();

export class ProjectBuilder extends EventEmitter {

  projectRoot = '';

  outputDirectory = '';

  #fileWatcher;

  #files = [];

  #mode = 'batch';

  constructor(root, outDir) {
    super();
    let start = performance.now();
    this.once('ready', (files) => {
      console.log(`| > Build: ${colorize.gray(`Initial build of ${files.length} files took ${(performance.now() - start).toFixed(2)}ms`)} ✅ OK`)
    });
    this.projectRoot = root;
    this.outputDirectory = outDir;
    this.#fileWatcher = watch('**/*.ts', { cwd: root, disableGlobbing: false, });

    this.#fileWatcher.on('add', (file) => {
      if (this.#mode === 'batch') {
        this.#files.push(file);
      } else {
        this.build(file);
      }
    });

    this.#fileWatcher.on('unlink', (file) => {
      // remove both .js and .js.map
      let full = path.join(this.outputDirectory, file);
      let fullJs = full.replace(/\.ts$/, '.js');
      let fullJsMap = full.replace(/\.ts$/, '.js.map');
      return Promise.all([
        fs.unlink(fullJs),
        fs.unlink(fullJsMap),
      ]).then(_ => {
        this.notify([full]);
      });
    });

    this.#fileWatcher.on('change', (file) => {
      if (this.#mode === 'batch') {
        this.#files.push(file);
      } else {
        this.build(file);
      }
    });

    this.#fileWatcher.on('ready', () => {
      this.once('build-finished', (files) => {
        this.emit('ready', files);
      });
      this.build(this.#files);
      this.#mode = 'single';
      this.#files = [];
    });

  }

  async build(file) {
    let result = await build({
      bundle: false,
      write: true,
      incremental: false,
      outdir: this.outputDirectory,
      platform: 'node',
      sourcemap: "linked",
      sourceRoot: this.projectRoot,
      target: "ES2022",
      ignoreAnnotations: true,
      entryPoints: Array.isArray(file) ? file : [file],
    }).catch(err => {
      console.error("Failed to build files", err);
    }).then(_ => {
      this.notify(Array.isArray(file) ? file : [file]);
    });

    return result;
  }

  notify(filesChanged) {
    this.emit('build-finished', filesChanged);
  }

  async batch() {
    await this.build(this.#files);
  }

}