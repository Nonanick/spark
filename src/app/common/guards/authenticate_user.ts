import { createGuard } from "#http/guard";
import { HTTPResponse } from "#http/response";
import type { AuthenticationService } from "#services/auth/authentication.service";
import { z } from "zod";

export const AuthenticationGuard =  createGuard({
  name: 'Require user authentication',
  cookies : {
    'ACCESS_TOKEN' : z.string().min(3)
  },
  guard : 
    async (req, authenticationService : AuthenticationService) => {
      if(!authenticationService.checkAccessToken(req.cookies.ACCESS_TOKEN)) {
        return HTTPResponse.error(new Error("Failed to verify access token!"), 401);
      }
      return true;
    },
});

export interface IAuthenticatedUser {
  name : string;
  privileges : string | string;
}