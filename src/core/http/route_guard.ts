import type { TRequestBody, TRequestCookies, TRequestHeaders, TRequestQueryParams, TRequestType, TRequestURLParams } from "./request.js";
import type { HTTPResponse } from "./response.js";
import type { HTTPRoute } from "./route.js";

export type HTTPRouteGuard<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  > = IHTTPRouteGuard<Body, Headers, Cookies, URLParams, QueryParams, Services> | THTTPRouteGuardFn<Body, Headers, Cookies, URLParams, QueryParams, Services>;

interface IHTTPRouteGuard<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  > {
  name: string;
  guard: THTTPRouteGuardFn<Body, Headers, Cookies, URLParams, QueryParams, Services>;
}

type THTTPRouteGuardFn<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Services extends unknown[] = unknown[],
  > = (
    req: TRequestType<Body, Headers, Cookies, URLParams, QueryParams>,
    route: HTTPRoute<Body, Headers, Cookies, URLParams, QueryParams>,
    ...services: Services
  ) =>
    | boolean | HTTPResponse
    | Promise<boolean | HTTPResponse>;