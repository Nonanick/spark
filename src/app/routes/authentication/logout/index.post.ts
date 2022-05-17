import { HTTPResponse } from "#http/response";
import { createRoute } from "#http/route";

export default createRoute({
  handler(req) {
    return HTTPResponse.ok({ msg : "user logged out" }, 200).expireCookie("ACCESS_TOKEN");
  }
});