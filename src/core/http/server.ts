import type { THttpConfiguration } from "#config/http.config";
import { container } from "#container";
import { Logger } from "#logger";
import { deepmerge } from "#utils/deepmerge";
import createRouter, { type HTTPMethod } from 'find-my-way';
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createSSLServer, type Server as SSLServer } from 'node:https';
import { performance } from "node:perf_hooks";
import type { PartialDeep } from "type-fest";
import { HTTPHandler } from "./handler.js";
import { BadRequest, NotAcceptable, Unauthorized } from "./http_error.js";
import type { HTTPResponseInterceptor, TResponseInterceptionMoment } from "./interceptors.js";
import { bodyParser } from "./parse/body.js";
import { cookieParser } from "./parse/cookies.js";
import { queryParamsParser } from "./parse/queryParams.js";
import type { IHTTPRequestData, TRequestBody, TRequestCookies, TRequestHeaders, TRequestQueryParams, TRequestURLParams } from "./request.js";
import { HTTPResponse } from "./response.js";
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

  #logger = new Logger(HttpServer.name);

  constructor(
    private httpConfiguration: THttpConfiguration
  ) {
    this.#server = this.httpConfiguration.server.ssl != null
      ? createSSLServer(
        this.httpConfiguration.server.ssl,
        this.#router.lookup.bind(this.#router)
      )
      : createServer(this.#router.lookup.bind(this.#router));
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

      this.#router.on(method, url, handler);

      // let log: any = { method, url, };
      // if (route.requestInterceptor!.length > 0) log["requestInterceptors"] = route.requestInterceptor!.map(i => i.name);
      // if (route.responseInterceptor!.length > 0) log["responseInterceptors"] = route.responseInterceptor!.map(i => i.name);
      // if (route.guards!.length > 0) log["guards"] = route.guards!.map(i => i.name);

      // this.#logger.info("Added route to server:", log);
    });
    this.#routes.push(...routes);
  }

  listen(options?: TListenOptions) {

    const listOpts: TListenOptions = {
      host: options?.host ?? this.httpConfiguration.server.host,
      port: options?.port ?? this.httpConfiguration.server.port,
    };

    this.#server.listen(listOpts);

    this.#server.on('listening', () => {
      this.#logger.log(
        `Listening at ${this.httpConfiguration.server.ssl == null ? 'http' : 'https'
        }://${listOpts.host}:${listOpts.port}`,
        options
      );
    });
  }

  private createHandlerForRoute(route: HTTPRoute) {
    let handler = new HTTPHandler(container.createScope(), route);
    this.#handlers.push(handler);
    return handler.handle.bind(handler);
  }
}
