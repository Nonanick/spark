import type { IAuthenticatedUser } from "#common/guards/authenticate_user";
import { createRoute } from "#http/route";

export default createRoute({
    handler(req, user : IAuthenticatedUser) {
      return user;
    }
})