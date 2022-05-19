import AuthenticateUserGuard from "#common/authenticate_user.guard";
import { createController } from "#http/controller";

export default createController({
  guard : [
    AuthenticateUserGuard
  ]
});