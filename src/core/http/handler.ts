import type { THttpConfiguration } from "#config/http.config";
import { container } from "#container";
import { MissingServiceInContainer } from "#container/missing_service.error";
import { Logger } from "#logger";
import { deepmerge } from "#utils/deepmerge";
import { isClass } from "#utils/is_class";
import { isFunction } from "#utils/is_function";
import { asClass, asFunction, asValue, AwilixContainer, Lifetime } from "awilix";
import type { HTTPMethod } from "find-my-way";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Class, JsonValue, PartialDeep } from "type-fest";
import type { AnyZodObject } from "zod";
import { BadRequest, InternalServerError, NotAcceptable, Unauthorized } from "./http_error.js";
import type { HTTPResponseInterceptor, TInterceptHTTPResponseFn, TResponseInterceptionMoment } from "./interceptors.js";
import { bodyParser } from "./parse/body.js";
import { cookieParser } from "./parse/cookies.js";
import { queryParamsParser } from "./parse/queryParams.js";
import type { IHTTPRequestData, TRequestBody, TRequestCookies, TRequestHeaders, TRequestQueryParams, TRequestURLParams } from "./request.js";
import { HTTPResponse } from "./response.js";
import type { HTTPRoute } from "./route.js";

export class HTTPHandler {

  #cachedFunctionParameters = new Map<Function, string[]>();

  #logger: Logger;

  // Analytics
  /**
   * How many times this handler was invoked
   */
  #countInvocations: number = 0;
  /**
   * Each request processing time
   */
  #requestProcessingDelta: number[] = [];

  #responseInterceptorsByMoment?: Record<TResponseInterceptionMoment, HTTPResponseInterceptor[]>;

  // schemas, contributed by route handlers, guards and interceptor
  body?: TRequestBody;
  headers?: TRequestHeaders;
  cookies?: TRequestCookies;
  urlParams?: TRequestURLParams;
  queryParams?: TRequestQueryParams;

  constructor(
    private container: AwilixContainer,
    private route: HTTPRoute
  ) {
    this.#logger = new Logger(`${HTTPHandler.name}::${route.method?.toLocaleUpperCase() ?? 'GET'}"${route.url ?? '/'}"`);

    // build this handler schemas
    // 1. Contribution from interceptors
    for (let contributor of this.route.requestInterceptor ?? []) {
      // ignore guard functions
      if (typeof contributor === 'function') continue;

      if (contributor.body != null) {
        if (this.body != null) this.body = (contributor.body as AnyZodObject).merge(this.body);
        else this.body = contributor.body;
      }

      if (contributor.headers != null) {
        if (this.headers != null) this.headers = { ...contributor.headers! as TRequestHeaders, ...this.headers };
        else this.headers = contributor.headers;
      }

      if (contributor.cookies != null) {
        if (this.cookies != null) this.cookies = { ...contributor.cookies! as TRequestCookies, ...this.cookies };
        else this.cookies = contributor.cookies;
      }

      if (contributor.urlParams != null) {
        if (this.urlParams != null)
          this.urlParams = { ...contributor.urlParams! as TRequestURLParams, ...this.urlParams };
        else this.urlParams = contributor.urlParams;
      }

      if (contributor.queryParams != null) {
        if (this.queryParams != null) this.queryParams = { ...contributor.queryParams! as TRequestURLParams, ...this.queryParams };
        else this.queryParams = contributor.queryParams;
      }
    }

    // 2. Contribution from guards
    for (let contributor of this.route.guards ?? []) {
      // ignore guard functions
      if (typeof contributor === 'function') continue;

      if (contributor.body != null) {
        if (this.body != null) this.body = (contributor.body as AnyZodObject).merge(this.body);
        else this.body = contributor.body;
      }

      if (contributor.headers != null) {
        if (this.headers != null) this.headers = { ...contributor.headers! as TRequestHeaders, ...this.headers };
        else this.headers = contributor.headers;
      }

      if (contributor.cookies != null) {
        if (this.cookies != null) this.cookies = { ...contributor.cookies! as TRequestCookies, ...this.cookies };
        else this.cookies = contributor.cookies;
      }

      if (contributor.urlParams != null) {
        if (this.urlParams != null)
          this.urlParams = { ...contributor.urlParams! as TRequestURLParams, ...this.urlParams };
        else this.urlParams = contributor.urlParams;
      }

      if (contributor.queryParams != null) {
        if (this.queryParams != null) this.queryParams = { ...contributor.queryParams! as TRequestURLParams, ...this.queryParams };
        else this.queryParams = contributor.queryParams;
      }
    }

    // 3. Contribution from the route itself
    const contributor = this.route;

    if (contributor.body != null) {
      if (this.body != null) this.body = (contributor.body as AnyZodObject).merge(this.body);
      else this.body = contributor.body;
    }

    if (contributor.headers != null) {
      if (this.headers != null) this.headers = { ...contributor.headers! as TRequestHeaders, ...this.headers };
      else this.headers = contributor.headers;
    }

    if (contributor.cookies != null) {
      if (this.cookies != null) this.cookies = { ...contributor.cookies! as TRequestCookies, ...this.cookies };
      else this.cookies = contributor.cookies;
    }

    if (contributor.urlParams != null) {
      if (this.urlParams != null)
        this.urlParams = { ...contributor.urlParams! as TRequestURLParams, ...this.urlParams };
      else this.urlParams = contributor.urlParams;
    }

    if (contributor.queryParams != null) {
      if (this.queryParams != null) this.queryParams = { ...contributor.queryParams! as TRequestURLParams, ...this.queryParams };
      else this.queryParams = contributor.queryParams;
    }

  }

  async handle(req: IncomingMessage, res: ServerResponse, urlParams: Record<string, string | undefined>) {
    // make a resolver only for this request
    const container = this.container.createScope();
    let request = await this.forgeRequest(req, urlParams, container);

    // If it returned a http response or an error a validation error ocurred!
    if (request instanceof HTTPResponse || request instanceof Error) {
      let response = await this.applyResponseInterceptors(
        request,
        'data-validation-failed',
        container,
      );
      return response.send(res);
    }

    let interceptedRequest = await this.applyRequestInterceptors(request, container);

    // again, interceptors can short circuit the request cycle
    if (interceptedRequest instanceof HTTPResponse || interceptedRequest instanceof Error) {
      let response: HTTPResponse;
      if (!(interceptedRequest instanceof Error) && interceptedRequest.status() < 400) {
        response = await this.applyResponseInterceptors(
          interceptedRequest,
          'interceptor-prevented-progression-with-ok-response',
          container,

        );
      } else {
        response = await this.applyResponseInterceptors(
          interceptedRequest,
          'interceptor-prevented-progression-with-error-response',
          container,

        );
      }
      return response.send(res);
    }

    // update request
    request = interceptedRequest;

    // apply guards
    let canContinue = await this.applyGuards(request, container);
    if (canContinue instanceof Error || canContinue instanceof HTTPResponse) {
      let response = await this.applyResponseInterceptors(
        canContinue,
        'guard-prevented-progression',
        container,
      );
      return response.send(res);
    }

    // call route handler function
    let handlerResponse;
    let handlerServices: unknown[] | Error;
    handlerServices = this.resolveServices(container, this.getFunctionServices(this.route.handler, 1));
    if (handlerServices instanceof Error) {

      this.#logger.fatal(
        'Failed to resolve services from route handler ',
        { url: this.route.url, method: this.route.method },
        "List of route hanlder dependencies:",
        this.getFunctionServices(this.route.handler, 1)
      );
      return HTTPResponse.error(
        new InternalServerError("Missing/unresolved required service for this route")
      ).send(res);
    }
    try {
      handlerResponse = await this.route.handler(request, ...handlerServices);
    } catch (err) {
      if (err instanceof Error) {
        handlerResponse = HTTPResponse.error(err)
      } else {
        // TODO: throw something inside a function, should I create a new error?
        this.#logger.dev('Handler threw a non error value!', err);
      }
    }

    // transform handlerResponse into a payload if it's not already an Error or a HTTPResponse
    if (
      !(handlerResponse instanceof HTTPResponse)
      && !(handlerResponse instanceof Error)
    ) {
      handlerResponse = HTTPResponse.ok(handlerResponse);
    }

    if (handlerResponse instanceof Error || (handlerResponse instanceof HTTPResponse && handlerResponse.status() >= 400)) {
      let response = await this.applyResponseInterceptors(
        handlerResponse,
        'handler-finished-with-error-response',
        container,
      );
      return response.send(res);
    }

    handlerResponse = await this.applyResponseInterceptors(
      handlerResponse,
      'handler-finished-with-ok-response',
      container,
    );

    return handlerResponse.send(res);
  }

  private async forgeRequest(req: IncomingMessage, urlParams: Record<string, string | undefined>, container: AwilixContainer) {
    const route = this.route;

    // 1: define id, method and url
    const request: IHTTPRequestData = {
      _metadata: {},
      id: randomUUID(),
      issuedAt: new Date(),
      method: req.method!.toLocaleUpperCase() as HTTPMethod,
      url: req.url!,
      // put all received headers in request
      headers: Object.entries(req.headers)
        .reduce((o, [k, v]) => { o[k] = String(v); return o; }, {} as Record<string, string>),
      body: undefined,
      cookies: undefined,
      files: undefined,
      queryParams: undefined,
      urlParams: undefined,
      provide: (name: string, value: Class<any> | JsonValue | ((...args: any) => any)) => {

        if (isClass(value)) {
          container.register(name, asClass(value, { lifetime: Lifetime.SCOPED }));
          return;
        }

        if (isFunction(value)) {
          container.register(name, asFunction(value, { lifetime: Lifetime.SCOPED }));
          return;
        }
        container.register(name, asValue(value))
      }
    };

    // 2: check if body schema is present
    if (this.body != null) {
      await parseBodyIntoRequest(req, request, route,);
      // validate body
      let parsedBody = (this.body as TRequestBody).safeParse(request.body);
      if (!parsedBody.success) {
        return new BadRequest("Incorrect body arguments!" + parsedBody.error.toString())
      }
      request.body = parsedBody.data as any;
    }

    //  3: check if there are required headers
    if (this.headers != null) {
      for (let headerKey in (this.headers as TRequestHeaders)) {
        let parser = (this.headers as TRequestHeaders)[headerKey]!;
        let value = (request.headers as any)[headerKey];
        let parsed = parser.safeParse(value);
        if (!parsed.success) {
          if (value == null) {
            return new BadRequest(`This route expects a header named "${headerKey}" to be present!`);
          }
          return new BadRequest(`A header parameter could not be validated! ${parsed.error.toString()}`);
        }
        (request.headers as any)[headerKey] = parsed.data;
      }
    }

    // 4: check for cookies
    if (this.cookies != null) {
      request.cookies = {} as any;
      let parsedCookies = cookieParser(req.headers['cookie'] ?? '');
      for (let cookieKey in (this.cookies as TRequestCookies)) {
        let parser = (this.cookies as TRequestCookies)[cookieKey];
        let value = parsedCookies[cookieKey];
        let parsed = parser.safeParse(value);
        if (!parsed.success) {
          if (value == null) {
            return new BadRequest(`This route expects a cookie named "${cookieKey}" to be present!`);
          }
          return new BadRequest(`A cookie parameter could not be validated! ${parsed.error.toString()}`);
        }
        (request.cookies as any)[cookieKey] = parsed.data;
      }
    }

    // 5: check for url params
    if (this.urlParams != null) {
      request.urlParams = {} as any;
      for (let urlKey in (this.urlParams as TRequestURLParams)) {
        let parser = (this.urlParams as TRequestURLParams)[urlKey];
        let value = urlParams[urlKey];
        let parsed = parser.safeParse(value);
        if (!parsed.success) {
          if (value == null) {
            return new BadRequest(`This route expects an URL parameter named "${urlKey}" to be present!`);
          }
          return new BadRequest(`An URL parameter could not be validated! ${parsed.error.toString()}`);
        }
        (request.urlParams as any)[urlKey] = parsed.data;
      }
    }

    // 6: check for query params
    if (this.queryParams != null) {
      request.queryParams = {} as any;
      let parsedQueryParams = queryParamsParser(req.url ?? '');
      for (let queryKey in (this.queryParams as TRequestQueryParams)) {
        let parser = (this.queryParams as TRequestQueryParams)[queryKey];
        let value = parsedQueryParams[queryKey];
        let parsed = parser.safeParse(value);
        if (!parsed.success) {
          if (value == null) {
            return new BadRequest(`This route expects an query parameter named "${queryKey}" to be present!`);
          }
          return new BadRequest(`An query parameter could not be validated! ${parsed.error.toString()}`);
        }
        (request.queryParams as any)[queryKey] = parsed.data;
      }
    }

    return request;

  }

  private async applyRequestInterceptors(request: IHTTPRequestData, container: AwilixContainer): Promise<IHTTPRequestData | Error | HTTPResponse> {
    const route = this.route;

    for (let interceptor of route.requestInterceptor ?? []) {
      let interceptorFn = typeof interceptor === 'function' ? interceptor : interceptor.interceptor;
      let injectServices = this.resolveServices(container, this.getFunctionServices(interceptorFn, 1));
      if (injectServices instanceof Error) {
        this.#logger.fatal(
          'Failed to resolve services from response interceptor!',
          { url: this.route.url, method: this.route.method },
          this.getParamNames(interceptorFn)
        );
        return HTTPResponse.error(new InternalServerError("Missing/unresolved required service for this route"));
      }
      let newRequest = await interceptorFn(request, ...injectServices);
      // check return from interceptor
      if (newRequest instanceof Error || newRequest instanceof HTTPResponse) {
        return newRequest;
      }
      request = newRequest as any;
    }

    return request;
  }

  /**
   * Get the response interceptors sorted by their "moments"
   * 
   */
  get responseInterceptorsSortedByMoments() {

    if (this.#responseInterceptorsByMoment == null) {
      this.#responseInterceptorsByMoment = {
        "before-writing-to-client": [],
        "data-validation-failed": [],
        "guard-prevented-progression": [],
        "handler-finished": [],
        "handler-finished-with-error-response": [],
        "handler-finished-with-ok-response": [],
        "interceptor-prevented-progression": [],
        "interceptor-prevented-progression-with-error-response": [],
        "interceptor-prevented-progression-with-ok-response": [],
        always: [],
      } as Record<TResponseInterceptionMoment, HTTPResponseInterceptor[]>;

      // sort by moments
      (this.route.responseInterceptor ?? []).forEach(intercept => {
        if (typeof intercept === 'function') {
          this.#responseInterceptorsByMoment![DEFAULT_INTERCEPTION_MOMENT].push(intercept);
        } else {
          if (Array.isArray(intercept.interceptWhen)) {
            for (let when of intercept.interceptWhen) {
              this.#responseInterceptorsByMoment![when].push(intercept);
            }
          } else {
            this.#responseInterceptorsByMoment![intercept.interceptWhen ?? DEFAULT_INTERCEPTION_MOMENT].push(intercept);
          }
        }
      });
    }

    return this.#responseInterceptorsByMoment!;
  }

  private async applyResponseInterceptors(
    responseOrError: HTTPResponse | Error,
    moment: TResponseInterceptionMoment,
    container: AwilixContainer,
  ) {

    let response: HTTPResponse;
    if (responseOrError instanceof Error) {
      response = HTTPResponse.error(responseOrError);
    } else {
      response = responseOrError;
    }

    const interceptors = this.responseInterceptorsSortedByMoments;

    const applyInterceptors: TInterceptHTTPResponseFn[] = [];

    // check which interceptors should be applied
    switch (moment) {
      case 'data-validation-failed':
        applyInterceptors.push(
          ...interceptors['data-validation-failed'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor)
        );
        break;
      case 'guard-prevented-progression':
        applyInterceptors.push(
          ...interceptors['guard-prevented-progression'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor)
        );
        break;
      case 'handler-finished-with-error-response':
        applyInterceptors.push(
          ...interceptors['handler-finished-with-error-response'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
          ...interceptors['handler-finished'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
        );
        break;
      case 'handler-finished-with-ok-response':
        applyInterceptors.push(
          ...interceptors['handler-finished-with-ok-response'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
          ...interceptors['handler-finished'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
        );
        break;
      case 'interceptor-prevented-progression-with-error-response':
        applyInterceptors.push(
          ...interceptors['interceptor-prevented-progression-with-error-response'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
          ...interceptors['interceptor-prevented-progression'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
        );
        break;
      case 'interceptor-prevented-progression-with-ok-response':
        applyInterceptors.push(
          ...interceptors['interceptor-prevented-progression-with-ok-response'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
          ...interceptors['interceptor-prevented-progression'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
        );
        break;
    }

    // Always append both moments
    applyInterceptors.push(
      ...interceptors['before-writing-to-client'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
      ...interceptors['always'].map(interceptor => typeof interceptor === 'function' ? interceptor : interceptor.interceptor),
    );

    for (const interceptorFn of applyInterceptors) {
      let injectServices = this.resolveServices(container, this.getFunctionServices(interceptorFn, 1));
      if (injectServices instanceof Error) {
        this.#logger.fatal(
          'Failed to resolve services from response interceptor!',
          { url: this.route.url, method: this.route.method },
          this.getParamNames(interceptorFn)
        );
        return HTTPResponse.error(new InternalServerError("Missing/unresolved required service for this route"));
      }
      response = await interceptorFn(response, ...injectServices);
    }
    return response;
  }

  private async applyGuards(
    request: IHTTPRequestData,
    container: AwilixContainer,
  ) {
    for (let guard of this.route.guards ?? []) {
      let guardFn = typeof guard === 'function' ? guard : guard.guard;
      let guardServices = this.resolveServices(container, this.getFunctionServices(guardFn, 1));
      if (guardServices instanceof Error) {
        this.#logger.fatal(
          'Failed to resolve services from request guard!',
          { url: this.route.url, method: this.route.method },
          this.getParamNames(guardFn),
        );
        return new InternalServerError("Missing/unresolved required service for this route");
      }
      const canContinue = await guardFn(request, ...guardServices);
      if (!canContinue || canContinue instanceof HTTPResponse) {
        if (typeof canContinue == 'boolean') {
          return new Unauthorized("You may not access this endpoint!");
        }
        return canContinue;
      }
    }

    return true as true;
  }

  private resolveServices(container: AwilixContainer, serviceNames: string[]): unknown[] | MissingServiceInContainer {
    try {
      return serviceNames.map(name => container.resolve(name));
    } catch (err) {
      return new MissingServiceInContainer("Could not resolve service by its name! " + serviceNames.join(', '))
    }
  }

  private getFunctionServices(fromFunction: Function, offsetParams: number): string[] {

    if (this.#cachedFunctionParameters.has(fromFunction)) {
      return this.#cachedFunctionParameters.get(fromFunction)!;
    }

    let paramNames = this.getParamNames(fromFunction).map(a => String(a));
    if (offsetParams > 0) {
      paramNames = paramNames.slice(offsetParams);
    }

    this.#cachedFunctionParameters.set(fromFunction, paramNames);
    return paramNames;
  }

  private getParamNames(func: Function) {
    var fnStr = func.toString().replace(STRIP_COMMENTS, '');
    var result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
    if (result === null)
      result = [];
    return result;
  }

}

const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
const ARGUMENT_NAMES = /([^\s,]+)/g;

/**
 * Default contentType by RFC 2616
 * 
 * "If and only if the media type is not given by a Content-Type field, the recipient MAY attempt to guess the media 
 * type via inspection of its content and/or the name extension of the URI used to identify the resource. If the media type remains unknown, 
 * the recipient SHOULD treat it as type "application/octet-stream"
 * 
 * @link https://www.w3.org/Protocols/rfc2616/rfc2616-sec7.html#sec7.2.1
 */
const DEFAULT_CONTENT_TYPE = (route: HTTPRoute) => {
  /** 
   * Since, by the RFC, we are allowed to "guess" the content-type, 
   * if its not present, we shall "rely" on the route schemas to guess it  
   */

  // So we will assume "application/json" if no "files" schema is present and "multipart/form-data" otherwise
  if (route.files != null) return 'multipart/form-data';
  return 'application/json';
};

async function parseBodyIntoRequest(
  body: IncomingMessage,
  request: IHTTPRequestData,
  route: HTTPRoute
) {

  // content type should be case-insensitive, lowercasing them all
  const contentType = parseContentType(body.headers['content-type']?.toLocaleLowerCase() ?? DEFAULT_CONTENT_TYPE(route));

  //should we do smt about encoding? nodejs handles it for us?
  //const contentEncoding = body.headers['content-encoding'] ?? '';

  const routeConfig = getCompleteRouteConfig(route);

  switch (contentType.type) {
    case 'application/json':
      const parsedJSONResponse = await bodyParser['application/json'](body, {
        charset: contentType.params.charset,
        maxBodySize: routeConfig.body.maxBodySize,
      });
      request.body = parsedJSONResponse;
      return request;
    case 'application/x-www-form-urlencoded':
      const parsedURLEncodedResponse = await bodyParser['application/x-www-form-urlencoded'](body, {
        charset: contentType.params.charset,
        maxBodySize: routeConfig.body.maxBodySize,
      });
      request.body = parsedURLEncodedResponse;
      return request;
    case 'text/plain':
      const parsedTextResponse = await bodyParser['text/plain'](body, {
        charset: contentType.params.charset,
        maxBodySize: routeConfig.body.maxBodySize,
      });
      request.body = parsedTextResponse as any;
      return request;
    case 'multipart/form-data':
      const parsedMulipart = await bodyParser['multipart/form-data'](body, {
        maxBodySize: routeConfig.body.maxBodySize,
        acceptMime: routeConfig.files.acceptMimes,
        maxFiles: routeConfig.files.maxFiles,
        maxFileSize: routeConfig.files.maxFileSize,
        minimumFileSize: routeConfig.files.minimunFileSize,
      });
      request.body = parsedMulipart.fields as any;
      request.files = parsedMulipart.files as any;
      return request;
    default:
      throw new NotAcceptable("The content-type provided (" + contentType.type + ") is not suported by this server!")
  }
}

/**
 * Parse "content-type" header
 * ----------------------------
 * 
 * Header should respect the following format:
 *  "type/subtype; paramKey=paramValue"
 * 
 * - If a mime type is "known" to the server we shall return the default charset defined by the RFC
 * - If a mime type is not "known" return utf8 as default
 * - For multipart the boundary is required and this function will throw when this condition is not met 
 * 
 * ___"known" actually means "know how to handle", a mime can be defined by IANA but may not be contemplated in the code___
 * @param typeString 
 * @returns {ContentTypeParams}
 */
function parseContentType(typeString: string): ContentTypeParams {
  let type: string;

  let ioSeparator = typeString.indexOf(';');

  // no separator for content-type!
  if (ioSeparator < 0) {
    type = typeString.trim();
    switch (type) {
      /**
       * Default charset for urlencoded is '7bit' but, by the nodejs documentation:
       * "Generally, there should be no reason to use this encoding, as 'utf8' (or, if the data 
       * is known to always be ASCII-only, 'latin1') will be a better choice when encoding or 
       * decoding ASCII-only text. It is only provided for legacy compatibility."
       * 
       * @link https://www.iana.org/assignments/media-types/application/x-www-form-urlencoded
       * @link https://nodejs.org/api/buffer.html#buffers-and-character-encodings
       */
      case 'application/x-www-form-urlencoded':
        return { type, params: { charset: 'utf8' } };
      /**
       * Default charset for application/json is 'binary' in node it is an alias for 'latin1'
       * @link https://www.iana.org/assignments/media-types/application/json
       */
      case 'application/json':
        return { type, params: { charset: 'latin1' } };
      /**
       * Default charset for 'text/*' media is us-ascii, as denoted in previous comments 'utf-8' 
       * is best as a general purpose decoder
       */
      case 'text/plain':
        return { type, params: { charset: 'utf8' } };
      /**
       * In multipart the boundary is a required paramete!
       */
      case 'multipart/form-data':
        throw new BadRequest("multipart/form-data requires that the 'boundary' parameter in content-type header to be set, none found!");
      default:
        /**
         * For an unknown content type we shall default to utf8, the requets will probably panic
         * since there wont be a known parser for the content-type provided!
         * If there is this piece of code should be updated...
         */
        return { type, params: { charset: 'utf8' } } as CharsetParams;
    }
  } else {
    let type = typeString.substring(0, ioSeparator).trim();
    let params = typeString.substring(ioSeparator + 1).trim();
    switch (type) {
      case 'multipart/form-data':
        let matchesWithboundary = params.match(/^boundary=(?<boundary>.+)$/);
        if (matchesWithboundary != null) return { type, params: { boundary: matchesWithboundary.groups!.boundary } };
        else throw new BadRequest("multipart/form-data requires that the 'boundary' parameter in content-type header to be set, none found!");
      default:
        let ioEq = params.indexOf('=')
        if (ioEq < 0) {
          return { type, params: { charset: 'utf8' } } as CharsetParams;
        }
        let paramKey = params.substring(0, ioEq);
        let paramValue = paramKey.substring(ioEq + 1);
        return { type, params: { [paramKey]: paramValue } } as ContentTypeParams;
    }
  }
}

type ContentTypeParams = MultipartParams | CharsetParams | UnknownParams;

interface CharsetParams {
  type: 'text/plain' | 'application/json' | 'application/x-www-form-urlencoded';
  params: {
    charset: string;
  }
}

interface MultipartParams {
  type: 'multipart/form-data';
  params: {
    boundary: string;
  }
}

interface UnknownParams {
  type: string;
  params: Record<string, string>;
}

function getCompleteRouteConfig(
  options?: PartialDeep<THttpConfiguration['route']>
): THttpConfiguration['route'] {
  const defaultConfig = container.resolve<THttpConfiguration>('httpConfiguration');

  return deepmerge(
    defaultConfig.route,
    options as any
  );
}

const DEFAULT_INTERCEPTION_MOMENT: TResponseInterceptionMoment = 'handler-finished-with-ok-response';