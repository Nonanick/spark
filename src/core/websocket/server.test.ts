import { HttpConfiguration } from '#config/http.config';
import { LoggerConfiguration } from '#config/logger.config';
import { container } from '#container';
import { HTTPRoute } from '#http/route';
import { HttpServer } from '#http/server';
import { asClass, asValue, Lifetime } from 'awilix';
import { beforeAll, describe, expect, test } from 'vitest';

describe.concurrent("HTTP server", () => {
  
  beforeAll(() => {
    container.register({
      httpConfiguration: asValue(HttpConfiguration),
      loggerConfiguration: asValue(LoggerConfiguration),
    });
    container.register({
      httpServer: asClass(HttpServer, { lifetime: Lifetime.TRANSIENT })
    });
  });
  test("server creation", () => {
    const server = container.resolve<HttpServer>('httpServer');
    expect(server).toBeInstanceOf(HttpServer);
  });

  test("adding routes", () => {
    const server = container.resolve<HttpServer>('httpServer');

    const route = new HTTPRoute();
    route.method = 'get';
    route.url = '';
    server.addRoute(route);

    expect(server.routes).toHaveLength(1);

    const addedRoute = server.routes[0];
    expect(addedRoute).toBe(route);
  });
});