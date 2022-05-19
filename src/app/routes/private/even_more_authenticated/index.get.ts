import type { IAuthenticatedUser } from "#common/authenticate_user.guard";
import { createRoute } from "#http/route";

export default createRoute({
    handler(req, user : IAuthenticatedUser) {
      return user;
    }
})