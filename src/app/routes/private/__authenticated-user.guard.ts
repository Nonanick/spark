import { createController } from "#http/controller";
import { HTTPResponse } from "#http/response";
import type { AuthenticationService } from "#services/auth/authentication.service";
import { z } from "zod";

export default createController({
  cookies : {
    'ACCESS_TOKEN' : z.string().min(3)
  },
  guard : [
    async (req, route, authenticationService : AuthenticationService) => {
      if(!authenticationService.checkAccessToken(req.cookies.ACCESS_TOKEN)) {
        return HTTPResponse.ok({ msg : "Incorrect Access Token", }, 401);
      }
      return true;
    }
  ]
});