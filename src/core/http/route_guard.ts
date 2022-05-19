import type { TRequestBody, TRequestCookies, TRequestHeaders, TRequestQueryParams, TRequestType, TRequestURLParams } from "./request.js";
import type { HTTPResponse } from "./response.js";

export type HTTPRouteGuard<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  > = IHTTPRouteGuard<Body, Headers, Cookies, URLParams, QueryParams, Services> | THTTPRouteGuardFn<Body, Headers, Cookies, URLParams, QueryParams, Services>;

export interface IHTTPRouteGuard<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  > {
  name?: string;

  body?: Body;
  headers?: Headers;
  cookies?: Cookies;
  urlParams?: URLParams;
  queryParams?: QueryParams;

  guard: THTTPRouteGuardFn<Body, Headers, Cookies, URLParams, QueryParams, Services>;
}

export type THTTPRouteGuardFn<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  > = (
    req: TRequestType<Body, Headers, Cookies, URLParams, QueryParams>,
    ...services: Services
  ) =>
    | boolean | HTTPResponse
    | Promise<boolean | HTTPResponse>;

export function createGuard<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  >(options: IHTTPRouteGuard<Body, Headers, Cookies, URLParams, QueryParams, Services>) {

  const g: IHTTPRouteGuard<Body, Headers, Cookies, URLParams, QueryParams, Services> = {
    ...options
  };
  return g;
}