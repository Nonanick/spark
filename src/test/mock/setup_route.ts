import { AppConfiguration, TAppConfiguration } from "#config/app.config";
import { HttpConfiguration } from "#config/http.config";
import { LoggerConfiguration } from "#config/logger.config";
import { container } from "#container";
import { controllerMatcher, convertFilenameToURLParameters, defaultRouteModuleLoader } from "#http/autoload_routes";
import { HttpServer } from "#http/server";
import { toResolver } from "#utils/to_resolver";
import { WebsocketServer } from "#ws/server";
import { asClass, asValue, Lifetime, Resolver } from "awilix";
import path from "node:path";
import type { Class, JsonValue } from "type-fest";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
import { defaultModuleLoader } from "#utils/module_loader";
import { HTTPController } from "#http/controller";
import { z } from "zod";
import type { HTTPRoute } from "#http/route";

export async function setupRouteTest(
  routeURL: string,
  config?: ISetupMockRouteConfig
) {

  // create a dependency injector for this test
  const testContainer = container.createScope();

  // register it as the container for classes that rely on it (should they?)
  testContainer.register({
    'container': asValue(testContainer)
  });

  // register configurations
  testContainer.register({
    httpConfiguration: asValue(HttpConfiguration),
    loggerConfiguration: asValue(LoggerConfiguration),
    appConfiguration: asValue(AppConfiguration)
  });

  // register servers
  testContainer.register({
    httpServer: asClass(HttpServer, { lifetime: Lifetime.SCOPED }),
    wsServer: asClass(WebsocketServer, { lifetime: Lifetime.SCOPED })
  });

  // allow overriding of what has been registered till now, except for the container itself
  if (config?.register != null) {
    for (let name in config.register) {
      if (![
        'httpConfiguration',
        'loggerConfiguration',
        'appConfiguration',
        'httpServer',
        'wsServer'
      ].includes(name)) {
        continue;
      }
      let toBeRegistered = config.register[name];
      testContainer.register(name, toResolver(toBeRegistered));
    }
  }

  // initialize httpServer
  const httpServer = testContainer.resolve<HttpServer>('httpServer');
  await httpServer.listen({
    host: '127.0.0.1',
    port: 9874
  });

  // initialize fetch api
  const client = (
    url: string,
    options?: Omit<RequestInit, "headers"> & { headers?: Record<string, string>; cookies?: Record<string, string>; }
  ) => {
    const fHeader = new Headers();
    if (options?.headers != null) {
      for (let headerName in options.headers) {
        fHeader.append(headerName, options.headers[headerName]);
      }
    }
    return fetch(path.posix.join('http://127.0.0.1:9874', url), {
      ...options,
      headers: fHeader
    });
  }
  // setup route (src):
  const projectPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..', // in "test"
    '..' // in "src"
  );

  const appConfig = testContainer.resolve<TAppConfiguration>('appConfiguration');
  const routeRootPath = path.join(
    projectPath,
    config?.routesRoot ?? appConfig.paths.routesRoot ?? 'app/routes'
  );
  const routePath = fileURLToPath(routeURL.replace(/\.(spec|test)\.ts/, '.ts'));
      // check the difference between route root and route url
  const routeServerURL = routePath.replace(routeRootPath, '');

  // 1. load exported route modules
  const routesFromFile = await defaultRouteModuleLoader(
    routePath
  );

  // 2. check for controllers in each directory
  const routeDir = path.dirname(routePath);

  await applyControllersToRoutes(
    routesFromFile,
    routeDir,
    routeRootPath
  );

  // 3. load route into server
  httpServer.addRoute(...routesFromFile);

  // replace registration in each handler container
  httpServer.handlers.forEach(h => {
    if (config?.register != null) {
      for (let name in config.register) {
        let toBeRegistered = config.register[name];
        h.injector.register(name, toResolver(toBeRegistered));
      }
    }
  });

  return {
    url : routeServerURL,
    httpServer,
    httpClient: client,
    async teardown() {
      httpServer.destroy();
    }
  };
}

interface ISetupMockRouteConfig {
  routesRoot?: string,
  register?: {
    [serviceName: string]: Class<any> | JsonValue | ((...args: any[]) => any) | Resolver<unknown>;
  };

}

async function applyControllersToRoutes(
  routes: HTTPRoute[],
  startLookingAt: string,
  stopLookingAt: string
) {

  let dir = startLookingAt;

  while (true) {
    if (stopLookingAt.length > dir.length) break;
    const isInRoot = dir.length === stopLookingAt.length;
    let currentDir = dir.split(path.sep).pop()!;
    let entries = await fs.readdir(dir, { withFileTypes: true });

    for (let entry of entries) {
      if (entry.isFile()) {
        if (entry.name.match(controllerMatcher) != null) {
          let loadedControllers = await defaultModuleLoader(
            `${dir}${path.sep}${entry.name}`,
            function (m: unknown): m is HTTPController { return m instanceof HTTPController },
          );
          loadedControllers.forEach(c => {
            routes.forEach(r => {
              c.applyToRoute(r);
            });
          });
        }
      }
    }
    dir = dir.split(path.sep).slice(0, -1).join(path.sep);
    if (isInRoot) {
      continue;
    }
    // transform directories into new ones
    let resolvedDirName = convertFilenameToURLParameters(currentDir);

    // if the directory contains an url parameter we need to add it to the schema!
    if (resolvedDirName != currentDir) {
      const addUrlParameterToSchemaController = new HTTPController<any, any, any, any, any>();
      addUrlParameterToSchemaController.urlParams = {};
      const findOptionalNamedParameters = currentDir.match(/\[_(.+)\]/g);
      const findRequiredNamedParameters = currentDir.replace(/\[_(.+)\]/g, '').match(/\[(.+)\]/g);

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

      routes.forEach(r => addUrlParameterToSchemaController.applyToRoute(r));
    }

    // append directory name
    routes.forEach(r => {
      r.url = r.url == null ? path.posix.join(resolvedDirName, '') : path.posix.join(resolvedDirName, r.url);
    });
  }
}