import { createController } from "#http/controller";
import type { AuthenticationService } from "#services/auth/authentication.service";
import { z } from "zod";

export default createController({
  cookies : {
    'ACCESS_TOKEN' : z.string().min(3)
  },
  guard : [
    async (req, route, authenticationService : AuthenticationService) => {
      return authenticationService.checkAccessToken(req.cookies.ACCESS_TOKEN);
    }
  ]
});