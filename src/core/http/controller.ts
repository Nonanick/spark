import { Logger } from "#logger";
import { z } from "zod";
import type { HTTPRequestInterceptor, HTTPResponseInterceptor } from "./interceptors";
import type { TRequestBody, TRequestCookies, TRequestHeaders, TRequestQueryParams, TRequestURLParams } from "./request";
import type { HTTPRoute } from "./route";
import type { HTTPRouteGuard } from "./route_guard";

export class HTTPController<
  Body extends TRequestBody = TRequestBody,
  Headers extends TRequestHeaders = TRequestHeaders,
  Cookies extends TRequestCookies = TRequestCookies,
  QueryParams extends TRequestQueryParams = TRequestQueryParams,
  URLParams extends TRequestURLParams = TRequestURLParams
  > {

  register?: Record<string, unknown>;

  interceptRequest?: HTTPRequestInterceptor[] = [];
  interceptResponse?: HTTPResponseInterceptor[] = [];
  guard?: HTTPRouteGuard[] = [];

  // require schema
  headers?: Headers;
  cookies?: Cookies;
  body?: Body;
  queryParams?: QueryParams;
  urlParams?: URLParams;

  #logger: Logger = new Logger(HTTPController.name);

  applyToRoute(...routes: HTTPRoute[]) {
    this.#logger.log("Implement controller! Handling routes: ", routes);
    routes.forEach(route => {
      // preppend interceptors and guards
      route.requestInterceptor = [...this.interceptRequest ?? [], ...route.requestInterceptor ?? []];
      route.responseInterceptor = [...this.interceptResponse ?? [], ...route.responseInterceptor ?? []];
      route.guards = [...this.guard ?? [], ...route.guards ?? []];

      // merge schemas
      if(route.body != null) {
        if(this.body != null) {
          route.body = route.body!
        }

      }
    });
  }
}

export function createController<
  Body extends TRequestBody = TRequestBody,
  Headers extends TRequestHeaders = TRequestHeaders,
  Cookies extends TRequestCookies = TRequestCookies,
  QueryParams extends TRequestQueryParams = TRequestQueryParams,
  URLParams extends TRequestURLParams = TRequestURLParams
>(options: ICreateController) {

}

export interface ICreateController<
  Body extends TRequestBody = TRequestBody,
  Headers extends TRequestHeaders = TRequestHeaders,
  Cookies extends TRequestCookies = TRequestCookies,
  QueryParams extends TRequestQueryParams = TRequestQueryParams,
  URLParams extends TRequestURLParams = TRequestURLParams
  > {
  register?: Record<string, unknown>;

  interceptRequest?: HTTPRequestInterceptor[];
  interceptResponse?: HTTPResponseInterceptor[];
  guard?: HTTPRouteGuard[];

  // require schema
  headers?: Headers;
  cookies?: Cookies;
  body?: Body;
  queryParams?: QueryParams;
  urlParams?: URLParams;
}

