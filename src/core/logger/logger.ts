import type { TLoggerConfiguration } from "#config/logger.config";
import { container as rootContainer } from "#container";
import type { AwilixContainer } from "awilix";
import { Chalk, type ChalkInstance } from 'chalk';
import pino from "pino";

let p: pino.Logger;

export function getPino(container? : AwilixContainer) {
  if (p == null) {
    const config = (container ?? rootContainer).resolve<TLoggerConfiguration>('loggerConfiguration');
    const loggerTransports = pino.transport(config);
    p = pino(loggerTransports);
  }
  return p;
}

export class Logger {

  private static devOutput: boolean = false;

  static enableDevOutput() {
    Logger.devOutput = true;
  }

  static disableDevOutpu() {
    Logger.devOutput = false;
  }

  #color!: ChalkInstance;

  private get color() {
    if (this.#color == null) {
      this.#color = new Chalk();
    }
    return this.#color!;
  }

  #pino: pino.Logger;

  #container : AwilixContainer;

  constructor(private name: string, container? : AwilixContainer) {
    this.#pino = getPino(container);
    this.#container = container ?? rootContainer;

  }

  log(msg: string, ...objs: unknown[]) {
    this.#pino.info(
      `[${this.color.bold(this.name)}] ${msg}`,
      ...objs
    );

    if (Logger.devOutput) {
      this.dev(
        `[${this.color.bold(this.name)}] (${this.displayTime()}) 📰 ${this.color.blue.bold('INFO')}\n| ${msg}`,
        ...objs
      );
    }
  }

  info(msg: string, ...objs: unknown[]) {
    this.log(msg, ...objs);
  }

  warn(msg: string, ...objs: unknown[]) {
    this.#pino.warn(
      `[${this.color.bold(this.name)}] ${msg}`,
      ...objs
    );

    this.dev(
      `[${this.color.bold(this.name)}] (${this.displayTime()}) ⚠️ ${this.color.yellow.bold('WARN')}\n| ${msg}`,
      ...objs
    );
  }

  error(msg: string, ...objs: unknown[]) {
    this.#pino.warn(
      `[${this.color.bold(this.name)}] ${msg}`,
      ...objs
    );

    this.dev(
      `[${this.color.bold(this.name)}] (${this.displayTime()}) 🚨 ${this.color.red.bold('ERROR')}\n| ${msg}`,
      ...objs
    );
  }

  fatal(msg: string, ...objs: unknown[]) {
    this.#pino.fatal(
      `[${this.color.bold(this.name)}] ${msg}`,
      ...objs
    );

    this.dev(
      `[${this.color.bold(this.name)}] (${this.displayTime()}) 🧟 ${this.color.red.bold('FATAL')}\n| ${msg}`,
      ...objs
    );
  }

  dev(msg: string, ...objs: unknown[]) {
    if (colorizer == null) colorizer = new Chalk();

    if (Logger.devOutput) {
      process.stdout.write( colorizer!.bold(msg) + '\n');
      objs.forEach(o => {
        let out = prettyPrintJson(o);
        if (process.stdout.columns ?? 100 > inlineOutput(out).length) {
          process.stdout.write('| - ' + inlineOutput(out));
        } else {
          process.stdout.write(out);
        }
        process.stdout.write('\n');
      });
    }
  }

  private displayTime() {
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${now.getMilliseconds()}`
    return nowTime;
  }
}

function inlineOutput(out : string) {
  return out.replace(/\n/gm, '').replace(/\s+/gm, ' ').replace(/(\[|{)\s+/gm, '$1')
}
let colorizer: ChalkInstance | undefined;

export function prettyPrintJson(value: any, depth = 0, inline = false) {
  let outBuffer: string = '';

  const print = (str: string) => {
    outBuffer += str;
    return outBuffer;
  };

  if (depth > 10) {
    return outBuffer;
  }

  if (colorizer == null) colorizer = new Chalk();

  const str = colorizer.green;
  const sym = colorizer.yellow;
  const num = colorizer.magenta;
  const date = (d: Date) => {
    return print(
      colorizer!.bold.red("Date(")
      + colorizer!.whiteBright('"' + d.toString() + '"')
      + colorizer!.bold.red(")")
    );
  };

  // TODO: colorize functions, arrays, classes and so on
  const arr = (arr: unknown[]) => {
    const jumpWhen = 5;
    print(colorizer!.yellow('[ '));
    const multilinePrint = arr.length >= jumpWhen;
    multilinePrint && print('\n');

    arr.forEach((v, i) => {
      const shouldJump = i % jumpWhen === jumpWhen - 1;
      const justJumped = i % jumpWhen === 0;

      multilinePrint && justJumped && print(" ".repeat((1 + depth) * 2));
      print(prettyPrintJson(v, depth + 1, true));
      print(', ');
      multilinePrint && shouldJump && print("\n");
    });
    multilinePrint && print('\n' + " ".repeat(depth * 2))
    return print(colorizer!.yellow(']'));
  };

  const obj = (obj: Record<string | number | symbol, unknown>, depth = 0) => {
    print(colorizer!.blue('{ '));
    inline || print('\n');

    // print regular keys
    Object.entries(obj).forEach(([k, v]) => {
      // print tab
      inline || print(" ".repeat(2 * (depth + 1)));
      // print key
      print(typeof k === 'number' ? `${colorizer!.bold(k)}: ` : `"${k}": `);
      // print value
      print(prettyPrintJson(v, depth + 1, inline));
      print(', ');
      // jump a line
      inline || print('\n');
    });

    // print symbol keys
    Object.getOwnPropertySymbols(obj).forEach(s => {
      const v = obj[s];
      // print tab
      inline || print(" ".repeat(2 * (depth + 1)));
      // print key
      print(`[${sym(s.description)}(symbol)]: `);
      // print value
      print(prettyPrintJson(v, depth + 1, inline));
      // jump a line
      print(',\n');
    });
    // print tab
    inline || print(" ".repeat(2 * depth));
    return print(colorizer!.blue('}'));
  }

  // TODO: pretty print function signature
  const fun = (str: string) => {
    return print(str + '\n');
  };

  // TODO: detect and pretty print class signatures
  const clas = (str: string) => {
  };

  if (typeof value === 'string') {
    if (depth === 0) return print(value);
    return print('"' + str(value) + '"');
  }

  if (typeof value === 'number') {
    return print(num(value));
  }

  if (value === undefined) {
    return print(num("undefined"));
  }

  if (value === null) {
    return print(num("undefined"));
  }

  if (typeof value === 'object') {
    // is array?
    if (Array.isArray(value)) {
      return arr(value);
    }

    // is date°
    if (value instanceof Date) {
      return date(value)
    }

    return obj(value, depth);
  }

  if (typeof value === 'function') {
    return fun(value.toString());
  }

  if (typeof value === 'boolean') {
    return print(colorizer!.cyan(value ? 'true' : 'false'));
  }

  if (typeof value === 'symbol') {
    return print(`[${sym(value.description)}(symbol)]`);
  }

  return outBuffer;

}
