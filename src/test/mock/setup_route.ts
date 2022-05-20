import { AppConfiguration, TAppConfiguration } from "#config/app.config";
import { HttpConfiguration } from "#config/http.config";
import { LoggerConfiguration } from "#config/logger.config";
import { container } from "#container";
import { HttpServer } from "#http/server";
import { toResolver } from "#utils/to_resolver";
import { WebsocketServer } from "#ws/server";
import { asClass, asValue, Lifetime, Resolver } from "awilix";
import type { Class, JsonValue } from "type-fest";
import supertest from 'supertest';
import { fileURLToPath, pathToFileURL } from "url";
import path from "node:path";
import { defaultModuleLoader } from "#utils/module_loader";
import { HTTPRoute } from "#http/route";

export async function setupRouteTest(
  routeURL: string,
  config?: ISetupMockRouteConfig
) {

  // create a dependency injector for this test
  const testContainer = container.createScope();

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

  // allow overriding of what has been registered till now
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
  httpServer.setDependencyContainer(testContainer);

  // initialize supertest client
  const client = supertest(httpServer.raw);

  // setup route (src):
  const projectPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..' // in "src"
  );

  const appConfig = testContainer.resolve<TAppConfiguration>('appConfiguration');
  const routeRootPath = path.join(
    projectPath,
    config?.routesRoot ?? appConfig.paths.routesRoot ?? 'app/routes'
  );

  // check the difference ebtwen routes root and routeUrl
  const routePath = fileURLToPath(routeURL.replace(/\.(spec|test)\.ts/, '.ts'));
  const routeServerURL = routePath.replace(routeRootPath, '');


  // 1. load equivalent route
  const routesFromFile = await defaultModuleLoader(
    pathToFileURL(routePath).toString(),
    (m): m is HTTPRoute => (m instanceof HTTPRoute)
  );

  // 2. check for controllers in each directory
  const routeDir = path.dirname(routePath);
  let dir = routeDir;
  while(dir != '') {
    
  }
  // 3. apply controllers to route

  // 4. load route into server

  return {
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