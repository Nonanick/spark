import { Logger } from "#logger";
import type { ServerResponse } from "node:http";
import { HTTPError, InternalServerError } from "./http_error.js";
import { ISetCookieOptions, serializeCookie } from "./parse/cookies.js";

export class HTTPResponse {

  static #logger?: Logger;

  private static logger() : Logger {
    if(HTTPResponse.#logger == null){
      HTTPResponse.#logger = new Logger(HTTPResponse.name);
    }
    return HTTPResponse.#logger;
  } 

  static ok(send: unknown, status: HTTPStatus | number = HTTPStatus.Ok) {
    const r = new HTTPResponse;

    r.status(status);
    r.setPayload(send);

    return r;
  }

  static error(err: Error | HTTPError, status?: HTTPStatus | number) {
    const r = new HTTPResponse;

    if (err instanceof HTTPError) {
      r.status(err.status);
      r.setPayload({
        error: (err as any).constructor.name,
        message: err.message,
      });
    } else {
      r.setPayload({
        name: err.name,
        message: err.message,
      });
    }

    if (status != null) {
      r.status(status);
    }

    return r;
  }

  #statusCode: number = 200;

  #headers: Record<string, string> = {};

  #cookies: Record<string, ISetCookieOptions> = {};

  #payload: Record<string, unknown> | unknown = {};

  setHeader(name: string, value: string) {
    this.#headers[name] = value;
    return this;
  }

  removeHeader(name: string) {
    delete this.#headers[name];
    return this;
  }

  hasHeader(name: string) {
    return this.#headers[name] != null;
  }

  setCookie(name: string, value: string, options?: Omit<ISetCookieOptions,"value">) {
    this.#cookies[name] = {
      value,
      ...options
    };
    return this;
  }

  expireCookie(name: string) {
    this.#cookies[name] = {
      value: '',
    };
    return this;
  }

  unsetCookie(name: string) {
    delete this.#cookies[name];
    return this;
  }

  setPayload(payload: unknown) {
    this.#payload = payload;
    return this;
  }

  removePayload() {
    this.#payload = undefined;
    return this;
  }

  hasPayload() {
    return this.#payload != null;
  }

  status() : number;
  status(code : number) : void;
  status(code?: number) {
    if(code == null) return this.#statusCode;
    else this.#statusCode = code;
    return this;
  }

  async send(response: ServerResponse) {
    return new Promise<void>((res, rej) => {
      response.on('error', (err) => {
        rej(err);
      });

      // write headers
      response.statusCode = this.#statusCode;
      for (let headerName in this.#headers) {
        response.setHeader(headerName, this.#headers[headerName]);
      }

      // parse cookies
      let setCookies: string[] = [];
      for (let cookieName in this.#cookies) {
        setCookies.push(serializeCookie(cookieName, this.#cookies[cookieName].value, { ...this.#cookies[cookieName] }));
      }
      response.setHeader('set-cookie', setCookies);

      // check type of payload
      if (this.#payload != null) {

        // do we need to infer content-type?
        if (!response.hasHeader('content-type')) {
          // if payload is a buffer, send it as octet-stream!
          if (this.#payload instanceof Buffer || this.#payload instanceof Uint8Array) {
            response.setHeader('content-type', 'application/octet-stream');
          }

          if (typeof this.#payload === 'object') {
            response.setHeader('content-type', 'application/json');
          }

          if (['string', 'number', 'boolean'].includes(typeof this.#payload)) {
            response.setHeader('content-type', 'text/plain');
          }
        }

        // do we need to parse it?
        if (
          typeof this.#payload !== 'string'
          && !(this.#payload instanceof Buffer)
          && !(this.#payload instanceof Uint8Array)
        ) {
          // primitives?
          if (['number', 'boolean'].includes(typeof this.#payload)) {
            this.#payload = String(this.#payload);
          }
          // is an object?
          else if (typeof this.#payload === 'object' && this.#payload != null) {
            // is there a toJSON?
            if (
              'toJSON' in this.#payload
              && typeof (this.#payload as any).toJSON === 'function'
            ) {
              this.#payload = JSON.stringify((this.#payload as any).toJSON());
            } else {
              this.#payload = JSON.stringify(this.#payload);
            }
          }
          // none of the above?... panic!
          else {
            HTTPResponse.logger().error('Server does not know how to handle the response payload!', this.#payload);
            rej(new InternalServerError("Server failed to parse the outgoing response!"));
          }
        }
        response.write(this.#payload, err => err != null ? rej(err) : null);
      }
      response.end(() => {
        res();
      });
    });
  }

}

export enum HTTPStatus {
  Continue = 100,
  SwitchingProtocols = 101,
  Processing = 102,
  EarlyHints = 103,

  Ok = 200,
  Created = 201,
  Accepted = 202,
  NonAuthoritativeInformation = 203,
  NoContent = 204,
  ResetContent = 205,
  PartialContent = 206,

  MultipleChoices = 300,
  MovedPermanently = 301,
  Found = 302,
  SeeOther = 303,
  NotModified = 304,
  TemporaryRedirect = 307,
  PermanentRedirect = 308,

  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  NotAcceptable = 406,
  ProxyAuthenticationRequired = 407,
  RequestTimeout = 408,
  Conflict = 409,
  Gone = 410,
  ContentLengthRequired = 411,
  PreconditionFailed = 412,
  PayloadTooLarge = 413,
  URITooLong = 414,
  UnsupportedMediaType = 415,
  RangeNotSatisfiable = 416,
  ExpectationFailed = 417,
  ImATeapot = 418,
  MisdirectedRequest = 421,
  UnprocessableEntity = 422,
  Locked = 423,
  TooEarly = 425,
  PreconditionRequired = 428,
  TooManyRequests = 429,

  InternalServerError = 500,
  NotImplemented = 501,
  BadGateway = 502,
  ServiceUnavailable = 503,
  GatewayTimeout = 504,
  HTTPVersionNotSupported = 505,
  InsufficientStorage = 507,
  NetworkAuthenticationRequired = 511,
};