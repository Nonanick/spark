import { Unauthorized } from "#http/http_error";
import { HTTPResponse } from "#http/response";
import { createRoute } from "#http/route";
import type { AuthenticationService } from "#services/auth/authentication.service";
import { z } from "zod";

const loginRequestSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(3),
  keepSession: z.boolean().default(false)
});

export default createRoute({
  body: loginRequestSchema,
  handler(req, authenticationService : AuthenticationService ) {
    let access_token = authenticationService.login(req.body);

    if (access_token) {
      return HTTPResponse
        .ok({ message: "login sucessful!" })
        .setCookie('ACCESS_TOKEN', access_token, { httpOnly: true });
    } else {
      return new Unauthorized("could not login with given credentials!");
    }

  }
});