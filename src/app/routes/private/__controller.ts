import { AuthenticationGuard } from "#common/guards/authenticate_user";
import { createController } from "#http/controller";

export default createController({
  guard : [
    AuthenticationGuard
  ]
});