export class HTTPError extends Error {
 status : number = 400; 
}

export class BadRequest extends HTTPError {
  
  override status : number = 400;
}

export class Unauthorized extends HTTPError {
  override status: number = 401;
}

export class PaymentRequired extends HTTPError {
  override status: number = 403;
}

export class Forbidden extends HTTPError {
  override status : number = 403;
}

export class NotFound extends HTTPError {
  override status : number = 404;
}

export class MethodNotAllowed extends HTTPError {
  override status: number = 405;
}

export class NotAcceptable extends HTTPError {
  override status: number = 406;
}

export class ProxyAuthenticationRequired extends HTTPError {
  override status: number = 407;
}

export class RequestTimeout extends HTTPError {
  override status: number = 408;
}

export class Conflict extends HTTPError {
  override status: number = 409;
}

export class Gone extends HTTPError {
  override status: number = 410;
}

export class ContentLengthRequired extends HTTPError {
  override status: number = 411;
}

export class PreconditionFailed extends HTTPError {
  override status: number = 412;
}

export class PayloadTooLarge extends HTTPError {
  override status: number = 413;
}

export class URITooLong extends HTTPError {
  override status: number = 414;
}

export class UnsupportedMediaType extends HTTPError {
  override status: number = 415;
}

export class RangeNotSatisfiable extends HTTPError {
  override status: number = 416;
}

export class ExpectationFailed extends HTTPError {
  override status: number = 417;
}

export class ImATeapot extends HTTPError {
  override status: number = 418;
}

export class MisdirectedRequest extends HTTPError {
  override status: number = 421;
}

export class UnprocessableEntity extends HTTPError {
  override status: number = 422;
}

export class Locked extends HTTPError {
  override status: number = 423;
}

export class TooEarly extends HTTPError {
  override status: number = 425;
}

export class PreconditionRequired extends HTTPError {
  override status: number = 428;
}

export class TooManyRequests extends HTTPError {
  override status: number = 429;
}

export class InternalServerError extends HTTPError {
  override status: number = 500;
}

export class NotImplemented extends HTTPError {
  override status: number = 501;
}

export class BadGateway extends HTTPError {
  override status: number = 502;
}

export class ServiceUnavailable extends HTTPError {
  override status: number = 503;
}

export class GatewayTimeout extends HTTPError {
  override status: number = 504;
}

export class HTTPVersionNotSupported extends HTTPError {
  override status: number = 505;
}

export class InsufficientStorage extends HTTPError {
  override status: number = 507;
}

export class NetworkAuthenticationRequired extends HTTPError {
  override status: number = 511;
}