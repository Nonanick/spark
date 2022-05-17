import { BadRequest, PayloadTooLarge } from "#http/http_error";
import formidable, { File } from "formidable";
import type { IncomingMessage } from "node:http";

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