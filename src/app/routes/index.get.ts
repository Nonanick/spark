import { createRoute } from "#http/route";
import type { ExampleService } from "#services/example.service";

export default createRoute({
  handler(_req, exampleService : ExampleService) {
    return exampleService.sayHi();
  }
});