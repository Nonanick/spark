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
import { bodyParser, parseBodyIntoRequest } from "./parse/body.js";
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

    // 1. Schemas contributions from interceptors
    for (let contributor of this.route.requestInterceptor ?? []) {
      // ignore interceptor functions
      if (typeof contributor === 'function') continue;
      this.addSchema(contributor);
    }

    // 2. Schemas contributions from guards
    for (let contributor of this.route.guards ?? []) {
      // ignore guard functions
      if (typeof contributor === 'function') continue;
      this.addSchema(contributor);
    }

    // 3. Schemas contribution from the route handler itself
    this.addSchema(route);

  }

  addSchema(contributor: IContributeSchema) {
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
    // make a dependency injection scope only for this request
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


const DEFAULT_INTERCEPTION_MOMENT: TResponseInterceptionMoment = 'handler-finished-with-ok-response';

interface IContributeSchema {
  body?: TRequestBody;
  headers?: TRequestHeaders;
  cookies?: TRequestCookies;
  urlParams?: TRequestURLParams;
  queryParams?: TRequestQueryParams;
}