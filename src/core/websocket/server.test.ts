import { HTTPRoute } from '#http/route';
import { HttpServer } from '#http/server';
import { asClass, createContainer, InjectionMode, Lifetime } from 'awilix';
import { describe, expect, test } from 'vitest';

describe.concurrent("HTTP server", () => {
  
  const container = createContainer({ injectionMode : InjectionMode.CLASSIC});
  container.register({
    httpServer : asClass(HttpServer, { lifetime : Lifetime.TRANSIENT})
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