import type { IHTTPRequestData, TRequestBody, TRequestCookies, TRequestHeaders, TRequestQueryParams, TRequestType, TRequestURLParams } from "./request.js";
import type { HTTPResponse } from "./response.js";

export type HTTPRequestInterceptor<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams| undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  > = IInterceptHTTPRequest<Body, Headers, Cookies, URLParams, QueryParams> | TInterceptHTTPRequestFn<Body, Headers, Cookies, URLParams, QueryParams>;

  export type HTTPResponseInterceptor = IInterceptHTTPResponse | TInterceptHTTPResponseFn;

interface IInterceptHTTPRequest<
  Body extends TRequestBody| undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams| undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  > {
  name: string;
  interceptor: TInterceptHTTPRequestFn<Body, Headers, Cookies, URLParams, QueryParams>;
}

interface IInterceptHTTPResponse {
  name: string;
  interceptor: TInterceptHTTPResponseFn;
  interceptWhen?: TResponseInterceptionMoment | TResponseInterceptionMoment[];
}

export type TResponseInterceptionMoment =
  | 'data-validation-failed'

  | 'interceptor-prevented-progression'
  | 'interceptor-prevented-progression-with-ok-response'
  | 'interceptor-prevented-progression-with-error-response'

  | 'guard-prevented-progression'

  | 'handler-finished'
  | 'handler-finished-with-ok-response'
  | 'handler-finished-with-error-response'

  | 'before-writing-to-client'
  | 'always'
  ;

export type TInterceptHTTPRequestFn<
  Body extends TRequestBody| undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  > = (req: TRequestType<Body, Headers, Cookies, URLParams, QueryParams>, ...services: unknown[]) =>
    | TRequestType<Body, Headers, Cookies, URLParams, QueryParams> | HTTPResponse | Error
    | Promise<TRequestType<Body, Headers, Cookies, URLParams, QueryParams> | HTTPResponse | Error>;


export type TInterceptHTTPResponseFn = (req: HTTPResponse, ...services: unknown[]) =>
  | HTTPResponse
  | Promise<HTTPResponse>;

