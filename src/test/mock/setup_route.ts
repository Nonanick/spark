import { AppConfiguration } from "#config/app.config";
import { HttpConfiguration } from "#config/http.config";
import { LoggerConfiguration } from "#config/logger.config";
import { container } from "#container";
import { HttpServer } from "#http/server";
import { toResolver } from "#utils/to_resolver";
import { WebsocketServer } from "#ws/server";
import { asClass, asValue, Lifetime } from "awilix";
import type { Class, JsonValue } from "type-fest";

export async function setupRouteTest(
  routeURL: string,
  config?: ISetupMockRouteConfig
) {
  // create a dependency injector for this test
  const testContainer = container.createScope();

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

  // setup route

  return {
    httpServer,
    async teardown() {
      httpServer.destroy();
    }
  };
}

interface ISetupMockRouteConfig {
  routesRoot?: string,
  servicesRoot?: string,
  autoloadServices?: boolean,
  register?: {
    [serviceName: string]: Class<any> | JsonValue | ((...args: any[]) => any);
  };

}