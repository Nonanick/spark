// @ts-check
import path from 'node:path';

const isInAppRoute = /^app\\routes\\.+$/;

const controllerMatcher = /__(?<name>.+?\.)?(controller|ctrl|interceptor|guard)\.(m|c)?(t|j)s$/;

const chalk = await import('chalk');
const colorize = new chalk.Chalk();

const httpMethods = [
  "ACL",
  "BIND",
  'CHECKOUT',
  'CONNECT',
  'COPY',
  'DELETE',
  'GET',
  'HEAD',
  'LINK',
  'LOCK',
  'M-SEARCH',
  'MERGE',
  'MKACTIVITY',
  'MKCALENDAR',
  'MKCOL',
  'MOVE',
  'NOTIFY',
  'OPTIONS',
  'PATCH',
  'POST',
  'PROPFIND',
  'PROPPATCH',
  'PURGE',
  'PUT',
  "REBIND",
  "REPORT",
  "SEARCH",
  "SOURCE",
  "SUBSCRIBE",
  "TRACE",
  "UNBIND",
  "UNLINK",
  "UNLOCK",
  "UNSUBSCRIBE"
];

const routeMatcher = new RegExp(`(?<name>.+?)\\.(?<method>${[
  // route will be the "generic" route, no method inferred
  'route',
  // load all methods
  ...httpMethods
].map(m => m.toLocaleLowerCase()).join('|')
  })\\.(m|c)?js$` // load extensions .mts .cts .mjs .cjs .ts .js
);

const serviceMatcher = /(?<name>.+)\.service\.(m|c)?js$/;


export class ProjectOrchestrator {

  builder;
  runner;

  constructor(builder, runner) {

    this.builder = builder;
    this.runner = runner;

    builder.once('ready', () => {

      runner.start();

      builder.on('build-finished', (filesBuilt) => {
        console.log('_'.repeat(process.stdout.columns));
        console.log(`| ${colorize.blue.bold("[ INFO ]")} 📰 Respawning thread!\n| File(s) ${filesBuilt.map(f => `"${f}'`).join(', ')} changed!`);
        console.log('-'.repeat(process.stdout.columns) + '\n');
        runner.respawn();
        return;

      });

    });
  }
}