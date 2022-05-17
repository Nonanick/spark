import type { IHTTPRequestData } from "./request.js";
import type { HTTPResponse } from "./response.js";

export type HTTPRequestInterceptor = IInterceptHTTPRequest | TInterceptHTTPRequestFn;
export type HTTPResponseInterceptor = IInterceptHTTPResponse | TInterceptHTTPResponseFn;

interface IInterceptHTTPRequest {
  name: string;
  interceptor: TInterceptHTTPRequestFn;
}

interface IInterceptHTTPResponse {
  name: string;
  interceptor: TInterceptHTTPResponseFn;
  interceptWhen? : TResponseInterceptionMoment | TResponseInterceptionMoment[];
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

export type TInterceptHTTPRequestFn = (req: IHTTPRequestData, ...services: unknown[]) =>
  | IHTTPRequestData | HTTPResponse | Error
  | Promise<IHTTPRequestData | HTTPResponse | Error>;


export type TInterceptHTTPResponseFn = (req: HTTPResponse, ...services: unknown[]) =>
  | HTTPResponse 
  | Promise<HTTPResponse>;

