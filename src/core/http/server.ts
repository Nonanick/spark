import type { THttpConfiguration } from "#config/http.config";
import { container as rootContainer } from "#container";
import { Logger } from "#logger";
import type { AwilixContainer } from "awilix";
import createRouter, { type HTTPMethod } from 'find-my-way';
import { createServer, type Server } from 'node:http';
import { createServer as createSSLServer, type Server as SSLServer } from 'node:https';
import { HTTPHandler } from "./handler.js";
import type { HTTPRoute } from "./route.js";

type TListenOptions = {
  host: string;
  port: number;
};

export class HttpServer {

  #routes: HTTPRoute[] = [];

  #handlers: HTTPHandler[] = [];

  #server: Server | SSLServer;

  #router = createRouter({
    allowUnsafeRegex: false,
    caseSensitive: true,
    ignoreTrailingSlash: true,
    maxParamLength: 2048,
    defaultRoute(_req, res) {
      res.statusCode = 404;
      res.write('This resource is not avaliable in this server!');
      res.end();
    }
  });

  #logger;

  #container : AwilixContainer;

  get raw() {
    return this.#server;
  }

  setDependencyContainer(container : AwilixContainer) {
    this.#container = container;
  }

  constructor(
    private httpConfiguration: THttpConfiguration,
    container? : AwilixContainer
  ) {
    this.#server = this.httpConfiguration.server.ssl != null
      ? createSSLServer(
        this.httpConfiguration.server.ssl,
        this.#router.lookup.bind(this.#router)
      )
      : createServer(this.#router.lookup.bind(this.#router));

      this.#container = container ?? rootContainer;
      this.#logger = new Logger(HttpServer.name, this.#container);
  }

  get routes() {
    return [...this.#routes];
  }

  addRoute(...routes: HTTPRoute[]) {
    routes.forEach(route => {
      const handler = this.createHandlerForRoute(route);
      const method = route.method == null
        ? 'GET' as HTTPMethod
        : Array.isArray(route.method)
          ? route.method.map(r => r.toLocaleUpperCase()) as HTTPMethod[]
          : route.method.toLocaleUpperCase() as HTTPMethod;
      const url = route.url == null ? '/' : ['/', '*'].includes(route.url.charAt(0)) ? route.url : '/' + route.url;
      this.#logger.dev(` • ✅ [${String(method).padEnd(6, " ")}] ${url}`);
      this.#router.on(method, url, handler);
    });
   
    this.#routes.push(...routes);
  }

  listen(options?: TListenOptions) {

    const listOpts: TListenOptions = {
      host: options?.host ?? this.httpConfiguration.server.host,
      port: options?.port ?? this.httpConfiguration.server.port,
    };

    this.#server.listen(listOpts);

  }

  private createHandlerForRoute(route: HTTPRoute) {
    let handler = new HTTPHandler(this.#container.createScope(), route);
    this.#handlers.push(handler);
    return handler.handle.bind(handler);
  }

  async destroy() {
    this.#router.reset();
    if(this.#server.listening) {
      this.#server.close();
    }
    this.#server.removeAllListeners();
    this.#routes = [];
    this.#handlers = [];
  }
}
