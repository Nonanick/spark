// @ts-check
import path from 'node:path';
import { ProjectBuilder } from './dev/builder.mjs';
import { ProjectRunner } from './dev/runner.mjs';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { format } from 'node:util';
import { ProjectOrchestrator } from './dev/orchestrator.mjs';
export { };

const chalk = await import('chalk');
const colorize = chalk.default;

const config = {
  paths: {
    projectRoot: 'src',
    buildOutput: 'dist'
  },
  entryFile: 'main.ts',
};

const print = process.stdout.write.bind(process.stdout);
const println = (data, ...objs) => print(String(data) + objs.map(o => format(o)).join(', ') + "\n");

println(
  colorize.bgWhite.black(
    " 🔥 SPARK  "
  )
  + " - Development\n"
  + '_'.repeat(process.stdout.columns)
);


const projectRoot = findProjectRoot(config.paths.projectRoot);
const devOutput = path.join(projectRoot, '..', config.paths.buildOutput);

// cleanup project
await fs.rm(devOutput, { recursive: true, force: true })
  .catch(err => {
    println("| > failed to cleanup development output!", err);
  }).then(async _ => {
    println(`| > Cleanup: ${colorize.italic.gray(devOutput)} ✅ OK`);
    await fs.mkdir(devOutput, { recursive: true })
  });

// start builder
const builder = new ProjectBuilder(projectRoot, devOutput);

// spawn a worker thread
const runner = new ProjectRunner();

const orchestrator = new ProjectOrchestrator(builder, runner);

builder.once('ready', () => {
  println(`| > Launching: ${colorize.italic.gray(`src${path.sep}main.ts`)} ✅ OK`);
  println('-'.repeat(process.stdout.columns));

});

// create a noEmit tsc compiler for errors display
function findProjectRoot(projectRoot) {
  const thisPath = path.dirname(fileURLToPath(import.meta.url));
  return path.join(thisPath, '..', projectRoot);
}