import type { THttpConfiguration } from "#config/http.config";
import { container } from "#container";
import { BadRequest, NotAcceptable, PayloadTooLarge } from "#http/http_error";
import type { IHTTPRequestData } from "#http/request";
import type { HTTPRoute } from "#http/route";
import { deepmerge } from "#utils/deepmerge";
import formidable, { File } from "formidable";
import type { IncomingMessage } from "node:http";
import type { PartialDeep } from "type-fest";

export interface IParseBodyOptions {
  maxBodySize: number;
  charset?: 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'hex' | string & {};
}

async function parseBodyAsString(
  request: IncomingMessage,
  options: IParseBodyOptions,
) {

  const rawBody = await new Promise<string>((resolve, reject) => {

    let fullBody: string = '';

    function concatenateChunk(chunk: any) {
      fullBody += String(chunk);
      if (fullBody.length > options.maxBodySize) {
        reportError(new PayloadTooLarge(`Request payload is bigger than ${options.maxBodySize}`));
      }
    }

    function reportError(err: Error) {
      // cleanup body
      fullBody = "";
      reject(err);
      disconnectListeners();
    }

    function disconnectListeners() {
      request.off('data', concatenateChunk);
      request.off('error', reportError);
      request.off('end', reportStreamEnd);
    }

    function reportStreamEnd() {
      resolve(fullBody);
      disconnectListeners();
    }

    /**
     * Check JSON validity
     * -------------------
     *  Eagerly checks if the initial body request string is correctly formed:
     * - string wrapped in ""
     * - a number (0,1...)
     * - a boolean (true | false)
     * - an array wrapped in []
     * - an object wrapped in {}
     * 
     * Useful when receiving an incorrent body content type, avoiding consuming the whole stream
     * into memory before failing
     * 
     * @param chunk 
     * @returns 
     */
    function checkForEarlyJSONValidity(chunk: any) {
      // if the content is still empty, schedule for next iteration
      if (fullBody.trim().length === 0) {
        request.once('data', checkForEarlyJSONValidity);
        return;
      }

    }

    // has a valid charset information ?
    if (['ascii', 'utf8', 'utf-8', 'utf16le', 'ucs2', 'ucs-2', 'base64', 'base64url', 'latin1', 'binary', 'hex'].includes(
      String(options?.charset).toLocaleLowerCase()
    )) {
      request.setEncoding(String(options?.charset).toLocaleLowerCase() as BufferEncoding);
    }

    request.on('data', concatenateChunk);
    request.on('error', reportError);
    request.on('end', reportStreamEnd);

    request.once('data', checkForEarlyJSONValidity);
  });

  return rawBody;
}

/**
 * [Body Parser] Application/JSON
 * ------------------------------
 * - Tries to parse "application/json" request body type
 * 
 * Use as limits/constraints:
 * - Max body size
 * - Charset (must be one of the accepted by node: 'ascii' | 'utf8' | 'utf-8' | 'utf16le' | 'ucs2' | 'ucs-2' | 'base64' | 'base64url' | 'latin1' | 'binary' | 'hex')
 * 
 */
async function parseApplicationJSON(
  request: IncomingMessage,
  options: IParseBodyOptions,
) {

  let bodyStr = await parseBodyAsString(request, options);
  try {
    let parsedTarget = Object.create(null);
    // JSON.parse() creates a new object based on "Object" prototype
    let parsed = JSON.parse(bodyStr);
    // So we copy its contents whitout __proto__ (if is poisoned or not) to the target object that has no __proto__ at all (based on "null")
    for (let propName in parsed) {
      if (propName !== '__proto__') {
        parsedTarget[propName] = parsed[propName];
      }
    }
    return parsedTarget;
  } catch (err) {
    throw new BadRequest("Could not parse the payload as JSON content!");
  }

}

interface IParseMultipartFormDataOptions {
  maxBodySize: number;
  maxFileSize: number;
  acceptMime: string | string[];
  maxFiles: number;
  minimumFileSize: number;
}
/**
 * [Body Parser] Multipart/Form-Data
 * ----------------------------------
 * - Tries to parse "multipart/form-data" request body type
 * Delegates to formidable
 * 
 * Use as limits/contraints
 * - Max body size (files + data)
 * - Max file size (singular file max size)
 * - Accepted mimes
 * - Max number of files (total)
 * - Minimum file size
 */
async function parseMultipartFormData(
  request: IncomingMessage,
  options: IParseMultipartFormDataOptions
) {

  const parser = formidable({
    allowEmptyFiles: false,
    maxFileSize: options.maxFileSize,
    minFileSize: options.minimumFileSize,
    maxTotalFileSize: options.maxBodySize,
    maxFiles: options.maxFiles
  });

  return new Promise<{
    files : Record<string, File|File[]>;
    fields: Record<string, unknown>;
  }>((resolve, reject) => {
    parser.parse(request, (err, fields, files) => {
      if (err != null) {
        reject(err);
        return;
      }

      resolve({
        fields,
        files
      });
    });
  });
}

async function parseURLEncoded(
  request: IncomingMessage,
  options: IParseBodyOptions
) {

  const dataStr = await parseBodyAsString(request, options);
  const parsed = new URLSearchParams(dataStr);
  let response = Object.create(null);

  for (let [k, v] of parsed.entries()) {
    // avoid proto polluting
    if (k !== '__proto__') {
      response[k] = v;
    }
  }

  return response;
}

async function parsePlainText(
  request: IncomingMessage,
  options: IParseBodyOptions
) {
  return parseBodyAsString(request, options);
}

export const bodyParser = {
  'text/plain': parsePlainText,
  'application/json': parseApplicationJSON,
  'multipart/form-data': parseMultipartFormData,
  'application/x-www-form-urlencoded': parseURLEncoded
};


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

function getCompleteRouteConfig(
  options?: PartialDeep<THttpConfiguration['route']>
): THttpConfiguration['route'] {
  const defaultConfig = container.resolve<THttpConfiguration>('httpConfiguration');

  return deepmerge(
    defaultConfig.route,
    options as any
  );
}

export async function parseBodyIntoRequest(
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
export function parseContentType(typeString: string): ContentTypeParams {
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
