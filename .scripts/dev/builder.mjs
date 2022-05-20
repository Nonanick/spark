import { watch } from 'chokidar';
import path from 'path';
import { build } from 'esbuild';
import { promises as fs } from 'fs';
import EventEmitter from 'node:events';

const chalk = await import('chalk');
const colorize = new chalk.Chalk();

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
      ]).catch(err=> {
        console.warn(" ⚠️ Failed to remove file on unlink event", file);
      }).then(_ => {
        this.notify([full]);
      });
    });

    this.#fileWatcher.on('unlinkDir', (dirName) => {
      // remove both .js and .js.map
      let full = path.join(this.outputDirectory, dirName);
      return Promise.all([
        fs.rm(full, {recursive : true, force : true }),
      ]).catch(err=> {
        console.warn(" ⚠️ Failed to remove directory on unlink event", full);
      }).then(_ => {
        this.notify([full]);
      });
    });

    this.#fileWatcher.on('change', async (file) => {
      if (this.#mode === 'batch') {
        this.#files.push(file);
      } else {
        await this.build(file);
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
    this.emit('will-build');
    if (typeof file === 'string') {
      let result = await build({
        bundle: false,
        write: true,
        incremental: false,
        outfile: path.join(this.outputDirectory, file.replace(/\.ts$/, '.js')),
        platform: 'node',
        sourcemap: "linked",
        target: "esnext",
        ignoreAnnotations: true,
        watch: false,
        entryPoints: [path.join(this.projectRoot, file)],
      }).catch(err => {
        console.error("Failed to build file", err);
      }).then(r => {
        this.notify(Array.isArray(file) ? file : [file]);
      });
      return result;
    } else {
      let result = await build({
        absWorkingDir: path.join(this.projectRoot, '..'),
        bundle: false,
        write: true,
        incremental: false,
        sourceRoot: 'src',
        outdir: 'dist',
        platform: 'node',
        sourcemap: "linked",
        target: "esnext",
        ignoreAnnotations: true,
        watch: false,
        entryPoints: file,
      }).catch(err => {
        console.error("Failed to build files", err);
      }).then(r => {
        this.notify(Array.isArray(file) ? file : [file]);
      });
      return result;
    }

  }

  notify(filesChanged) {
    this.emit('build-finished', filesChanged);
  }

  async batch() {
    await this.build(this.#files);
  }

}