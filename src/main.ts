import { container } from "#container";
import { config as loadEnvVariables } from 'dotenv';
import { asClass, asValue, Lifetime } from "awilix";
import { AppConfiguration, TAppConfiguration } from "#config/app.config";
import { HttpConfiguration, THttpConfiguration } from "#config/http.config";
import { LoggerConfiguration } from "#config/logger.config";
import { HttpServer } from "#http/server";
import { WebsocketServer } from "#ws/server";
import { Logger } from "#logger";
import { autoloadHttpRoutes } from '#http/autoload_routes';
import { autoloadServices } from '#container/autoload_services';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// load .env file
loadEnvVariables();

// register configurations
container.register({
  container: asValue(container),
  appConfiguration: asValue(AppConfiguration),
  httpConfiguration: asValue(HttpConfiguration),
  loggerConfiguration: asValue(LoggerConfiguration)
});

// register core features
container.register({
  httpServer: asClass(HttpServer, { lifetime: Lifetime.SINGLETON }),
  websocketServer: asClass(WebsocketServer, { lifetime: Lifetime.SINGLETON })
});

// start boot sequence 
export default spark();

// spark boot sequence
async function spark() {

  // check if it is a development env
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) Logger.enableDevOutput();

  const appLogger = new Logger("App", container);

  appLogger.dev(" 🔥 Spark! Starting servers...\n    ----------------------------- ");

  const appConfig = container.resolve<TAppConfiguration>('appConfiguration');
  const httpConfig = container.resolve<THttpConfiguration>('httpConfiguration');

  // resolve paths
  const appRoot = path.dirname(fileURLToPath(import.meta.url));
  const servicesRoot = `${appRoot}${path.sep}${path.normalize(appConfig.paths.servicesRoot)}`;
  const routesRoot = `${appRoot}${path.sep}${path.normalize(appConfig.paths.routesRoot)}`;

  // autoload services
  await autoloadServices(
    container,
    servicesRoot,
  );

  // create http server
  const http = container.resolve<HttpServer>('httpServer');

  // autoload http routes
  const routes = await autoloadHttpRoutes(
    routesRoot
  );

  http.addRoute(...routes);

  // launch servers
  await http.listen({
    host: httpConfig.server.host,
    port: httpConfig.server.port
  });
  appLogger.dev("    -----------------------------");
  appLogger.dev(`🌎 HTTP server is listening at http://${httpConfig.server.host}:${httpConfig.server.port}!`);
  appLogger.dev(`📰 Currently serving ${http.routes.length} routes!`);
  appLogger.dev(`💹 Using ${Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100} MB (${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB of heap used)`,)

  return {
    http
  };
}
