import { EventEmitter } from 'events';
import path from 'path';
import { stdout } from 'process';
import { platform } from 'node:os';

class Builder extends EventEmitter {

}

class Checker extends EventEmitter {

}

class Runner extends EventEmitter {

}

class Cache {

}

// @ts-check
export { };

const chalk = await import('chalk');
const colorize = chalk.default;
const config = {
  paths: {
    projectRoot: 'src'
  },
  entryFile: 'main.ts',
};

const projectRoot = findProjectRoot(config.paths.projectRoot);
const print = process.stdout.write.bind(stdout);
const println = (data) => print(String(data) + "\n");

println(
  colorize.bgWhite.black(
    " 🔥 SPARK  "
  )
  + " - Development\n"
  + "_________________________"
);


// start builder
println(colorize.gray(`|>  launching ${config.paths.projectRoot}${path.sep}${config.entryFile}`));
const builder = new Builder(projectRoot);

// create a noEmit tsc compiler for errors display

// spawn a worker thread


function findProjectRoot(projectRoot) {
  const thisPath = normalizePath(import.meta.url);
  return path.join(thisPath, '..', projectRoot);
}

function normalizePath(p) {
  if (platform() === 'win32') {
    return path.win32.normalize(p).replace(/file:\\(\D)\:/, '').replace(/\\/g, '/');
  } else {
    return path.normalize(p);
  }
}