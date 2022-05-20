import { defaultModuleLoader } from "#utils/module_loader";
import type { HTTPMethod } from "find-my-way";
import { promises as fs } from "node:fs";
import path from 'node:path';
import { pathToFileURL } from "node:url";
import { z } from "zod";
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
  const allControllers: HTTPController[] = [];

  for (let entry of currentDir) {
    if (entry.isDirectory()) {
      let loadedRoutes = await autoloadHttpRoutes(
        `${from}${path.sep}${entry.name}`,
        path.join(baseDir, entry.name)
      );

      // transform directories into new ones
      let resolvedDirName = convertFilenameToURLParameters(entry.name);

      // if the directory contains an url parameter we need to add it to the schema!
      if (resolvedDirName != entry.name) {
        const addUrlParameterToSchemaController = new HTTPController<any, any, any, any, any>();
        addUrlParameterToSchemaController.urlParams = {};
        const findOptionalNamedParameters = entry.name.match(/\[_(.+)\]/g);
        const findRequiredNamedParameters = entry.name.replace(/\[_(.+)\]/g, '').match(/\[(.+)\]/g);
        
        if (findOptionalNamedParameters != null) {
          findOptionalNamedParameters.forEach(n => {
            n = n.replace(/\[_(.+)\]/, '$1');
            addUrlParameterToSchemaController.urlParams![n] = z.string().optional();
          })
        }

        if (findRequiredNamedParameters != null) {
          findRequiredNamedParameters.forEach(n => {
            n = n.replace(/\[(.+)\]/, '$1');
            addUrlParameterToSchemaController.urlParams![n] = z.string();
          })
        }

        allControllers.push(addUrlParameterToSchemaController);
      }
      // append directory name
      loadedRoutes.forEach(r => {
        r.url = r.url == null ? path.posix.join(resolvedDirName, '') : path.posix.join(resolvedDirName, r.url);
      });

      allRoutes.push(...loadedRoutes);
    }

    if (entry.isFile()) {
      // check if it is a route
      let matchesRoute = entry.name.match(routeMatcher)
      if (matchesRoute != null) {
        let loadedRoutes = await defaultRouteModuleLoader(
          `${from}${path.sep}${entry.name}`,
        );
        allRoutes.push(...loadedRoutes);
      }

      // chekc if it is a controller
      let matchesController = entry.name.match(controllerMatcher);
      if (matchesController != null) {
        let loadedControllers = await defaultModuleLoader(
          `${from}${path.sep}${entry.name}`,
          function (m: unknown): m is HTTPController { return m instanceof HTTPController },
        );
        allControllers.push(...loadedControllers);
      }
    }
  }

  for (let controller of allControllers) {
    controller.applyToRoute(...allRoutes);
  }
  return allRoutes;
}

export async function defaultRouteModuleLoader(
  filepath: string
) {

  const fileURL = pathToFileURL(filepath);
  const filename = path.basename(filepath);
  let { name, method } = filename.match(routeMatcher)!.groups!;
  // replace [] with named params
  name = convertFilenameToURLParameters(name);

  // check if importing a directory
  const statFromFilepath = await fs.stat(filepath);
  if (statFromFilepath.isDirectory()) {
    filepath = `${filepath}${path.sep}index.js`;
  }

  return import(fileURL.toString())
    .then(exportedModules => {
      let allMatchedModules: HTTPRoute[] = [];
      for (let namedExport in exportedModules) {
        let exportedModule = exportedModules[namedExport];
        // Fix "default" import
        if (namedExport === 'default' && exportedModule != null && exportedModule.default != null) exportedModule = exportedModule.default;

        if (exportedModule instanceof HTTPRoute) {
          allMatchedModules.push(exportedModule);
        }
      }

      allMatchedModules.forEach(r => {
        r.method = r.method == null ? (method === 'route' ? 'get' : method as Lowercase<HTTPMethod>) : r.method;
        r.url = r.url == null ? (name === 'index' ? '' : name) : r.url
      });

      return allMatchedModules;
    });
}

export function convertFilenameToURLParameters(name: string) {
  return name
    .replace(/\[_(.+)\]/g, ':$1?') // replace [_urlParams] into {:urlParams}? (optional)
    .replace(/\[(.+)\]/g, ':$1'); // replace [urlParams] into {:urlParams}
}
