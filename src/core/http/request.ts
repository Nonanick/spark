import type { AwilixContainer } from 'awilix';
import type { HTTPMethod } from "find-my-way";
import type { File } from 'formidable';
import type PersistentFile from 'formidable/PersistentFile';
import type { Merge } from 'type-fest';
import type { AnyZodObject, TypeOf, ZodBoolean, ZodNumber, ZodString, ZodType, ZodTypeDef } from 'zod';
import type { HTTPIncomingHeaders, HTTPRoute } from './route.js';
import type { HttpServer } from './server.js';

export type TRequestBody = AnyZodObject;
export type TRequestHeaders = Record<HTTPIncomingHeaders, ZodString>;
export type TRequestCookies = Record<string, ZodString>;
export type TRequestURLParams = Record<string, ZodString>;
export type TRequestQueryParams = Record<string, ZodString | ZodNumber | ZodBoolean>;
export type TRequestFiles = Record<string, ZodType<PersistentFile, ZodTypeDef, PersistentFile>>;

export interface IHTTPRequestData<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Files extends TRequestFiles | undefined = undefined
  > {

  id: string;

  _metadata: Record<string, unknown>;

  issuedAt: Date;

  url: string;

  method: HTTPMethod;

  headers: Merge<
    { [name in HTTPIncomingHeaders]?: string },
    { [name in keyof NonNullable<Headers>]-?: string }
  >;

  body: Body extends null | undefined ? undefined : TypeOf<NonNullable<Body>>;

  urlParams?: URLParams extends null | undefined ? never : {
    [name in keyof NonNullable<URLParams>]: string
  };

  queryParams?: QueryParams extends null | undefined ? never : {
    [name in keyof NonNullable<QueryParams>]: TypeOf<NonNullable<QueryParams>[name]>
  };

  cookies?: Cookies extends null | undefined ? never : {
    [name in keyof NonNullable<Cookies>]: string
  };

  files?: Files extends null | undefined ? never : {
    [name in keyof NonNullable<Files>]: File
  };

}


export interface IHTTPRequestContext {
  server: HttpServer;
  route: HTTPRoute;
  container: AwilixContainer;
}


export type TRequestType<
  Body extends TRequestBody | undefined = undefined,
  Headers extends TRequestHeaders | undefined = undefined,
  Cookies extends TRequestCookies | undefined = undefined,
  URLParams extends TRequestURLParams | undefined = undefined,
  QueryParams extends TRequestQueryParams | undefined = undefined,
  Files extends TRequestFiles | undefined = undefined,
  > = Omit<IHTTPRequestData, "body" | "urlParams" | "queryParams" | "cookies" | "files">
  & (Body extends undefined ? {} : { body: TypeOf<NonNullable<Body>> })
  & (Headers extends undefined ? {} : {
    headers: Merge<
      { [name in HTTPIncomingHeaders]?: string },
      { [name in keyof NonNullable<Headers>]-?: string }
    >
  })
  & (Cookies extends undefined ? {} : {
    cookies: {
      [name in keyof NonNullable<Cookies>]: string
    }
  })
  & (URLParams extends undefined ? {} : {
    urlParams: {
      [name in keyof NonNullable<URLParams>]: string
    }
  })
  & (QueryParams extends undefined ? {} : {
    queryParams: {
      [name in keyof NonNullable<QueryParams>]: TypeOf<NonNullable<QueryParams>[name]>
    }
  })
  & (Files extends undefined ? {} : {
    files: {
      [name in keyof NonNullable<Files>]: File
    }
  });