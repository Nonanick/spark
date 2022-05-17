import type { IHTTPRequestData } from "./request.js";
import type { HTTPResponse } from "./response.js";
import type { HTTPRoute } from "./route.js";

export type HTTPRouteGuard = IHTTPRouteGuard | THTTPRouteGuardFn;

interface IHTTPRouteGuard {
  name : string;
  guard : THTTPRouteGuardFn;
}

type THTTPRouteGuardFn = (req: IHTTPRequestData, route: HTTPRoute, ...services: unknown[]) =>
  | boolean | HTTPResponse
  | Promise<boolean | HTTPResponse>;