import { container } from "#container";
import { config as loadEnvVariables } from 'dotenv';
import { asClass, asValue, Lifetime } from "awilix";
import { AppConfiguration, TAppConfiguration } from "#config/app.config";
import { HttpConfiguration } from "#config/http.config";
import { LoggerConfiguration } from "#config/logger.config";
import { HttpServer } from "#http/server";
import { WebsocketServer } from "#ws/server";
import { Logger } from "#logger";
import { autoloadHttpRoutes } from '#http/autoload_routes';
import { autoloadServices } from '#container/autoload_services';
import path from 'path';
import { fileURLToPath } from 'node:url';

// load .env file
loadEnvVariables();

process.setMaxListeners(40);

// register configurations
container.register({
  appConfiguration : asValue(AppConfiguration),
  httpConfiguration : asValue(HttpConfiguration),
  loggerConfiguration : asValue(LoggerConfiguration)
});

// register core features
container.register({
  httpServer : asClass(HttpServer, { lifetime : Lifetime.SINGLETON}),
  websocketServer : asClass(WebsocketServer, { lifetime : Lifetime.SINGLETON})
});

// start boot sequence 
spark();

// spark boot sequence
async function spark() {

  console.log(" 🔥 Spark!");

  // check if it is a development env
  const isDev = process.env.NODE_ENV === 'development';
  if(isDev) Logger.enableDevOutput();

  const appConfig = container.resolve<TAppConfiguration>('appConfiguration');

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
  http.listen({
    host: '127.0.0.1', 
    port : 4321
  });


}
