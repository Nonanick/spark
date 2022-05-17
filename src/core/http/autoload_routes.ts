import { defaultModuleLoader } from "#utils/module_loader";
import type { HTTPMethod } from "find-my-way";
import { promises as fs } from "node:fs";
import { platform } from "node:os";
import path from 'node:path';
import { HTTPController } from './controller.js';
import { HTTPRoute } from './route.js';

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
] as HTTPMethod[];

const routeMatcher = new RegExp(`(?<name>.+?)\\.(?<method>${[
  // route will be the "generic" route, no method inferred
  'route',
  // load all methods
  ...httpMethods
].map(m => m.toLocaleLowerCase()).join('|')
  })\\.(m|c)?js$` // load extensions .mts .cts .mjs .cjs .ts .js
);

// matches: "__controller.ext", "__ctrl.ext", "__interceptor.ext", just as named ones: "__auth.ctrl.ts"
const controllerMatcher = /__(?<name>.+?\.)?(controller|ctrl|interceptor|guard)\.(m|c)?(t|j)s$/;

export async function autoloadHttpRoutes(from: string, baseDir: string = '') {

  const currentDir = await fs.readdir(from, { withFileTypes: true });
  const allRoutes: HTTPRoute[] = [];
  const allControllers : HTTPController[] = [];

  for (let entry of currentDir) {
    if (entry.isDirectory()) {
      let loadedRoutes = await autoloadHttpRoutes(
        `${from}${path.sep}${entry.name}`,
        path.join(baseDir, entry.name)
      );
      // append directory name
      loadedRoutes.forEach(r => {
        r.url = r.url == null ? path.posix.join(entry.name,'') : path.posix.join(entry.name,r.url); 
      });

      allRoutes.push(...loadedRoutes);
    }

    if (entry.isFile()) {
      // check if it is a route
      let matchesRoute = entry.name.match(routeMatcher)
      if (matchesRoute != null) {
        const routeName = matchesRoute.groups!.name;
        const routeMethod = matchesRoute.groups!.method;

        let loadedRoutes = await defaultModuleLoader(
          `${from}${path.sep}${entry.name}`,
          function (m: unknown): m is HTTPRoute { return m instanceof HTTPRoute },
        );

        // update loaded routes parameters
        loadedRoutes.forEach(r => {
          r.method = r.method == null ? (routeMethod === 'route' ? 'get' : routeMethod as Lowercase<HTTPMethod>) : r.method;
          r.url = r.url == null ? (routeName === 'index' ? '' : routeName) : r.url
        });

        allRoutes.push(...loadedRoutes);
      }

      // chekc if it is a controller
      let matchesController = entry.name.match(controllerMatcher);
      if(matchesController != null) {
        let loadedControllers = await defaultModuleLoader(
          `${from}${path.sep}${entry.name}`,
          function (m: unknown): m is HTTPController { return m instanceof HTTPController },
        );
        allControllers.push(...loadedControllers);
      }
    }
  }

  for(let controller of allControllers) {
    controller.applyToRoute(...allRoutes);
  }
  return allRoutes;
}

