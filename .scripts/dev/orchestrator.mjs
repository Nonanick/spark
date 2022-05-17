// @ts-check
import path from 'node:path';

const isInAppRoute = /^app\\routes\\.+$/;

const controllerMatcher = /__(?<name>.+?\.)?(controller|ctrl|interceptor|guard)\.(m|c)?(t|j)s$/;

const chalk = await import('chalk');
const colorize  =new chalk.Chalk();

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
        let shouldRespawn = false;
        for (let file of filesBuilt) {
          let normalizedPath = file.replace(/\\/, path.sep);

          // try to match the modified file!
          if (normalizedPath.match(isInAppRoute) != null) {
            // TODO: send hot reload message for routes affected by this

            // is it a controller?
            if (normalizedPath.match(controllerMatcher) != null) {
              // the whole directory / subdirectories need to be reloaded!
              runner.reloadControllersFrom(path.dirname(normalizedPath));
            }

            // is it a route?
            if(normalizedPath.match(routeMatcher) != null) {
              runner.reloadRoutesFrom(normalizedPath);
            }
            continue;
          }

          if(normalizedPath.match(serviceMatcher) != null) {
            runner.reloadServicesFrom(normalizedPath);
          }

          // if the file cannot be hot reloaded, respawn the worker thread
          shouldRespawn = true;
        };

        if (shouldRespawn) {
          console.log('_'.repeat(process.stdout.columns));
          console.log(`| ${colorize.blue.bold("[ INFO ]")} 📰 Respawning thread!\n| File(s) ${filesBuilt.map(f => `"${f}'`).join(', ')} changed!\n| At least one of these cannot be hot reloaded!`);
          console.log('-'.repeat(process.stdout.columns) + '\n');
          runner.respawn();
          return;
        }


      });

    });
  }
}